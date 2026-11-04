import { createController } from 'remix/router';
import { agentFetch, loadHistory } from '../agent.ts';
import { agentName, requireUser } from '../auth.ts';
import { tooMany, underUserLimit } from '../limits.ts';
import { routes } from '../routes.ts';
import { HomePage } from './home-page.tsx';

// Every page here needs a signed-in user; anyone else is sent to /login.
export default createController(routes, {
	middleware: [requireUser],
	actions: {
		async home(context) {
			const user = context.auth.identity;
			// Your Klippy, picked from your GitHub id. Its saved messages come from its own Durable Object.
			const name = agentName(user);
			const history = await loadHistory(name);
			return context.render(<HomePage user={user} agent={name} history={history} />, {
				status: 'error' in history ? 502 : 200,
			});
		},
		// The chat island's WebSocket: check it, then hand it to your Klippy through the service binding.
		// agentFetch adds the token here, on the server, so the browser never has it.
		async chat(context) {
			const request = context.request;
			if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
				return new Response('Expected a WebSocket', { status: 426 });
			}
			// cop() only guards form posts. A socket from another site's page would carry your cookie: refuse it.
			if (request.headers.get('Origin') !== context.url.origin) {
				return new Response('Wrong origin', { status: 403 });
			}
			// Each new socket counts (a reconnect loop can't hammer the agent); the messages on it are limited by the agent.
			if (!(await underUserLimit(context.auth.identity))) return tooMany();
			const headers = new Headers(request.headers);
			headers.delete('Cookie'); // the agent doesn't need your session cookie
			return agentFetch(`/agents/klippy/${agentName(context.auth.identity)}`, { headers });
		},
	},
});
