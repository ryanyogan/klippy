// Two locks for a Worker that spends your own model budget. Since f-01 it has no public address, and the token stays
// as the second lock: anything that does reach it (the web app, `wrangler dev`) must still prove it's you.

// 1. Only you: send "Authorization: Bearer <KLIPPY_TOKEN>". The token is a Worker secret.
// allowQuery: a WebSocket can't send that header, so the agent's socket alone may send ?token=<KLIPPY_TOKEN>.
// Never anywhere else: a URL ends up in logs and browser history, a header doesn't.
export async function isOwner(request: Request, env: Env, allowQuery = false) {
	if (!env.KLIPPY_TOKEN) return false; // no token set: the door stays shut
	const token = allowQuery ? new URL(request.url).searchParams.get('token') : null;
	const sent = token ? `Bearer ${token}` : (request.headers.get('Authorization') ?? '');
	const [a, b] = await Promise.all([sha256(sent), sha256(`Bearer ${env.KLIPPY_TOKEN}`)]);
	return crypto.subtle.timingSafeEqual(a, b); // compare in constant time, so timing leaks nothing
}

// 2. Not too often: at most 10 model calls a minute per key (an address, or one shared name).
export async function underLimit(env: Pick<Env, 'LIMITER'>, key: string) {
	const { success } = await env.LIMITER.limit({ key });
	return success;
}

// The caller's address, as Cloudflare saw it ("local" in tests and some dev setups).
export function clientAddress(request: Request) {
	return request.headers.get('cf-connecting-ip') ?? 'local';
}

async function sha256(text: string) {
	return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}
