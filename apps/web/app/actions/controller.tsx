import { createController } from 'remix/router';
import { loadHistory } from '../agent.ts';
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
			const history = await loadHistory(name);
			return context.render(<HomePage user={user} agent={name} history={history} />, {
				status: 'error' in history ? 502 : 200,
			});
		},
	},
});
