import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';
import { model } from '../src/model';

// A stand-in for env.AI that records what each model call asked the gateway for, then fails (so nothing is called).
function recordingAI() {
	const calls: { model: string; gateway: Record<string, unknown> }[] = [];
	const binding = {
		run: async (model: string, _input: unknown, options: { gateway: Record<string, unknown> }) => {
			calls.push({ model, gateway: options.gateway });
			throw new Error('offline');
		},
	};
	return { env: { AI: binding } as unknown as Env, calls };
}

describe('the gateway options (f-02)', () => {
	it('labels a chat with its route and whose Klippy it is, and never caches it', async () => {
		const { env, calls } = recordingAI();
		await generateText({ model: model(env, { route: 'chat', user: 'gh-1' }), prompt: 'hi', maxRetries: 0 }).catch(() => {});
		// Claude first, then the free fallback: both carry the same labels.
		expect(calls.map((call) => call.model)).toEqual(['anthropic/claude-haiku-5.5', '@cf/zai-org/glm-4.7-flash']);
		for (const { gateway } of calls) {
			expect(gateway).toMatchObject({ id: 'default', metadata: { app: 'klippy', route: 'chat', user: 'gh-1' } });
			expect(gateway).not.toHaveProperty('cacheKey');
			expect(gateway).not.toHaveProperty('cacheTtl');
		}
	});

	it('opts the check probe into the cache with a key and a time to live', async () => {
		const { env, calls } = recordingAI();
		const call = { route: 'check' as const, cache: { key: 'klippy-check-f-02', ttl: 300 } };
		await generateText({ model: model(env, call), prompt: 'hi', maxRetries: 0 }).catch(() => {});
		expect(calls[0].gateway).toMatchObject({ cacheKey: 'klippy-check-f-02', cacheTtl: 300, metadata: { route: 'check', user: null } });
	});
});
