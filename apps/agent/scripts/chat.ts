import { MessageType } from '@cloudflare/ai-chat/types';
import { WebSocketChatTransport } from 'agents/chat/transport';
import { AgentClient } from 'agents/client';
import { getToolName, isToolUIPart, readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai';
import { createInterface } from 'node:readline/promises';

// `pnpm chat alice` talks to the Klippy called "alice". KLIPPY_TOKEN comes from .dev.vars.
const url = new URL(process.env.KLIPPY_URL ?? 'http://localhost:8787');
const name = process.argv[2] ?? 'me';
const token = process.env.KLIPPY_TOKEN ?? '';

// One WebSocket to this Klippy, kept open for the whole chat. A WebSocket can't send headers, so the token rides
// in the query string (the Worker allows that only for the socket, and strips it before the agent sees it).
const agent = new AgentClient({ agent: 'Klippy', name, host: url.host, protocol: url.protocol === 'https:' ? 'wss' : 'ws', query: { token } });
const transport = new WebSocketChatTransport({ agent });
const seen = new Set<string>(); // the replies already on screen
const textOf = (reply: UIMessage) => reply.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
// A reply that continues after you approve a tool is announced with STREAM_RESUMING: hand it to the transport.
agent.addEventListener('message', (event) => {
	const data = JSON.parse(String(event.data));
	if (data.type === MessageType.CF_AGENT_STREAM_RESUMING) transport.handleStreamResuming(data);
	if (data.type === MessageType.CF_AGENT_STREAM_RESUME_NONE) transport.handleStreamResumeNone(data);
	if (data.type === MessageType.CF_AGENT_STREAM_PENDING) transport.handleStreamPending();
	// A turn Klippy started on its own (a reminder, c-08): print its reply when the finished chat arrives.
	const last: UIMessage | undefined = data.type === MessageType.CF_AGENT_CHAT_MESSAGES ? data.messages.at(-1) : undefined;
	if (last?.role === 'assistant' && !seen.has(last.id)) {
		seen.add(last.id);
		process.stdout.write(`\nklippy> ${textOf(last)}\nyou> `);
	}
});

// The conversation lives in the agent, not here: read it whenever we need it.
async function load(): Promise<UIMessage[]> {
	const response = await fetch(new URL(`/agents/klippy/${name}/get-messages`, url), { headers: { Authorization: `Bearer ${token}` } });
	if (!response.ok) throw new Error(`Klippy said ${response.status}: is the Worker running, and is KLIPPY_TOKEN right?`);
	return response.json();
}

// The reply arrives in chunks. Each step gives the whole message so far: print only what's new.
// `message` is the reply being continued (after an approval), so its old text isn't printed twice.
async function print(stream: ReadableStream<UIMessageChunk> | null, message?: UIMessage) {
	if (!stream) return;
	let printed = message ? textOf(message).length : 0;
	process.stdout.write('klippy> ');
	for await (const reply of readUIMessageStream({ stream, message })) {
		seen.add(reply.id);
		process.stdout.write(textOf(reply).slice(printed));
		printed = textOf(reply).length;
	}
	process.stdout.write('\n');
}

const terminal = createInterface({ input: process.stdin, output: process.stdout });
const lines = terminal[Symbol.asyncIterator]();
async function ask(prompt: string) {
	process.stdout.write(prompt);
	const { value, done } = await lines.next();
	return done ? undefined : String(value).trim();
}

let messages = await load();
for (const message of messages) seen.add(message.id);
console.log(`Talking to Klippy "${name}" (${messages.length} messages so far). /clear to start over, Ctrl+D to quit.`);
for (let text = await ask('you> '); text !== undefined; text = await ask('you> ')) {
	if (!text) continue;
	// "/clear" wipes this Klippy's chat history. What it remembered (c-05) stays.
	if (text === '/clear') {
		agent.send(JSON.stringify({ type: MessageType.CF_AGENT_CHAT_CLEAR }));
		console.log('(chat cleared)');
		continue;
	}
	messages = [...(await load()), { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] }];
	await print(await transport.sendMessages({ chatId: name, messages, trigger: 'submit-message', messageId: undefined, abortSignal: undefined }));

	// Did Klippy stop to ask before using a tool (needsApproval)? Then ask you, send the answer, and print the rest.
	for (;;) {
		const last = (await load()).at(-1);
		const part = last?.parts.find((p) => isToolUIPart(p) && p.state === 'approval-requested');
		if (!last || !part || !isToolUIPart(part)) break;
		const approved = (await ask(`Klippy wants to use ${getToolName(part)} with ${JSON.stringify(part.input)}. Allow? (y/n) `)) === 'y';
		transport.expectToolContinuation();
		agent.send(JSON.stringify({ type: MessageType.CF_AGENT_TOOL_APPROVAL, toolCallId: part.toolCallId, approved, autoContinue: true }));
		await print(await transport.reconnectToStream({ chatId: name }), last);
	}
}
agent.close();
