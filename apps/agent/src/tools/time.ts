import { tool } from 'ai';
import { z } from 'zod';

// Models don't know what time it is. This tool tells them.
export const getTime = tool({
	description:
		"Get the current date and time in a time zone. Use it whenever the answer depends on today's date or the time somewhere: you don't know the current time otherwise.",
	inputSchema: z.object({
		timeZone: z.string().describe('An IANA time zone, e.g. "Europe/Berlin" or "America/New_York"'),
	}),
	execute: async ({ timeZone }) => ({
		timeZone,
		now: new Date().toLocaleString('en-GB', { timeZone, dateStyle: 'full', timeStyle: 'short' }),
	}),
});
