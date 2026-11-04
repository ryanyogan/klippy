import { ask } from './ask';
import { underLimit } from './guard';

// The lesson tag this code is at. bits reads it to see how far your Klippy has come.
export const TAG = 'd-11';

const NONCE = /^[A-Za-z0-9_-]{8,64}$/;
const FIVE_MINUTES = 5 * 60 * 1000;

// The probe answer is the same for every caller, so ask the model at most once every five minutes.
let cached: { probe: Awaited<ReturnType<typeof ask>>; at: number } | undefined;

// GET /klippy/check?nonce=...: bits calls this to check that your Klippy is live.
// Anyone can call it, so it must never spend more than a few model calls, whoever asks,
// and its probe gets no tools ({}): a public route never writes to your database.
export async function check(url: URL, env: Env) {
	const nonce = url.searchParams.get('nonce') ?? '';
	if (!NONCE.test(nonce)) {
		return Response.json({ error: 'Send ?nonce= (8 to 64 letters, digits, - or _)' }, { status: 400 });
	}
	if (!cached || Date.now() - cached.at > FIVE_MINUTES) {
		// One shared key for everyone: at most 10 fresh probes a minute in total.
		if (!(await underLimit(env, 'check'))) {
			return Response.json({ error: 'Too many checks. Wait a minute.' }, { status: 429 });
		}
		cached = { probe: await ask(env, 'Say hello to bits in one short sentence.', {}), at: Date.now() };
	}
	return Response.json({ nonce, tag: TAG, probe: cached.probe }, { headers: { 'Cache-Control': 'no-store' } });
}
