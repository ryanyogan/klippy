import { tool } from 'ai';
import { z } from 'zod';

// Open-Meteo is free and needs no key (non-commercial use, under 10,000 calls a day).
export const getWeather = tool({
	// The description is a prompt: say what it returns, when to use it, and when not to.
	description:
		'Get the current weather (temperature, wind and conditions) for a city or town. Use it when the user asks about the weather right now or what to wear today. It has no forecasts and no past weather.',
	inputSchema: z.object({
		place: z.string().describe('A city or town, e.g. "Berlin"'),
	}),
	execute: async ({ place }) => {
		// 1. Turn the place name into coordinates.
		const geo = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(place)}`);
		const hit = geo.results?.[0];
		if (!hit) return { error: `I couldn't find a place called ${place}.` };

		// 2. Ask for the current weather there.
		const { current } = await getJson(
			`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
		);
		return {
			place: `${hit.name}, ${hit.country}`,
			temperatureC: current.temperature_2m,
			windKmh: current.wind_speed_10m,
			conditions: describeWeather(current.weather_code),
		};
	},
});

async function getJson(url: string) {
	const response = await fetch(url);
	return response.json<any>();
}

// Open-Meteo sends a WMO weather code. These are the main groups.
function describeWeather(code: number) {
	if (code === 0) return 'clear sky';
	if (code <= 3) return 'partly cloudy';
	if (code <= 48) return 'fog';
	if (code <= 57) return 'drizzle';
	if (code <= 67) return 'rain';
	if (code <= 77) return 'snow';
	if (code <= 82) return 'rain showers';
	if (code <= 86) return 'snow showers';
	return 'thunderstorm';
}
