import { createAnthropic } from '@ai-sdk/anthropic';
import { createAI } from 'agents/models/ai-sdk';

// What each call is for, so the gateway can label it (f-02). route: which part of Klippy asked; user: whose Klippy.
// cache: only for a request that's the same for everyone (the check probe). Chats are personal and change: never cached.
export type Call = { route: 'ask' | 'note' | 'chat' | 'check' | 'context'; user?: string; cache?: { key: string; ttl: number } };

// Every model call goes through your AI Gateway. "default" is created for you on first use.
function gateway(env: Env, { route, user, cache }: Call) {
	return createAI({
		binding: env.AI,
		id: 'default',
		// Shown on each request in the gateway's logs, and what spend limits can be scoped by (say, per user per day).
		// Labels only: never the question, a note or a token.
		metadata: { app: 'klippy', route, user: user ?? null },
		// Caching is off unless a request opts in: cacheKey opts in, cacheTtl says for how long (60 s minimum).
		...(cache ? { cacheKey: cache.key, cacheTtl: cache.ttl } : {}),
	});
}

export function model(env: Env, call: Call = { route: 'ask' }) {
	const ai = gateway(env, call);
	return ai('anthropic/claude-haiku-5.5', {
		// No Anthropic key on your gateway yet? Klippy answers with a free Workers AI model instead.
		fallback: [ai('@cf/zai-org/glm-4.7-flash', { reasoningEffort: null })],
	});
}

// For the ingest step that writes a line of context per chunk (e-06): Claude Haiku through the same gateway, but as
// Anthropic's own model object, so the request is Anthropic Messages and prompt caching (cacheControl) reaches Claude.
// The apiKey is a placeholder: the gateway strips it and uses the key stored on the gateway (BYOK).
export function contextModel(env: Env) {
	const ai = gateway(env, { route: 'context' });
	const anthropic = createAnthropic({ apiKey: 'stored-on-the-gateway' });
	return ai(anthropic('claude-haiku-5-5'), {
		fallback: [ai('@cf/zai-org/glm-4.7-flash', { reasoningEffort: null })],
	});
}
