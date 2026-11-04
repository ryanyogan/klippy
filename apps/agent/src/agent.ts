import { AIChatAgent } from '@cloudflare/ai-chat';
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, isStepCount, streamText, tool, type ToolSet, type UIMessage } from 'ai';
import { MAX_QUESTION, OUT_OF_STEPS } from './ask';
import { underLimit } from './guard';
import { model } from './model';
import { facts, memoryTools } from './tools/memory';
import { readLink } from './tools/link';
import { noteTools } from './tools/notes';
import { MAX_NUDGES_PER_DAY, remindTools } from './tools/remind';
import { getTime } from './tools/time';
import { getWeather } from './tools/weather';
import { saveLinkTool } from './tools/sources';
import { queueSource } from './ingest/sources';
import { fileToMarkdown } from './ingest/file';
import { hybridSearch } from './retrieval/search';

// One Klippy per name. Each instance is its own Durable Object, with its own conversation in its own SQLite,
// so Alice's chat never mixes with Bob's (a global array in the Worker would hold everyone's).
export class Klippy extends AIChatAgent {
	// Keep the last 40 messages. That caps what's stored, and so what each turn sends to the model.
	maxPersistedMessages = 40;

	// Called for every new message. this.messages already holds it, and the whole conversation before it.
	async onChatMessage(_onFinish: unknown, options?: { abortSignal?: AbortSignal }) {
		const question = lastQuestion(this.messages);
		// A turn nudge() started: it only speaks. No tools at all, so a reminder can't fetch, write or schedule more.
		const nudged = isNudge(this.messages.findLast((m) => m.role === 'user'));
		// Same locks as /ask: a message of at most 2,000 characters, and at most 10 turns a minute per Klippy.
		if (question.length > MAX_QUESTION) {
			return new Response(`That message is over ${MAX_QUESTION} characters. Send a shorter one.`);
		}
		if (!(await underLimit(this.env, `chat:${this.name}`))) {
			return new Response('Too many messages. Wait a minute.');
		}
		// Read the facts fresh every turn, so the model sees what it remembered a moment ago.
		const known = facts(this).map(({ id, fact }) => `${id}: ${fact}`);
		// A web page could be giving orders. Once one is anywhere in the chat, this turn gets no private tools at all.
		const pageInChat = this.messages.some((m) => m.parts.some((part) => part.type === 'tool-readLink'));
		const turn = { pageRead: false }; // set the moment readLink runs in this turn
		// A nudge turn gets no tools at all (built empty, and none offered below), so a reminder can only speak.
		const tools = nudged ? {} : chatTools(this, this.env, question, turn, pageInChat);
		const result = streamText({
			model: model(this.env),
			system: [
				'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
				'What you know about the user (id: fact):',
				known.join('\n') || '(nothing yet)',
			].join('\n'),
			// The conversation so far, minus any message that was too long (it stays in the chat, but never reaches the model).
			messages: await convertToModelMessages(this.messages.filter((m) => m.role !== 'user' || textOf(m).length <= MAX_QUESTION)),
			maxOutputTokens: 300,
			tools,
			// Up to 8 steps per turn (each step is one model call), then stop, whatever happens.
			stopWhen: isStepCount(MAX_STEPS),
			// Before each step, look at the steps so far.
			prepareStep: ({ steps }) => {
				if (nudged) return { activeTools: [] };
				const calls = steps.flatMap((step) => step.toolCalls);
				// A web page could be giving orders. Once one is in the chat, no tools that read or write your data.
				const restricted = pageInChat || calls.some((call) => call.toolName === 'readLink');
				const activeTools = restricted ? SAFE : undefined;
				// A stuck loop: the same tool with the same input twice. No more tools: answer with what you have.
				// (The page rule still applies here, so this path can never hand back the private tools.)
				const asked = calls.map((call) => `${call.toolName} ${JSON.stringify(call.input)}`);
				if (new Set(asked).size < asked.length) return { toolChoice: 'none', activeTools };
				return { activeTools };
			},
			abortSignal: options?.abortSignal, // the client cancelled: stop paying for tokens
		});
		// Pass the reply through as it streams. If the cap stopped it mid tool-call, end with an honest sentence, as /ask does.
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				for await (const chunk of result.toUIMessageStream({ sendFinish: false })) writer.write(chunk);
				const steps = await result.steps;
				const last = steps.at(-1);
				const waiting = last?.content.some((part) => part.type === 'tool-approval-request'); // paused for your y/n, not stuck
				if (steps.length >= MAX_STEPS && last?.finishReason === 'tool-calls' && !waiting) {
					writer.write({ type: 'text-start', id: 'out-of-steps' });
					writer.write({ type: 'text-delta', id: 'out-of-steps', delta: OUT_OF_STEPS });
					writer.write({ type: 'text-end', id: 'out-of-steps' });
				}
				writer.write({ type: 'finish' });
			},
		});
		return createUIMessageStreamResponse({ stream });
	}

	// POST /agents/klippy/<name>/file: send Klippy a file to answer from (the Worker already checked your token).
	// Plain text, Markdown, HTML or PDF, up to 1 MB. It's converted to Markdown now and ingested in the background.
	async onRequest(request: Request) {
		const url = new URL(request.url);
		const action = url.pathname.split('/').pop();
		// GET /agents/klippy/<name>/search?q=...: what hybrid search finds for a question (to try it, and for e-08).
		if (request.method === 'GET' && action === 'search') {
			const q = (url.searchParams.get('q') ?? '').trim();
			if (!q || q.length > MAX_QUESTION) return Response.json({ error: `Send ?q=, up to ${MAX_QUESTION} characters` }, { status: 400 });
			if (!(await underLimit(this.env, `search:${this.name}`))) return Response.json({ error: 'Too many requests. Wait a minute.' }, { status: 429 });
			return Response.json({ hits: await hybridSearch(this.env, this.name, q) });
		}
		if (request.method !== 'POST' || action !== 'file') {
			return new Response('Not found', { status: 404 });
		}
		if (!(await underLimit(this.env, `file:${this.name}`))) return Response.json({ error: 'Too many requests. Wait a minute.' }, { status: 429 });
		const file = (await request.formData().catch(() => null))?.get('file');
		if (!(file instanceof File)) return Response.json({ error: 'Send a form with a "file" field.' }, { status: 400 });
		const text = await fileToMarkdown(this.env, file);
		if (text instanceof Response) return text;
		const source = await queueSource(this.env.DB, { owner: this.name, kind: 'file', title: file.name || 'file', body: text });
		if (!source) return Response.json({ error: "You've added enough for today. Try again tomorrow." }, { status: 429 });
		await this.runWorkflow('INGEST', { sourceId: source.id });
		return Response.json({ id: source.id, title: source.title, status: source.status }, { status: 202 });
	}

	// A reminder is due (see remindMe). Nobody sent a message: Klippy starts the turn itself.
	async nudge({ message }: { message: string }) {
		// Wait for any reply in progress, or a question waiting for your answer. Still busy? Try again in a minute.
		if (!(await this.waitUntilStable({ timeout: 30_000 }))) {
			await this.schedule(60, 'nudge', { message });
			return;
		}
		// However many were scheduled, at most 20 reminders speak per day (UTC), per Klippy.
		this.sql`CREATE TABLE IF NOT EXISTS nudges (day TEXT PRIMARY KEY, fired INTEGER NOT NULL)`;
		const day = new Date().toISOString().slice(0, 10);
		const [{ fired }] = this.sql<{ fired: number }>`INSERT INTO nudges (day, fired) VALUES (${day}, 1)
			ON CONFLICT (day) DO UPDATE SET fired = fired + 1 RETURNING fired`;
		if (fired > MAX_NUDGES_PER_DAY) return;
		// saveMessages adds a message and runs onChatMessage, just as if it came from you. Open clients see the reply.
		await this.saveMessages((messages) => [
			...messages,
			// metadata.nudge marks it as Klippy's own message: its text never counts as something you typed.
			{ id: crypto.randomUUID(), role: 'user', metadata: { nudge: true }, parts: [{ type: 'text', text: `A reminder you scheduled for me is due now: "${message}". Tell me in one short sentence. Don't schedule anything.` }] },
		]);
	}
}

