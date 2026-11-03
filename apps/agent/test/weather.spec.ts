import { SELF } from 'cloudflare:test';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

// Open-Meteo, faked: tests never call the real internet either.
function fakeOpenMeteo() {
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const url = String(input);
		if (url.includes('name=Nowhere')) return Response.json({});
		if (url.startsWith('https://geocoding-api.open-meteo.com/')) {
			return Response.json({ results: [{ name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 }] });
		}
		return Response.json({ current: { temperature_2m: 5.6, weather_code: 3, wind_speed_10m: 6.4 } });
	});
}

function ask(question: string) {
	return SELF.fetch('https://example.com/ask', {
		method: 'POST',
		headers: { Authorization: 'Bearer test-token' },
		body: JSON.stringify({ question }),
	});
}

afterEach(() => vi.restoreAllMocks());

describe('getWeather', () => {
	it('runs when Claude calls it, and Claude answers from the result', async () => {
		fakeOpenMeteo();
		fake.model = fakeModel({ tool: 'getWeather', input: { place: 'Berlin' } }, 'It is 5.6°C and partly cloudy in Berlin.');

		const response = await ask('What is the weather in Berlin?');
		expect(await response.json()).toEqual({ answer: 'It is 5.6°C and partly cloudy in Berlin.' });

		// The second model call carries the tool result back to Claude.
		const toolMessage = fake.model.doGenerateCalls[1].prompt.find((m) => m.role === 'tool');
		expect(JSON.stringify(toolMessage)).toContain('"temperatureC":5.6');
		expect(JSON.stringify(toolMessage)).toContain('partly cloudy');
	});

	it('says so when the place does not exist', async () => {
		fakeOpenMeteo();
		fake.model = fakeModel({ tool: 'getWeather', input: { place: 'Nowhere' } }, 'I could not find that place.');

		await ask('Weather in Nowhere?');
		const toolMessage = fake.model.doGenerateCalls[1].prompt.find((m) => m.role === 'tool');
		expect(JSON.stringify(toolMessage)).toContain("couldn't find a place called Nowhere");
	});
});
