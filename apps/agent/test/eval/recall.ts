// recall@k: the share of questions whose answer is among the top k results. 1 means every answer was found.
export function recallAt(k: number, results: string[][], answers: string[]) {
	const found = results.filter((titles, i) => titles.slice(0, k).includes(answers[i])).length;
	return found / answers.length;
}
