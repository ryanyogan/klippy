// Reciprocal rank fusion: merge ranked lists by position, not by score. Keyword scores (bm25) and cosine scores
// aren't comparable, but "2nd in one list, 1st in the other" is. Each id earns 1 / (k + rank) from every list it's in;
// k = 60 is the value from the original paper, and it keeps one list's top spot from drowning out the rest.
export function rrf(lists: number[][], k = 60): number[] {
	const scores = new Map<number, number>();
	for (const list of lists) {
		list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
	}
	return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
