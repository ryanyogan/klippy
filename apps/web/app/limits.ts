import { env } from 'cloudflare:workers';
import type { User } from './auth.ts';

// Per-user rate limit for the routes that reach your agent (f-03). Cloudflare's limit is approximate and per location:
// it stops bursts. The firm limit on spending is the agent's daily token budget (an exact count, checked before each turn), kept in its own SQLite.
export async function underUserLimit(user: User) {
	const { success } = await env.USER_LIMITER.limit({ key: `gh-${user.id}` });
	return success;
}

export const tooMany = () => new Response('Too many requests. Wait a minute.', { status: 429 });
