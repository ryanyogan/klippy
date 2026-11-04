import type { Klippy } from './agent';

// A daily token budget per Klippy (f-03). The rate limit stops bursts; this stops a slow drip from running up a bill.
// It lives in the agent's own SQLite, so it's exact: one Klippy, one writer, wherever the request came from.

const today = () => new Date().toISOString().slice(0, 10); // the day, in UTC

// Tokens (input + output, every step) this Klippy has spent today.
export function tokensToday(agent: Klippy) {
	agent.sql`CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, tokens INTEGER NOT NULL)`;
	const [row] = agent.sql<{ tokens: number }>`SELECT tokens FROM usage WHERE day = ${today()}`;
	return row?.tokens ?? 0;
}

// Add a finished turn's tokens to today's total.
export function spend(agent: Klippy, tokens: number) {
	agent.sql`CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, tokens INTEGER NOT NULL)`;
	agent.sql`INSERT INTO usage (day, tokens) VALUES (${today()}, ${tokens})
		ON CONFLICT (day) DO UPDATE SET tokens = tokens + ${tokens}`;
}

// A rough count for text the model hasn't seen yet: about 4 characters a token in English.
export function estimateTokens(text: string) {
	return Math.ceil(text.length / 4);
}

// The budget comes from a var in wrangler.jsonc, so you can change it without touching code.
export function dailyBudget(env: Pick<Env, 'DAILY_TOKEN_BUDGET'>) {
	return Number(env.DAILY_TOKEN_BUDGET) || 0;
}
