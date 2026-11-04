import type { Klippy } from './agent';

// A daily token budget per Klippy (f-03). The rate limit stops bursts; this stops a slow drip from running up a bill.
// It lives in the agent's own SQLite, so the count is exact: one Klippy, one writer. It's checked before each turn, so a day can go over by up to one turn.

const today = () => new Date().toISOString().slice(0, 10); // the day, in UTC

// Tokens (input + output, every step) this Klippy has spent on a day (today unless you say).
export function tokensToday(agent: Klippy, day = today()) {
	agent.sql`CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, tokens INTEGER NOT NULL)`;
	const [row] = agent.sql<{ tokens: number }>`SELECT tokens FROM usage WHERE day = ${day}`;
	return row?.tokens ?? 0;
}

// Add tokens to a day's total (negative to give some back).
export function spend(agent: Klippy, tokens: number, day = today()) {
	agent.sql`CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, tokens INTEGER NOT NULL)`;
	agent.sql`INSERT INTO usage (day, tokens) VALUES (${day}, ${tokens})
		ON CONFLICT (day) DO UPDATE SET tokens = tokens + ${tokens}`;
}

// Reserve and settle (f-04, f-05): every model call is charged an estimate BEFORE it's made, then corrected to the real
// count when it reports. A call that's cancelled, fails, or reports no count keeps its estimate (fail-closed).
export type Reservation = { day: string; tokens: number };

export function reserve(agent: Klippy, tokens: number): Reservation {
	const reservation = { day: today(), tokens };
	spend(agent, tokens, reservation.day);
	return reservation;
}

// Correct a reservation to what the step really used, on the day it was reserved (a turn can cross midnight).
export function settle(agent: Klippy, reservation: Reservation | undefined, used: number | undefined) {
	if (used === undefined) return; // no count from the provider: keep the estimate
	if (!reservation) return spend(agent, used); // nothing was reserved (shouldn't happen): charge it all, today
	spend(agent, used - reservation.tokens, reservation.day);
}

// What a model call will cost, before it's made: 1 token per 3 characters of what it sends, rounded up. English runs
// nearer 4 characters a token; JSON, code and tool results run closer to 3. Erring high is the safe side.
export function estimateTokens(text: string) {
	return Math.ceil(text.length / 3);
}

// The budget comes from a var in wrangler.jsonc, so you can change it without touching code.
export function dailyBudget(env: Pick<Env, 'DAILY_TOKEN_BUDGET'>) {
	return Number(env.DAILY_TOKEN_BUDGET) || 0;
}
