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

// What the second model call was told about the tool call: a result, or an error.
function toolMessage() {
	return JSON.stringify(fake.model!.doGenerateCalls[1].prompt.find((m) => m.role === 'tool'));
}

afterEach(() => vi.restoreAllMocks());

describe('strict inputs, honest failures', () => {
	it('refuses a time zone that does not exist, and tells Claude why', async () => {
		fake.model = fakeModel({ tool: 'getTime', input: { timeZone: 'Mars/Olympus_Mons' } }, 'I do not know that time zone.');
		const response = await ask('What time is it on Mars?');
		expect(response.status).toBe(200);
		expect(toolMessage()).toContain('Not an IANA time zone');
	});

	it('tells Claude when the weather service is down, instead of crashing', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad gateway', { status: 502 }));
		fake.model = fakeModel({ tool: 'getWeather', input: { place: 'Berlin' } }, 'The weather service is down right now.');
		const response = await ask('Weather in Berlin?');
		expect(await response.json()).toEqual({ answer: 'The weather service is down right now.' });
		expect(toolMessage()).toContain('The weather service is not answering (HTTP 502)');
	});
});
