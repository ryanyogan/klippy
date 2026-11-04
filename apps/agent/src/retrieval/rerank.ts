import type { Hit } from './search';

// A reranker reads the question and each passage together and scores how well the passage answers it. Slower than a
// vector lookup, so it only sees the 20 candidates hybrid search found, and keeps the best few.
export const RERANK_MODEL = '@cf/baai/bge-reranker-base';

export async function rerank(env: Env, question: string, hits: Hit[], topK = 5): Promise<(Hit & { score: number })[]> {
	if (hits.length === 0) return [];
	// The generated types leave out `query` (worker-configuration.d.ts, 2026-11-03), though the model needs it: the
	// docs list query, contexts and top_k. Building the input first gets past the excess-property check.
	const input: Ai_Cf_Baai_Bge_Reranker_Base_Input & { query: string } = {
		query: question,
		contexts: hits.map((hit) => ({ text: hit.context ? `${hit.context}\n\n${hit.text}` : hit.text })),
		top_k: topK,
	};
	const result = await env.AI.run(RERANK_MODEL, input);
	const response = 'response' in result ? (result.response ?? []) : [];
	return response
		.flatMap((r) => (r.id !== undefined && hits[r.id] ? [{ ...hits[r.id], score: r.score ?? 0 }] : []))
		.sort((a, b) => b.score - a.score)
		.slice(0, topK);
}
