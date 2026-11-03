import { generateText } from 'ai';
import { model } from './model';

// Long questions cost money and time. 2,000 characters is plenty for one question.
const MAX_QUESTION = 2000;

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/') {
			return new Response('Hi, I am Klippy.');
		}

		if (url.pathname === '/ask' && request.method === 'POST') {
			// Never trust the body: check that question really is a string before using it.
			const body = await request.json<{ question?: unknown }>().catch(() => null);
			const question = typeof body?.question === 'string' ? body.question.trim() : '';
			if (!question || question.length > MAX_QUESTION) {
				return Response.json({ error: `Send {"question": "..."}, up to ${MAX_QUESTION} characters` }, { status: 400 });
			}

			const { text, providerMetadata } = await generateText({
				model: model(env),
				system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
				messages: [{ role: 'user', content: question }],
				maxOutputTokens: 300, // a hard cap on the reply, so one request can't run up a bill
			});
			// Which model answered: Claude, or the fallback.
			return Response.json({ answer: text, model: providerMetadata?.cloudflare?.model });
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
