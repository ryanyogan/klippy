import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('Klippy', () => {
	it('says hi at /', async () => {
		const response = await SELF.fetch('https://example.com/');
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('Hi, I am Klippy.');
	});

	it('answers 404 for anything else', async () => {
		const response = await SELF.fetch('https://example.com/nope');
		expect(response.status).toBe(404);
	});
});
