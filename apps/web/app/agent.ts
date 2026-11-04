import { env } from 'cloudflare:workers';
import type { UIMessage } from 'ai';

// Call the agent Worker through the service binding, with the agent's token. The token stays on the server:
// the browser only ever talks to this web app.
export function agentFetch(path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${env.KLIPPY_TOKEN}`);
	return env.AGENT.fetch(new URL(path, 'https://agent'), { ...init, headers });
}

// Your saved chat, read from your Klippy. If the agent refuses (a wrong KLIPPY_TOKEN is a 401) or is down, say so:
// an empty list would look exactly like "no messages yet" and hide the problem.
export async function loadHistory(name: string): Promise<{ messages: UIMessage[] } | { error: string }> {
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
