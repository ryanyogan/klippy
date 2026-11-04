import { generateText, isStepCount, type ToolSet } from 'ai';
import { model, type Call } from './model';
import { readLink } from './tools/link';
import { noteTools } from './tools/notes';
import { getTime } from './tools/time';
import { getWeather } from './tools/weather';

// Long questions cost money and time. 2,000 characters is plenty for one question.
export const MAX_QUESTION = 2000;

// What Klippy says when the step cap stops it mid tool-call (the last step asked for a tool, so there's no text).
export const OUT_OF_STEPS = 'Sorry, I ran out of steps before I could answer. Try asking one thing at a time.';

// Every tool Klippy has. The notes tools need the database; readLink needs the question (it reads only its links).
export function allTools(env: Env, question: string) {
	return { getWeather, getTime, ...noteTools(env.DB), readLink: readLink(env, question) };
}

// One question in, one answer out. Both /ask and /klippy/check use it.
export async function ask(env: Env, question: string, tools: ToolSet = allTools(env, question), call: Call = { route: 'ask' }) {
	const { text, providerMetadata } = await generateText({
		model: model(env, call),
		system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
		messages: [{ role: 'user', content: question }],
		maxOutputTokens: 300, // a hard cap on the reply, so one request can't run up a bill
		tools,
		toolChoice: 'auto', // the default, written out: Claude decides whether to call a tool, and which
		// Once Claude has read a web page, that page could be giving orders. From then on, no notes tools:
		// it can't read your notes (private data) or write one (an action) on a page's say-so.
		prepareStep: ({ steps }) => {
			const readAPage = steps.some((step) => step.toolCalls.some((call) => call.toolName === 'readLink'));
			return readAPage ? { activeTools: Object.keys(tools).filter((name) => name !== 'saveNote' && name !== 'listNotes') } : {};
		},
		// Up to two rounds of tools (say the time, then the weather), then the answer. Then stop, whatever happens.
		stopWhen: isStepCount(3),
		// Log one line per step, so you can watch the round trip. Since f-04 it's the shape only: b-03's line also had the
		// tool inputs, results and text, which is fine on your laptop and wrong in production logs (notes, pages, questions).
		onStepEnd: (step) => {
			console.log({
				event: 'ask.step',
				step: step.stepNumber,
				finish: step.finishReason, // "tool-calls": Claude wants a tool. "stop": it answered.
				tools: step.toolCalls.map((call) => call.toolName), // names only
				// A failed tool call (bad input, or a service that's down) goes back to Claude as an error. Count, not text.
				toolErrors: step.content.filter((part) => part.type === 'tool-error').length,
				tokens: step.usage.totalTokens,
			});
		},
	});
	// Which model answered: Claude, or the fallback.
	// Stopped mid-way (the last step was still a tool call)? Then there's no text: say so instead of sending "".
	const answer = text || OUT_OF_STEPS;
	// cache: HIT when the gateway answered from its cache (only requests that opt in, like the check probe).
	return { answer, model: providerMetadata?.cloudflare?.model, cache: providerMetadata?.cloudflare?.cacheStatus };
}

