import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Guard: the eval writes and deletes vectors, so it runs only against an index whose name ends in -eval.
// (Before e-09 it used the real VECTORIZE index, and could overwrite and delete real chunks: never run e-08's eval.)
const config = readFileSync(path.join(import.meta.dirname, 'wrangler.jsonc'), 'utf8');
const evalIndex = /"binding":\s*"VECTORIZE_EVAL",\s*"index_name":\s*"([^"]+)"/.exec(config)?.[1] ?? '';
if (!evalIndex.endsWith('-eval')) throw new Error(`VECTORIZE_EVAL must point at an index named *-eval (found "${evalIndex}")`);

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
					EVAL_INDEX: evalIndex,
					TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, '../../packages/db/migrations')),
				},
			},
		})),
	],
});
