# Lane R handoff (2026-11-03)

Lane R builds this repo, the reference for bits' build-along courses (bits `docs/plans/build-along.md`,
decision 071). Read that plan (§1–§5, lane R in §7) and bits `docs/plans/build-along/s0.md` first.

## Goal

One commit and one annotated tag per lesson, in course order (`a-01` … `f-08`). Each tag is green
(typecheck, tests, a `wrangler dev` smoke on port 8801 where relevant) and has its real output in
`docs/outputs/<tag>.txt`. Small steps a beginner can follow. Pinned versions, checked with `npm view` on
the day. Tests never call a real model or the real internet. The repo stays local: no GitHub repo, no push.

## Done

| Tag | Commit | What |
|---|---|---|
| a-01 | c0944e6 | README, MIT licence, `.node-version` |
| a-02 | d5c1a32 | pnpm workspace, `apps/agent` from create-cloudflare 2.74.8 |
| a-03 | f3b80ed | `/` route, `wrangler types`, typecheck script, 2 tests |
| a-04 | 0a1c216 | `POST /ask` via `createAI` (gateway `default`) → `anthropic/claude-haiku-5.5`, **fallback** to Workers AI `@cf/zai-org/glm-4.7-flash`; body checked at runtime (string, trimmed, ≤ 2,000 chars), `messages: [...]`, `maxOutputTokens: 300`; fake model in tests |
| a-05 | 8a467df | logs + traces on; `GET /klippy/check?nonce=` → `{ nonce, tag, probe }`; bearer token (`KLIPPY_TOKEN` secret, `secrets.required`) and the Rate Limiting binding (`LIMITER`, 10/min per address) on `/ask`; the check probe is cached 5 min and a fresh probe needs the shared limiter key `check` |
| — | ea261a1, 6cafd8a, b2cdf6f | `.github/workflows/ci.yml` and `latest.yml` (not lesson tags) |
| b-01 | (note only) | sandbox lesson, no code |
| b-02 | 0599e58 | `getWeather` (Open-Meteo, no key), `tool()` + zod, `isStepCount(2)`; scripted fake model (`fakeModel(...turns)`) |
| b-03 | 6117cee | `onStepEnd` logs one JSON line per step |
| b-04 | 0c15d38 | better descriptions, `getTime`, `test/tools.spec.ts` |

a-04 and a-05 were amended (and re-tagged) after two security reviews from the lead. The notes in
`docs/outputs/a-04.txt` and `a-05.txt` tell the writer what to teach about them.

Verified 2026-11-03: every tag from a-03 to b-04 passes typecheck and tests in a clean worktree
(`git worktree add` + `pnpm install --frozen-lockfile`). a-02 has tests but no typecheck script yet, and
a-01 has no code. Every tag from a-04 to b-04 was smoked live on 8801 (outputs in `docs/outputs/`).

## Next

1. **b-05 is blocked**: B5 (`saveNote` / `listNotes` on D1 with `remix/data-table`) needs the D1 driver.
   Lane P committed `packages/data-table-d1` (npm name `data-table-d1`, 0.1.0) on a bits worktree branch
   (commit 292c38b, branch `worktree-agent-a4831153ac62be727`). It isn't merged or published yet. Once the
   owner runs `npm publish`, check `npm view data-table-d1 version`, then `pnpm add data-table-d1 remix@3.1.0`,
   create `packages/db` (`table()` definitions + `migrations/0001_notes.sql`), and add a D1 binding.
   `wrangler d1 create klippy-db` creates a real resource on the owner's account, so ask first, or use a
   placeholder `database_id` with `--local` (tests use `applyD1Migrations` from `cloudflare:test`).
2. Then b-06 … b-09 (plan §3 B), c-01 … (C3 brings `AIChatAgent` + `@cloudflare/ai-chat` 0.12.2).
3. Bump `TAG` in `apps/agent/src/check.ts` at each checkpoint tag (b-09, c-09, …) and update
   `test/check.spec.ts`.
4. The owner (or a lane with permission) records the live deploy for a-05: the commands are at the top of
   `docs/outputs/a-05.txt`.

## Gotchas

- **Kill dev servers properly.** `pkill -f "wrangler dev --port 8801"` doesn't match the real process
  (`…/wrangler-dist/cli.js dev --port 8801`). Kill the `timeout`, `wrangler.js` and `cli.js` processes, then
  check with `ps aux | grep -- "--port 8801"`. A leftover server hot-reloads new code and muddles the log.
- **No Anthropic key on the recording account's `default` gateway.** Claude calls fail with
  `CloudflareAIError: Insufficient balance; add money to your gateway or use BYOK`, so every recording so
  far was answered by the Workers AI fallback, and each output file says so. Re-record with Claude once the
  owner stores a key (BYOK) on the gateway.
- **ai 7.0.162 renames.** `isStepCount` (not `stepCountIs`), `onStepEnd` (not `onStepFinish`, now a
  deprecated alias). The installed `agents/docs/models.md` documents `fallback`, `reasoningEffort: null`,
  and the `default` gateway that's created on first use.
- **Tests.** `@cloudflare/vitest-plugin` 1.5.1 + vitest 5.0.5 (the a-02 lane chose these over the plan's
  pool 0.23 + vitest 4.1). `remoteBindings: false`. `KLIPPY_TOKEN` comes from `miniflare.bindings` in
  `vitest.config.mts`. The model is mocked with `vi.mock('../src/model')` + `vi.hoisted`. Open-Meteo is
  mocked with `vi.spyOn(globalThis, 'fetch')`. The rate limiter really counts in Miniflare (there's a test).
  `fakeModel('x')` repeats one turn forever; with several turns it plays them in order.
- `apps/agent/.dev.vars` (gitignored) holds `KLIPPY_TOKEN=demo-token-for-the-recording` for the recordings.
- pnpm is 10.34.9 (`packageManager`), and `pnpm-workspace.yaml` uses `onlyBuiltDependencies`.
- Not verified: GitHub Actions never ran (no GitHub repo), and actionlint was denied by the permission
  classifier. The workflows parse as YAML, and their steps were run by hand locally.
