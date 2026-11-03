import { ask, MAX_QUESTION } from './ask';
import { check } from './check';
import { clientAddress, isOwner, underLimit } from './guard';

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/') {
			return new Response('Hi, I am Klippy.');
		}

		if (url.pathname === '/ask' && request.method === 'POST') {
			if (!(await isOwner(request, env))) {
				return Response.json({ error: 'Send Authorization: Bearer <your KLIPPY_TOKEN>' }, { status: 401 });
			}
			if (!(await underLimit(env, clientAddress(request)))) {
				return Response.json({ error: 'Too many questions. Wait a minute.' }, { status: 429 });
			}
			// Never trust the body: check that question really is a string before using it.
			const body = await request.json<{ question?: unknown }>().catch(() => null);
			const question = typeof body?.question === 'string' ? body.question.trim() : '';
			if (!question || question.length > MAX_QUESTION) {
				return Response.json({ error: `Send {"question": "..."}, up to ${MAX_QUESTION} characters` }, { status: 400 });
			}
			return Response.json(await ask(env, question));
		}

		if (url.pathname === '/klippy/check' && request.method === 'GET') {
			return check(url, env);
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
