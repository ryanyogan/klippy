// Two locks for a public Worker that spends your own model budget.

// 1. Only you: /ask needs "Authorization: Bearer <KLIPPY_TOKEN>". The token is a Worker secret.
export async function isOwner(request: Request, env: Env) {
	if (!env.KLIPPY_TOKEN) return false; // no token set: the door stays shut
	const sent = request.headers.get('Authorization') ?? '';
	const [a, b] = await Promise.all([sha256(sent), sha256(`Bearer ${env.KLIPPY_TOKEN}`)]);
	return crypto.subtle.timingSafeEqual(a, b); // compare in constant time, so timing leaks nothing
}

// 2. Not too often: at most 10 model calls a minute per key (an address, or one shared name).
export async function underLimit(env: Env, key: string) {
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
