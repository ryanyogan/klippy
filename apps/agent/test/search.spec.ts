import { applyD1Migrations, env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { queueSource, saveChunks } from '../src/ingest/sources';
import { rrf } from '../src/retrieval/rrf';
import { hydrate, keywordSearch } from '../src/retrieval/search';

// No real Vectorize: "search by meaning" returns whatever ids the test sets.
const meaning = vi.hoisted(() => ({ ids: [] as number[] }));
vi.mock('../src/retrieval/vectors', () => ({ vectorSearch: async () => meaning.ids }));

beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));

// Save a source with these chunks for an owner, and return the chunk ids in order.
async function seed(owner: string, title: string, texts: string[]) {
	const source = await queueSource(env.DB, { owner, kind: 'file', title, body: texts.join('\n\n') });
	await saveChunks(env.DB, source!, texts);
	const { results } = await env.DB.prepare('SELECT id FROM chunks WHERE source_id = ? ORDER BY position').bind(source!.id).all<{ id: number }>();
	return results.map((row) => row.id);
}

describe('rrf', () => {
	it('ranks an id found by both lists above ids found by one', () => {
		// 3: 1/63 + 1/61; 1: 1/61; 2 and 4: 1/62 each (a tie keeps first-seen order)
		expect(rrf([[1, 2, 3], [3, 4]])).toEqual([3, 1, 2, 4]);
	});
	it('with one list, keeps its order', () => {
		expect(rrf([[5, 6, 7]])).toEqual([5, 6, 7]);
	});
});

describe('search', () => {
	it('keyword search finds exact words (porter stemming: carrots matches carrot), for this owner only', async () => {
		const [pip, other] = await seed('kai', 'pip.md', ['Pip is my dog. She likes carrots.', 'The router config lives in apps/web.']);
		await seed('lou', 'not-yours.md', ['Lou also has a dog called Pip, who likes carrots.']);
		expect(await keywordSearch(env.DB, 'kai', 'Does Pip like carrot?')).toEqual([pip]);
		expect(await keywordSearch(env.DB, 'kai', 'router')).toEqual([other]);
		expect(await keywordSearch(env.DB, 'kai', '"); DROP TABLE chunks; --')).toEqual([]); // quoted words, no syntax
	});

	it('deleted chunks leave the keyword index (the trigger), and hydrate drops ids that are gone or not yours', async () => {
		const [id] = await seed('max', 'temp.md', ['Temporary zebra fact.']);
		const [notMine] = await seed('ned', 'ned.md', ['Ned zebra.']);
		expect(await keywordSearch(env.DB, 'max', 'zebra')).toEqual([id]);
		await env.DB.prepare('DELETE FROM chunks WHERE id = ?').bind(id).run();
		expect(await keywordSearch(env.DB, 'max', 'zebra')).toEqual([]);
		expect(await hydrate(env.DB, 'max', [id, notMine])).toEqual([]);
	});

	it('GET .../search merges both lists: the chunk found by words and by meaning comes first', async () => {
		const [a, b, c] = await seed('olga', 'trip.md', ['Flight to Lisbon on Friday.', 'Hotel near the river.', 'Pack the passport.']);
		meaning.ids = [c, b]; // as if Vectorize thought "passport" and "hotel" were closest
		const response = await SELF.fetch('https://example.com/agents/klippy/olga/search?q=passport for Lisbon', { headers: { Authorization: 'Bearer test-token' } });
		const { hits } = await response.json<{ hits: { chunkId: number; title: string }[] }>();
		expect(hits.map((hit) => hit.chunkId)).toEqual([c, a, b]); // c is in both lists, a only by words, b only by meaning
		expect(hits[0].title).toBe('trip.md');
		expect((await SELF.fetch('https://example.com/agents/klippy/olga/search?q=x')).status).toBe(401);
	});
});
