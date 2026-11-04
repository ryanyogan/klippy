import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest(async () => ({
			wrangler: { configPath: './wrangler.jsonc' },
			// Tests never call real models: they stay offline and free.
			remoteBindings: false,
			miniflare: {
				bindings: {
					// A known token for tests (your real one lives in .dev.vars and in Cloudflare's secrets).
					KLIPPY_TOKEN: 'test-token',
					// The SQL migrations, so a test can build the tables in its local database.
					TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, '../../packages/db/migrations')),
				},
			},
		})),
	],
});
