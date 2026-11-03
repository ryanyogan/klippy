import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			// Tests never call real models: they stay offline and free.
			remoteBindings: false,
			// A known token for tests (your real one lives in .dev.vars and in Cloudflare's secrets).
			miniflare: { bindings: { KLIPPY_TOKEN: "test-token" } },
		}),
	],
});
