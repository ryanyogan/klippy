import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// `pnpm eval:retrieval`: measures search quality with the REAL Workers AI and Vectorize (remote bindings on), so it
// needs `wrangler login` and costs a few embedding and rerank calls. It is not part of `pnpm test` or CI.
export default defineConfig({
	test: { include: ['test/eval/**/*.eval.ts'] },
	plugins: [
		cloudflareTest(async () => ({
			wrangler: { configPath: './wrangler.jsonc' },
			remoteBindings: true,
			miniflare: {
				bindings: {
					KLIPPY_TOKEN: 'test-token',
					TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, '../../packages/db/migrations')),
				},
			},
		})),
	],
});
