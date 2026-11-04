import { env } from 'cloudflare:workers';
import { createController } from 'remix/router';
import { routes } from '../routes.ts';
import { HomePage } from './home-page.tsx';

export default createController(routes, {
	actions: {
		async home(context) {
			// Worker to Worker through the service binding. The host name is ignored: AGENT always means the agent Worker.
			const reply = await env.AGENT.fetch('https://agent/');
			return context.render(<HomePage agentSays={reply.ok ? await reply.text() : `The agent answered ${reply.status}.`} />);
		},
	},
});
