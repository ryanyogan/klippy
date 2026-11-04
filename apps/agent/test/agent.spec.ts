import { env, SELF } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

const owner = { Authorization: 'Bearer test-token' };
const say = (id: string, text: string) => ({ id, role: 'user' as const, parts: [{ type: 'text' as const, text }] });

// The conversation one Klippy has stored, read through the agent's built-in /get-messages endpoint.
async function messagesOf(name: string) {
	const response = await SELF.fetch(`https://example.com/agents/klippy/${name}/get-messages`, { headers: owner });
	return response.json<{ role: string; parts: { type: string; text?: string }[] }[]>();
}

describe('Klippy, the agent', () => {
	it('keeps one conversation per name', async () => {
		fake.model = fakeModel('Hi Alice!');
		const alice = env.Klippy.getByName('alice');
		expect(await alice.saveMessages([say('m1', 'Hi, I am Alice.')])).toMatchObject({ status: 'completed' });

		const messages = await messagesOf('alice');
		expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
		expect(messages[1].parts).toContainEqual(expect.objectContaining({ type: 'text', text: 'Hi Alice!' }));
		expect(await messagesOf('bob')).toEqual([]); // Bob's Klippy has never heard of Alice
	});

	it('sends the whole conversation to the model each turn', async () => {
		fake.model = fakeModel('Noted.', 'You are Carol.');
		const carol = env.Klippy.getByName('carol');
		await carol.saveMessages([say('m1', 'I am Carol.')]);
		await carol.saveMessages((messages) => [...messages, say('m2', 'Who am I?')]);
		const prompt = fake.model.doStreamCalls[1].prompt;
		expect(prompt.filter((m) => m.role !== 'system').map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
	});

	it('refuses a message over 2,000 characters without calling the model', async () => {
		fake.model = fakeModel('should not be called');
		await env.Klippy.getByName('dave').saveMessages([say('m1', 'a'.repeat(2001))]);
		expect(fake.model.doStreamCalls).toHaveLength(0);
		const [, reply] = await messagesOf('dave');
		expect(reply.parts).toContainEqual(expect.objectContaining({ text: expect.stringContaining('over 2000 characters') }));
	});

	it.each([
		['no token', 'https://example.com/agents/klippy/alice/get-messages'],
		['a wrong token', 'https://example.com/agents/klippy/alice/get-messages?token=nope'],
		// The right token, but in the URL of a plain HTTP request: only a WebSocket may send it that way.
		['the token in the URL of an HTTP request', 'https://example.com/agents/klippy/alice/get-messages?token=test-token'],
	])('refuses %s with a 401', async (_name, url) => {
		expect((await SELF.fetch(url)).status).toBe(401);
	});

	it('refuses the token in the URL on /ask too', async () => {
		const response = await SELF.fetch('https://example.com/ask?token=test-token', { method: 'POST', body: '{"question": "Hi"}' });
		expect(response.status).toBe(401);
	});

	it('takes the token in the URL when the request opens a WebSocket', async () => {
		const open = (query: string) => SELF.fetch(`https://example.com/agents/klippy/alice${query}`, { headers: { Upgrade: 'websocket' } });
		expect((await open('')).status).toBe(401);
		expect((await open('?token=nope')).status).toBe(401);
		const response = await open('?token=test-token');
		expect(response.status).toBe(101);
		response.webSocket?.accept();
		response.webSocket?.close();
	});
});
