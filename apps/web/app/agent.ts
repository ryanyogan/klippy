import { env } from 'cloudflare:workers';
import type { SerializableObject } from 'remix/component';

// Call the agent Worker through the service binding, with the agent's token. The token stays on the server:
// the browser only ever talks to this web app.
export function agentFetch(path: string, init: RequestInit = {}) {
	// A Preview has no AGENT binding (wrangler.jsonc, f-07): answer that plainly instead of crashing.
	if (!env.AGENT) return Promise.resolve(Response.json({ error: 'This deployment has no agent (a Preview).' }, { status: 503 }));
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${env.KLIPPY_TOKEN}`);
	return env.AGENT.fetch(new URL(path, 'https://agent'), { ...init, headers });
}

// The saved messages, as the JSON the agent sent (they go straight into the chat island's props).
export type History = { messages: SerializableObject[] } | { error: string };

// Your saved chat, read from your Klippy. If the agent refuses (a wrong KLIPPY_TOKEN is a 401) or is down, say so:
// an empty list would look exactly like "no messages yet" and hide the problem.
export async function loadHistory(name: string): Promise<History> {
	try {
		const reply = await agentFetch(`/agents/klippy/${name}/get-messages`);
		if (reply.ok) return { messages: await reply.json() };
		console.error(JSON.stringify({ message: 'get-messages failed', status: reply.status })); // the status, never the URL
		return { error: `Klippy didn't answer (HTTP ${reply.status}).` };
	} catch (error) {
		console.error(JSON.stringify({ message: 'agent unreachable', error: String(error) }));
		return { error: "Klippy can't be reached right now." };
	}
}
