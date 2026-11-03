import { SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import { fakeModel } from './fake-model';

// Swap the real model for the fake one, so tests are offline and free.
const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

function ask(body: string) {
	return SELF.fetch('https://example.com/ask', { method: 'POST', body });
}

describe('POST /ask', () => {
	it('answers a question, with a cap on the reply', async () => {
		fake.model = fakeModel('Hello from the fake model.');
		const response = await ask(JSON.stringify({ question: '  Who are you?  ' }));
		expect(await response.json()).toEqual({ answer: 'Hello from the fake model.' });

		const call = fake.model.doGenerateCalls[0];
		expect(call.maxOutputTokens).toBe(300);
		expect(call.prompt.at(-1)).toMatchObject({ role: 'user', content: [{ type: 'text', text: 'Who are you?' }] });
	});

	it.each([
		['no body', ''],
		['no question', '{}'],
		['a question that is not a string', '{"question": 42}'],
		['a blank question', '{"question": "   "}'],
		['a question over 2,000 characters', JSON.stringify({ question: 'a'.repeat(2001) })],
	])('refuses %s with a 400', async (_name, body) => {
		const response = await ask(body);
		expect(response.status).toBe(400);
	});
});
