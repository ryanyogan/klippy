import { SELF } from 'cloudflare:test';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

function ask(question: string) {
	return SELF.fetch('https://example.com/ask', {
		method: 'POST',
		headers: { Authorization: 'Bearer test-token' },
		body: JSON.stringify({ question }),
	});
}

afterEach(() => vi.restoreAllMocks());

// A fake model can't judge your descriptions: that's what the sandbox exercise is for.
// These tests check your side of the deal: what Claude is shown, and that nothing runs unless it asks.
describe('tools', () => {
	it('sends every tool to the model, with their descriptions', async () => {
		fake.model = fakeModel('4');
		await ask("What's 2+2?");
		const tools = fake.model.doGenerateCalls[0].tools ?? [];
		expect(tools.map((t) => t.name)).toEqual(['getWeather', 'getTime', 'saveNote', 'listNotes', 'readLink']);
		expect(tools.every((t) => t.type === 'function' && (t.description ?? '').length > 40)).toBe(true);
	});

	it("runs no tool when the model answers straight away (\"what's 2+2?\")", async () => {
		const fetch = vi.spyOn(globalThis, 'fetch');
		fake.model = fakeModel('2 + 2 is 4.');
		const response = await ask("What's 2+2?");
		expect(await response.json()).toEqual({ answer: '2 + 2 is 4.' });
		expect(fetch).not.toHaveBeenCalled();
		expect(fake.model.doGenerateCalls).toHaveLength(1);
	});

	it('getTime tells the model the time in a time zone', async () => {
		fake.model = fakeModel({ tool: 'getTime', input: { timeZone: 'Asia/Tokyo' } }, 'It is evening in Tokyo.');
		await ask('What time is it in Tokyo?');
		const toolMessage = JSON.stringify(fake.model.doGenerateCalls[1].prompt.find((m) => m.role === 'tool'));
		expect(toolMessage).toContain('Asia/Tokyo');
		expect(toolMessage).toMatch(/\d{1,2}:\d{2}/);
	});
});
