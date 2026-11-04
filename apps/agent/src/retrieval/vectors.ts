// The embedding model from Cloudflare's Vectorize tutorial: 768 numbers per text, compared by cosine.
// The index was created to match: wrangler vectorize create klippy-notes --dimensions=768 --metric=cosine
export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

// Turn texts into vectors with Workers AI (the model accepts a batch of texts per call).
export async function embed(env: Env, texts: string[]): Promise<number[][]> {
	const result = await env.AI.run(EMBEDDING_MODEL, { text: texts });
	if (!('data' in result) || !result.data) throw new Error('No embeddings came back');
	return result.data;
}

export type ChunkRow = { id: number; owner: string; source_id: number; context?: string; text: string };

// Store one vector per chunk. The id ties it to the chunk row in D1, and the metadata says whose it is,
// so a search can ask for one Klippy's chunks only (owner has a metadata index). Upsert: a retry overwrites.
// prefix: the vector id is <prefix><chunk id>. The app uses 'chunk-'; the eval uses its own, so its ids are its own.
export async function upsertChunks(env: Env, rows: ChunkRow[], prefix = 'chunk-') {
	if (rows.length === 0) return 0;
	// The context sentence goes in front of the chunk, so the vector carries where the chunk came from.
	const vectors = await embed(env, rows.map((row) => (row.context ? `${row.context}\n\n${row.text}` : row.text)));
	await env.VECTORIZE.upsert(
		rows.map((row, i) => ({ id: `${prefix}${row.id}`, values: vectors[i], metadata: { owner: row.owner, sourceId: row.source_id } })),
	);
	return rows.length;
}

// The chunk ids whose meaning is closest to the question, from this owner's vectors only.
export async function vectorSearch(env: Env, owner: string, question: string, topK = 20): Promise<number[]> {
	const [vector] = await embed(env, [question]);
	const { matches } = await env.VECTORIZE.query(vector, { topK, filter: { owner } });
	return matches.map((match) => Number(/(\d+)$/.exec(match.id)?.[1])).filter(Number.isInteger); // the chunk id ends the vector id
}
