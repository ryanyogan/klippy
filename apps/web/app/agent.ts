import { env } from 'cloudflare:workers';

// Call the agent Worker through the service binding, with the agent's token. The token stays on the server:
// the browser only ever talks to this web app.
export function agentFetch(path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${env.KLIPPY_TOKEN}`);
	return env.AGENT.fetch(new URL(path, 'https://agent'), { ...init, headers });
}
