import { tool } from 'ai';
import { z } from 'zod';
import type { Klippy } from '../agent';

// Each reminder wakes Klippy and costs a model turn, so keep them few and soon: 10 waiting, at most a week ahead,
// and at most 20 that fire per day (counted in nudge()).
export const MAX_REMINDERS = 10;
export const MAX_NUDGES_PER_DAY = 20;

export function remindTools(agent: Klippy) {
	const remindMe = tool({
		description:
			'Remind the user about something later: Klippy wakes up and messages them. Work out the delay in minutes first (use getTime if the user names a clock time).',
		inputSchema: z.object({
			minutes: z.number().int().min(1).max(7 * 24 * 60).describe('How many minutes from now'),
			message: z.string().trim().min(1).max(200).describe('What to remind them about, e.g. "Call Sam"'),
		}),
		execute: async ({ minutes, message }) => {
			if ((await agent.listSchedules()).length >= MAX_REMINDERS) return { error: `${MAX_REMINDERS} reminders are already waiting.` };
			// schedule() stores the task in this Klippy's SQLite and sets a Durable Object alarm. When it's due,
			// Cloudflare wakes this Klippy and calls its nudge() method with the payload.
			const { id } = await agent.schedule(minutes * 60, 'nudge', { message });
			return { scheduled: { id, inMinutes: minutes, message } };
		},
	});
	return { remindMe };
}
