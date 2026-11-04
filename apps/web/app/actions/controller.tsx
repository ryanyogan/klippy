import { createController } from 'remix/router';
import { agentFetch } from '../agent.ts';
import { agentName, requireUser } from '../auth.ts';
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
			const reply = await agentFetch(`/agents/klippy/${name}/get-messages`);
			const messages = reply.ok ? ((await reply.json()) as unknown[]) : [];
			return context.render(<HomePage user={user} agent={name} saved={messages.length} />);
		},
	},
});
