import { SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

function check(nonce?: string) {
	return SELF.fetch(`https://example.com/klippy/check${nonce === undefined ? '' : `?nonce=${nonce}`}`);
}

describe('GET /klippy/check', () => {
	it('echoes each nonce and names the tag, but asks the model only once in five minutes', async () => {
		fake.model = fakeModel('Hello, bits!');

		const first = await check('abc12345');
		expect(first.status).toBe(200);
		expect(first.headers.get('Cache-Control')).toBe('no-store');
		expect(await first.json()).toEqual({ nonce: 'abc12345', tag: 'a-05', probe: { answer: 'Hello, bits!' } });

		const second = await check('zyx98765');
		expect(await second.json()).toEqual({ nonce: 'zyx98765', tag: 'a-05', probe: { answer: 'Hello, bits!' } });
		expect(fake.model.doGenerateCalls).toHaveLength(1);
		// Anyone can call the check, so its probe gets no tools: it can't write a note.
		expect(fake.model.doGenerateCalls[0].tools ?? []).toEqual([]);
	});

	it('refuses a missing or odd nonce', async () => {
		expect((await check()).status).toBe(400);
		expect((await check('%3Cscript%3E')).status).toBe(400);
	});
});
