import { SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import { fakeModel } from './fake-model';

// Swap the real model for the fake one, so tests are offline and free.
const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

function ask(body: string, headers: Record<string, string> = { Authorization: 'Bearer test-token' }) {
	return SELF.fetch('https://example.com/ask', { method: 'POST', body, headers });
}

describe('POST /ask', () => {
	it('answers a question, with a cap on the reply', async () => {
		fake.model = fakeModel('Hello from the fake model.');
		const response = await ask(JSON.stringify({ question: '  Who are you?  ' }));
		expect(await response.json()).toEqual({ answer: 'Hello from the fake model.' });

		const call = fake.model.doGenerateCalls[0];
		expect(call.maxOutputTokens).toBe(300);
		expect(call.toolChoice).toEqual({ type: 'auto' }); // Claude decides whether to use a tool
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

	it.each([
		['no token', {}],
		['a wrong token', { Authorization: 'Bearer nope' }],
		['the token without "Bearer"', { Authorization: 'test-token' }],
	])('refuses %s with a 401', async (_name, headers: Record<string, string>) => {
		const response = await ask('{"question": "hi"}', headers);
		expect(response.status).toBe(401);
	});

	it('allows 10 questions a minute from one address, then answers 429', async () => {
		fake.model = fakeModel('ok');
		const headers = { Authorization: 'Bearer test-token', 'cf-connecting-ip': '203.0.113.7' };
		const statuses = [];
		for (let i = 0; i < 11; i++) statuses.push((await ask('{"question": "hi"}', headers)).status);
		expect(statuses).toEqual([...Array(10).fill(200), 429]);
	});
});
