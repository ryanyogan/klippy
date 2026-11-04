import { createAnthropic } from '@ai-sdk/anthropic';
import { createAI } from 'agents/models/ai-sdk';

// Every model call goes through your AI Gateway. "default" is created for you on first use.
export function model(env: Env) {
	const ai = createAI({ binding: env.AI, id: 'default' });
	return ai('anthropic/claude-haiku-5.5', {
		// No Anthropic key on your gateway yet? Klippy answers with a free Workers AI model instead.
		fallback: [ai('@cf/zai-org/glm-4.7-flash', { reasoningEffort: null })],
	});
}

// For the ingest step that writes a line of context per chunk (e-06): Claude Haiku through the same gateway, but as
// Anthropic's own model object, so the request is Anthropic Messages and prompt caching (cacheControl) reaches Claude.
// The apiKey is a placeholder: the gateway strips it and uses the key stored on the gateway (BYOK).
export function contextModel(env: Env) {
	const ai = createAI({ binding: env.AI, id: 'default' });
	const anthropic = createAnthropic({ apiKey: 'stored-on-the-gateway' });
	return ai(anthropic('claude-haiku-5-5'), {
		fallback: [ai('@cf/zai-org/glm-4.7-flash', { reasoningEffort: null })],
	});
}
