import { routeAgentRequest } from 'agents';
import { ask, MAX_QUESTION } from './ask';
import { check } from './check';
import { clientAddress, isOwner, underLimit } from './guard';
import { tidyNote } from './note';

// Durable Object classes must be exported from the Worker's main file.
export { Klippy } from './agent';
// So are Workflow classes.
export { IngestWorkflow } from './ingest/workflow';

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/') {
			return new Response('Hi, I am Klippy.');
		}

		// /agents/klippy/<name>: your agents. Only you can reach them, and they spend your model budget.
		if (url.pathname.startsWith('/agents/')) {
			const isSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
			if (!(await isOwner(request, env, isSocket))) {
				return Response.json({ error: 'Send Authorization: Bearer <your KLIPPY_TOKEN>' }, { status: 401 });
			}
			url.searchParams.delete('token'); // checked: don't pass it on, so the agent never sees or logs it
			return (await routeAgentRequest(new Request(url, request), env)) ?? new Response('Not found', { status: 404 });
		}

		if (url.pathname === '/ask' && request.method === 'POST') {
			const question = await guardedText(request, env, 'question');
			if (question instanceof Response) return question;
			return Response.json(await ask(env, question));
		}

		if (url.pathname === '/note' && request.method === 'POST') {
			const text = await guardedText(request, env, 'text');
			if (text instanceof Response) return text;
			const note = await tidyNote(env, text);
			if (!note) return Response.json({ error: "Klippy couldn't save that note. Try a shorter one." }, { status: 422 });
			return Response.json(note);
		}

		if (url.pathname === '/klippy/check' && request.method === 'GET') {
			return check(url, env);
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

// Every route that spends your model budget goes through the same locks: your token, the rate limit,
// and a body field that must be a string of 1 to 2,000 characters. Returns the text, or the error to send.
async function guardedText(request: Request, env: Env, field: string): Promise<string | Response> {
	if (!(await isOwner(request, env))) {
		return Response.json({ error: 'Send Authorization: Bearer <your KLIPPY_TOKEN>' }, { status: 401 });
	}
	if (!(await underLimit(env, clientAddress(request)))) {
		return Response.json({ error: 'Too many requests. Wait a minute.' }, { status: 429 });
	}
	// Never trust the body: check that the field really is a string before using it.
	const body = await request.json<Record<string, unknown>>().catch(() => null);
	const value = body?.[field];
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text || text.length > MAX_QUESTION) {
		return Response.json({ error: `Send {"${field}": "..."}, up to ${MAX_QUESTION} characters` }, { status: 400 });
	}
	return text;
}
