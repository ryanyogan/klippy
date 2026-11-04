import { AIChatAgent } from '@cloudflare/ai-chat';
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from 'ai';
import { MAX_QUESTION } from './ask';
import { underLimit } from './guard';
import { model } from './model';
import { getTime } from './tools/time';
import { getWeather } from './tools/weather';

// One Klippy per name. Each instance is its own Durable Object, with its own conversation in its own SQLite,
// so Alice's chat never mixes with Bob's (a global array in the Worker would hold everyone's).
export class Klippy extends AIChatAgent {
	// Keep the last 40 messages. That caps what's stored, and so what each turn sends to the model.
	maxPersistedMessages = 40;

	// Called for every new message. this.messages already holds it, and the whole conversation before it.
	async onChatMessage(_onFinish: unknown, options?: { abortSignal?: AbortSignal }) {
		// Same locks as /ask: a message of at most 2,000 characters, and at most 10 turns a minute per Klippy.
		if (textOf(this.messages.at(-1)).length > MAX_QUESTION) {
			return new Response(`That message is over ${MAX_QUESTION} characters. Send a shorter one.`);
		}
		if (!(await underLimit(this.env, `chat:${this.name}`))) {
			return new Response('Too many messages. Wait a minute.');
		}
		const result = streamText({
			model: model(this.env),
			system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
			// The conversation so far, minus any message that was too long (it stays in the chat, but never reaches the model).
			messages: await convertToModelMessages(this.messages.filter((m) => m.role !== 'user' || textOf(m).length <= MAX_QUESTION)),
			maxOutputTokens: 300,
			tools: { getWeather, getTime },
			stopWhen: isStepCount(3),
			abortSignal: options?.abortSignal, // the client cancelled: stop paying for tokens
		});
		return result.toUIMessageStreamResponse();
	}
}

// The text of a chat message (its other parts are tool calls and the like).
function textOf(message: UIMessage | undefined) {
	return message?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('') ?? '';
}
