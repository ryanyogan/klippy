import { createAI } from 'agents/models/ai-sdk';

// Every model call goes through your AI Gateway. "default" is created for you on first use.
export function model(env: Env) {
	const ai = createAI({ binding: env.AI, id: 'default' });
	return ai('anthropic/claude-haiku-5.5', {
		// No Anthropic key on your gateway yet? Klippy answers with a free Workers AI model instead.
		fallback: [ai('@cf/zai-org/glm-4.7-flash', { reasoningEffort: null })],
	});
}
