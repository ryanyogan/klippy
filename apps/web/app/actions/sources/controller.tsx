import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { agentFetch } from '../../agent.ts';
import { agentName, requireUser } from '../../auth.ts';
import { tooMany, underUserLimit } from '../../limits.ts';
import { routes } from '../../routes.ts';

// The agent checks for 1 MB too; this stops a bigger body before the web app reads it.
const MAX_UPLOAD = 1_100_000;

// Files and search reach your Klippy only through here: signed in, and the agent picked from your session.
export default createController(routes.sources, {
	middleware: [requireUser],
	actions: {
		// POST /sources/file (a form with a "file" field): pass the file on to your Klippy, which ingests it.
		async upload(context) {
			if (!(await underUserLimit(context.auth.identity))) return tooMany();
			const request = context.request;
			const type = request.headers.get('Content-Type') ?? '';
			const size = Number(request.headers.get('Content-Length') ?? NaN);
			if (!type.startsWith('multipart/form-data')) return new Response('Send a form with a file.', { status: 400 });
			if (!(size <= MAX_UPLOAD)) return new Response('Files can be up to 1 MB.', { status: 413 });
			const body = await request.arrayBuffer();
			if (body.byteLength > MAX_UPLOAD) return new Response('Files can be up to 1 MB.', { status: 413 });
			const reply = await agentFetch(`/agents/klippy/${agentName(context.auth.identity)}/file`, {
				method: 'POST',
				headers: { 'Content-Type': type },
				body,
			});
			if (reply.ok) return redirect(`${routes.notes.index.href()}?sent=1`, 303);
			const { error } = await reply.json<{ error?: string }>().catch(() => ({ error: undefined }));
			return new Response(error ?? `Klippy didn't take the file (HTTP ${reply.status}).`, { status: reply.status < 500 ? reply.status : 502 });
		},
		// GET /sources/search?q=...: what search finds in your saved sources, as JSON (the agent checks q and rate-limits).
		async search(context) {
			if (!(await underUserLimit(context.auth.identity))) return tooMany();
			const q = context.url.searchParams.get('q') ?? '';
			const reply = await agentFetch(`/agents/klippy/${agentName(context.auth.identity)}/search?q=${encodeURIComponent(q)}`);
			return new Response(reply.body, { status: reply.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
		},
	},
});
