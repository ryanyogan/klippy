import { describe, expect, it } from 'vitest';
import { chunk, CHUNK_CHARS, OVERLAP } from '../src/ingest/chunk';

const words = (n: number, word = 'oat') => Array.from({ length: n }, (_, i) => `${word}${i}`).join(' ');

describe('chunk', () => {
	it('keeps a short text as one chunk', () => {
		expect(chunk('# Pip\n\nPip is my dog.')).toEqual(['# Pip\n\nPip is my dog.']);
	});

	it('starts a new chunk at every heading', () => {
		expect(chunk('# One\n\nFirst part.\n\n## Two\n\nSecond part.')).toEqual(['# One\n\nFirst part.', '## Two\n\nSecond part.']);
	});

	it('packs paragraphs up to the size, and repeats the end of one chunk at the start of the next', () => {
		const paragraphs = Array.from({ length: 6 }, (_, i) => words(60, `p${i}w`)); // about 400 chars each
		const result = chunk(paragraphs.join('\n\n'));
		expect(result.length).toBeGreaterThan(1);
		for (const piece of result) expect(piece.length).toBeLessThanOrEqual(CHUNK_CHARS + OVERLAP);
		const tail = result[0].slice(-50);
		expect(result[1]).toContain(tail); // the overlap
		expect(result.at(-1)).toContain(paragraphs.at(-1)); // nothing lost at the end
	});

	it('cuts one giant paragraph by length', () => {
		expect(chunk('x'.repeat(CHUNK_CHARS * 2 + 10)).length).toBe(3);
	});
});
