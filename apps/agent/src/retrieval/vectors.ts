// The embedding model from Cloudflare's Vectorize tutorial: 768 numbers per text, compared by cosine.
// The index was created to match: wrangler vectorize create klippy-notes --dimensions=768 --metric=cosine
export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

// Turn texts into vectors with Workers AI, up to 100 texts per call.
export async function embed(env: Env, texts: string[]): Promise<number[][]> {
	const result = await env.AI.run(EMBEDDING_MODEL, { text: texts });
	if (!('data' in result) || !result.data) throw new Error('No embeddings came back');
	return result.data;
}

export type ChunkRow = { id: number; owner: string; source_id: number; text: string };

// Store one vector per chunk. The id ties it to the chunk row in D1, and the metadata says whose it is,
// so a search can ask for one Klippy's chunks only (owner has a metadata index). Upsert: a retry overwrites.
export async function upsertChunks(env: Env, rows: ChunkRow[]) {
	if (rows.length === 0) return 0;
	const vectors = await embed(env, rows.map((row) => row.text));
	await env.VECTORIZE.upsert(
		rows.map((row, i) => ({ id: `chunk-${row.id}`, values: vectors[i], metadata: { owner: row.owner, sourceId: row.source_id } })),
	);
	return rows.length;
}
