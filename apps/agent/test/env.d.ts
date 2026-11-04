import type { D1Migration } from 'cloudflare:test';

// The test-only binding from vitest.config.mts.
declare global {
	namespace Cloudflare {
		interface Env {
			TEST_MIGRATIONS: D1Migration[];
			EVAL_INDEX?: string; // vitest.eval.config.mts only
		}
	}
}
