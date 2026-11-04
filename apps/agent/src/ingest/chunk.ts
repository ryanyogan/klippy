// About 300 tokens per chunk: small enough to be precise, well under the embedding model's 512-token limit.
export const CHUNK_CHARS = 1200;
// The end of one chunk is repeated at the start of the next, so a sentence cut at the border is whole in one of them.
export const OVERLAP = 200;

// Cut Markdown into chunks along its structure: paragraphs are kept whole, and a heading always starts a new chunk.
export function chunk(markdown: string): string[] {
	const pieces = markdown
		.split(/\n\s*\n/) // paragraphs (a blank line between them)
		.map((p) => p.trim())
		.filter(Boolean)
		.flatMap((p) => p.match(new RegExp(`[^]{1,${CHUNK_CHARS}}`, 'g')) ?? []); // a giant paragraph is cut by length
	const chunks: string[] = [];
	let current = '';
	for (const piece of pieces) {
		const heading = piece.startsWith('#');
		if (current && (heading || current.length + piece.length > CHUNK_CHARS)) {
			chunks.push(current);
			current = heading ? '' : current.slice(-OVERLAP).replace(/^\S*\s+/, ''); // the overlap, from a word boundary
		}
		current = current ? `${current}\n\n${piece}` : piece;
	}
	if (current) chunks.push(current);
	return chunks;
}
