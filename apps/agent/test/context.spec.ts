import { describe, expect, it } from 'vitest';
import { contextFor, MAX_CONTEXT } from '../src/ingest/context';
import { fakeModel } from './fake-model';

describe('contextFor', () => {
	it('sends the document first, marked for caching, then the chunk, and returns one trimmed sentence', async () => {
		const model = fakeModel('  From the Pip page: her diet.  ');
		const context = await contextFor({} as Env, '# Pip\n\nPip is my dog.\n\n## Food\n\nCarrots.', '## Food\n\nCarrots.', model);
		expect(context).toBe('From the Pip page: her diet.');
		const [message] = model.doGenerateCalls[0].prompt;
		const [document, chunk] = message.content as { type: string; text: string; providerOptions?: unknown }[];
		expect(document.text).toContain('<document>\n# Pip');
		expect(document.providerOptions).toEqual({ anthropic: { cacheControl: { type: 'ephemeral' } } });
		expect(chunk.text).toContain('<chunk>\n## Food\n\nCarrots.\n</chunk>');
		expect(chunk.providerOptions).toBeUndefined(); // only the shared part is cached: the chunk changes every call
	});

	it(`caps the sentence at ${MAX_CONTEXT} characters`, async () => {
		expect((await contextFor({} as Env, 'doc', 'chunk', fakeModel('x'.repeat(1000)))).length).toBe(MAX_CONTEXT);
	});
});