// Each step is one model call. 8 is room for a few tools in one turn, and a hard cap on what a turn can cost.
const MAX_STEPS = 8;

// The tools for one turn. With a page in the chat, only the three safe ones. Otherwise the private ones too (notes,
// memory, reminders), each locked so it refuses to run once readLink has run in this turn (afterPage).
export function chatTools(agent: Klippy, env: Env, question: string, turn: { pageRead: boolean }, pageInChat: boolean): ToolSet {
	const link = readLink(env, question); // only the exact links in your latest message, no redirects (b-08)
	const safe: ToolSet = {
		getWeather,
		getTime,
		readLink: {
			...link,
			execute: async (input: Parameters<typeof link.execute>[0], opts: Parameters<typeof link.execute>[1]) => {
				turn.pageRead = true; // before the fetch: even a refused link locks the private tools for the rest of the turn
				return link.execute(input, opts);
			},
		},
	};
	if (pageInChat) return safe;
	const { saveNote, listNotes } = noteTools(env.DB);
	return {
		...safe,
		...afterPage(turn, {
			...memoryTools(agent),
			...remindTools(agent),
			listNotes,
			// Saving a note writes to your database, so Klippy asks you first. The turn pauses until you answer.
			saveNote: {
				...saveNote,
				needsApproval: true,
				// Once saved, the note is also queued as a source, so Klippy can search it later (course E).
				execute: async (input: { body: string }, opts: Parameters<NonNullable<typeof saveNote.execute>>[1]) => {
					const result = await saveNote.execute!(input, opts);
					const { id, body } = (result as { saved: { id: number; body: string } }).saved;
					const source = await queueSource(env.DB, { owner: agent.name, kind: 'note', title: body.slice(0, 60), noteId: id, body });
					if (source) await agent.runWorkflow('INGEST', { sourceId: source.id });
					return result;
				},
			},
			// Saving a link also writes, and fetches a page later: it asks first too.
			saveLink: tool({ ...saveLinkTool(agent, env, question), needsApproval: true }),
		}),
	};
}

