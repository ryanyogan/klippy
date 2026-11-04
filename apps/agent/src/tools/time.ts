import { tool } from 'ai';
import { z } from 'zod';

// Models don't know what time it is. This tool tells them.
export const getTime = tool({
	description:
		"Get the current date and time in a time zone. Use it whenever the answer depends on today's date or the time somewhere: you don't know the current time otherwise.",
	inputSchema: z.object({
		timeZone: z
			.string()
			.describe('An IANA time zone, e.g. "Europe/Berlin" or "America/New_York"')
			// The schema Claude sees says "a string". This check runs in your code, after Claude calls.
			.refine(isTimeZone, 'Not an IANA time zone. Use a name like "Europe/Berlin".'),
	}),
	execute: async ({ timeZone }) => ({
		timeZone,
		now: new Date().toLocaleString('en-GB', { timeZone, dateStyle: 'full', timeStyle: 'short' }),
	}),
});

function isTimeZone(timeZone: string) {
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone });
		return true;
	} catch {
		return false; // Intl throws a RangeError for a zone it doesn't know
	}
}
