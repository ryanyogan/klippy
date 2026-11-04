import { describe, expect, it } from 'vitest';
import { recallAt } from './eval/recall';

describe('recallAt', () => {
	it('counts a question as found when its answer is in the top k', () => {
		const results = [['a.md', 'b.md'], ['c.md', 'a.md'], ['d.md']];
		expect(recallAt(1, results, ['a.md', 'a.md', 'x.md'])).toBeCloseTo(1 / 3);
		expect(recallAt(2, results, ['a.md', 'a.md', 'x.md'])).toBeCloseTo(2 / 3);
	});
});
