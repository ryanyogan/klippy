import { applyD1Migrations, env } from 'cloudflare:test';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chunk } from '../../src/ingest/chunk';
import { queueSource, saveChunks } from '../../src/ingest/sources';
import { rerank } from '../../src/retrieval/rerank';
import { hybridSearch, hydrate, keywordSearch } from '../../src/retrieval/search';
import { type ChunkRow, upsertChunks, vectorSearch } from '../../src/retrieval/vectors';
import { documents, questions } from './corpus';
import { recallAt } from './recall';

// A real measurement, not a test: real Workers AI embeddings and reranker, the real Vectorize index (vitest.eval.config
// turns remote bindings on), and a local D1. Its vectors use a fresh owner, deleted at the end. No chat model is called.
const owner = `eval-${Date.now()}`;
const ids: string[] = [];

beforeAll(async () => {
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
	for (const [title, body] of Object.entries(documents)) {
		const source = await queueSource(env.DB, { owner, kind: 'file', title, body });
		await saveChunks(env.DB, source!, chunk(body));
		const { results } = await env.DB.prepare('SELECT id, owner, source_id, context, text FROM chunks WHERE source_id = ?').bind(source!.id).all<ChunkRow>();
		await upsertChunks(env, results);
		ids.push(...results.map((row) => `chunk-${row.id}`));
	}
	// Vectorize is eventually consistent: wait until a search sees this owner's vectors (up to 3 minutes).
	for (let i = 0; i < 36 && (await vectorSearch(env, owner, 'Pip')).length === 0; i++) await new Promise((r) => setTimeout(r, 5000));
}, 240_000);

afterAll(async () => {
	await env.VECTORIZE.deleteByIds(ids);
});

it('recall@5 over 12 questions', async () => {
	const titles = async (chunkIds: number[]) => (await hydrate(env.DB, owner, chunkIds)).map((hit) => hit.title);
	const keyword: string[][] = [], vector: string[][] = [], hybrid: string[][] = [], reranked: string[][] = [];
	for (const { q } of questions) {
		keyword.push(await titles((await keywordSearch(env.DB, owner, q)).slice(0, 5)));
		vector.push(await titles((await vectorSearch(env, owner, q)).slice(0, 5)));
		const candidates = await hybridSearch(env, owner, q, 20);
		hybrid.push(candidates.slice(0, 5).map((hit) => hit.title));
		reranked.push((await rerank(env, q, candidates, 5)).map((hit) => hit.title));
	}
	const answers = questions.map((question) => question.answer);
	const report = {
		'keywords only': recallAt(5, keyword, answers),
		'vectors only': recallAt(5, vector, answers),
		hybrid: recallAt(5, hybrid, answers),
		'hybrid + rerank': recallAt(5, reranked, answers),
		'hybrid + rerank, recall@1': recallAt(1, reranked, answers),
	};
	for (const [name, value] of Object.entries(report)) console.log(`${name.padEnd(27)} ${value.toFixed(2)}`);
	questions.forEach(({ q, answer }, i) => console.log(`${reranked[i][0] === answer ? 'ok  ' : 'MISS'} ${q} -> ${reranked[i][0] ?? '(nothing)'}`));
	expect(report['hybrid + rerank']).toBeGreaterThanOrEqual(0.75); // the bar for this corpus; raise it as you tune
}, 120_000);
