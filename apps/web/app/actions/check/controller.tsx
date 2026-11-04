import { env } from 'cloudflare:workers';
import { parseSafe } from 'remix/data-schema';
import { createController } from 'remix/router';
import { agentFetch } from '../../agent.ts';
import { routes } from '../../routes.ts';
import { CheckQuery } from './schema.ts';

// GET /klippy/check?nonce=...: bits calls this to check that your Klippy is on the web. Public (the grader isn't
// signed in), so it's rate limited here, and the agent's own check caches its probe and limits fresh ones (a-05).
export default createController(routes.check, {
	actions: {
		async index(context) {
			const query = parseSafe(CheckQuery, context.url.searchParams);
			if (!query.success) return Response.json({ error: 'Send ?nonce= (8 to 64 letters, digits, - or _)' }, { status: 400 });
			const address = context.request.headers.get('cf-connecting-ip') ?? 'local';
			if (!(await env.CHECK_LIMITER.limit({ key: address })).success) {
				return Response.json({ error: 'Too many checks. Wait a minute.' }, { status: 429 });
			}
			// Through the service binding, as everything else: proof the web app really reaches your agent.
			const reply = await agentFetch(`/klippy/check?nonce=${query.value.nonce}`);
			return new Response(reply.body, {
				status: reply.status,
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
			});
		},
	},
});