// Wrap the private tools (notes, memory) so they refuse to run once a page was read in this turn. prepareStep already
// stops offering them; this is the lock behind it, in case a model calls a tool it wasn't offered.
export function afterPage(turn: { pageRead: boolean }, tools: ToolSet): ToolSet {
	return Object.fromEntries(
		Object.entries(tools).map(([name, t]) => [
			name,
			{
				...t,
				execute: async (input: unknown, opts: Parameters<NonNullable<typeof t.execute>>[1]) => {
					if (turn.pageRead) throw new Error(`${name} can't run after reading a page.`);
					return t.execute!(input, opts);
				},
			},
		]),
	);
}

// The tools that never touch your notes or memory: all Klippy may use once a web page is in the conversation.
const SAFE: ('getWeather' | 'getTime' | 'readLink')[] = ['getWeather', 'getTime', 'readLink'];

// A message nudge() added (a reminder firing), not one you typed.
function isNudge(message: UIMessage | undefined) {
	return (message?.metadata as { nudge?: boolean } | undefined)?.nudge === true;
}

// Your latest message: the last one you typed (after an approval, the turn continues with Klippy's message last,
// and a reminder's message is Klippy's own). readLink may open only the links in it.
export function lastQuestion(messages: UIMessage[]) {
	return textOf(messages.findLast((m) => m.role === 'user' && !isNudge(m)));
}

// The text of a chat message (its other parts are tool calls and the like).
function textOf(message: UIMessage | undefined) {
	return message?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('') ?? '';
}
