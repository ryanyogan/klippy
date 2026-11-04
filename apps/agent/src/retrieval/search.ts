import { rrf } from './rrf';
import { vectorSearch } from './vectors';

// The chunk ids that share words with the question, best first (bm25), from this owner's chunks only.
export async function keywordSearch(d1: D1Database, owner: string, question: string, limit = 20): Promise<number[]> {
	// Each word in quotes, joined by OR: FTS5 treats quoted text as plain words, so the question can't inject syntax.
	const words = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
	if (words.length === 0) return [];
	const match = [...new Set(words)].map((word) => `"${word}"`).join(' OR ');
	const { results } = await d1
		.prepare('SELECT c.id FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid WHERE chunks_fts MATCH ? AND c.owner = ? ORDER BY rank LIMIT ?')
		.bind(match, owner, limit)
		.all<{ id: number }>();
	return results.map((row) => row.id);
}

export type Hit = { chunkId: number; sourceId: number; title: string; url: string | null; kind: string; context: string; text: string };

// Hybrid search: keywords (exact names, codes, rare words) and meaning (paraphrases), merged by rank.
export async function hybridSearch(env: Env, owner: string, question: string, limit = 10): Promise<Hit[]> {
	const [byWords, byMeaning] = await Promise.all([keywordSearch(env.DB, owner, question), vectorSearch(env, owner, question)]);
	const ids = rrf([byWords, byMeaning]).slice(0, limit);
	return hydrate(env.DB, owner, ids);
}

// The chunks behind the ids, with their sources, in the same order. A vector whose chunk is gone is dropped, and so is
// anything that isn't this owner's (the owner check is repeated here, not left to the vector filter alone).
export async function hydrate(d1: D1Database, owner: string, ids: number[]): Promise<Hit[]> {
	if (ids.length === 0) return [];
	const { results } = await d1
		.prepare(
			`SELECT c.id AS chunkId, s.id AS sourceId, s.title, s.url, s.kind, c.context, c.text FROM chunks c JOIN sources s ON s.id = c.source_id
			 WHERE c.owner = ? AND c.id IN (SELECT value FROM json_each(?))`,
		)
		.bind(owner, JSON.stringify(ids))
		.all<Hit>();
	const byId = new Map(results.map((hit) => [hit.chunkId, hit]));
	return ids.flatMap((id) => byId.get(id) ?? []);
}
