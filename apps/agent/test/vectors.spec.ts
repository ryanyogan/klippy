import { describe, expect, it } from 'vitest';
import { EMBEDDING_MODEL, upsertChunks, vectorSearch } from '../src/retrieval/vectors';

// A stand-in env: Workers AI returns one tiny vector per text, Vectorize records what it's given.
function fakeEnv() {
	const calls = { run: [] as unknown[], upsert: [] as VectorizeVector[][] };
	const env = {
		AI: { run: async (model: string, input: { text: string[] }) => (calls.run.push({ model, input }), { data: input.text.map((_, i) => [i, 1]) }) },
		VECTORIZE: { upsert: async (vectors: VectorizeVector[]) => (calls.upsert.push(vectors), { mutationId: 'm' }) },
	} as unknown as Env;
	return { env, calls };
}

describe('upsertChunks', () => {
	it('embeds every chunk in one call and stores it under chunk-<id>, tagged with its owner and source', async () => {
		const { env, calls } = fakeEnv();
		const rows = [
			{ id: 7, owner: 'gh-1', source_id: 3, text: 'Pip is my dog.' },
			{ id: 8, owner: 'gh-1', source_id: 3, text: 'She likes carrots.' },
		];
		expect(await upsertChunks(env, rows)).toBe(2);
		expect(calls.run).toEqual([{ model: EMBEDDING_MODEL, input: { text: ['Pip is my dog.', 'She likes carrots.'] } }]);
		expect(calls.upsert[0]).toEqual([
			{ id: 'chunk-7', values: [0, 1], metadata: { owner: 'gh-1', sourceId: 3 } },
			{ id: 'chunk-8', values: [1, 1], metadata: { owner: 'gh-1', sourceId: 3 } },
		]);
	});

	it('embeds the context line in front of the chunk', async () => {
		const { env, calls } = fakeEnv();
		await upsertChunks(env, [{ id: 9, owner: 'gh-1', source_id: 4, context: 'From the Pip page.', text: 'She likes carrots.' }]);
		expect(calls.run).toEqual([{ model: EMBEDDING_MODEL, input: { text: ['From the Pip page.\n\nShe likes carrots.'] } }]);
	});

	it('takes an id prefix (the eval uses its own), and vectorSearch reads the chunk id from the end of any id', async () => {
		const { env, calls } = fakeEnv();
		await upsertChunks(env, [{ id: 5, owner: 'eval-1', source_id: 1, text: 't' }], 'eval-1-chunk-');
		expect(calls.upsert[0][0].id).toBe('eval-1-chunk-5');
		const searchEnv = {
			...env,
			VECTORIZE: { query: async () => ({ matches: [{ id: 'chunk-12' }, { id: 'eval-1-chunk-5' }, { id: 'junk' }], count: 3 }) },
		} as unknown as Env;
		expect(await vectorSearch(searchEnv, 'eval-1', 'q')).toEqual([12, 5]);
	});

	it('calls nothing for a source with no chunks', async () => {
		const { env, calls } = fakeEnv();
		expect(await upsertChunks(env, [])).toBe(0);
		expect(calls.run).toEqual([]);
	});
});
