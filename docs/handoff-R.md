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
| — | 396a1df | `packages/data-table-d1` copied from bits (src, tests, README, LICENSE); apps use `workspace:*` |
| b-05 | 1a3615f | `packages/db` (`notes` table + `migrations/0001_notes.sql`), D1 `DB` = `klippy-db` (`e51fc5ce-…`), `saveNote` / `listNotes` (`noteTools(env.DB)`), `/klippy/check` probe gets no tools |
| b-06 | (see `git log`) | `toolChoice: 'auto'` on `/ask`; `POST /note` forces `saveNote` (`isStepCount(1)`); shared `guardedText()` (token, limit, 2,000 chars) |
| b-07 | (see `git log`) | zod `.refine` on `timeZone`; weather HTTP errors thrown → tool-error results; `toolErrors` in the step log. **No `strict`**: agents 0.33.0 `createAI` drops it |
| b-08 | 85b5961 | `readLink` = `webFetchTool` (pageChars 8000, maxRedirects 0) wrapped to allow only the exact links in the question; `prepareStep` drops note tools after a page read (lethal trifecta); `preview()` in logs. Amended twice after security reviews |
| b-09 | 8bf953b | checkpoint: `TAG = 'b-09'`, `isStepCount(3)` + honest "ran out of steps" answer; remote D1 schema applied; deploy dry-run only |
| c-01 | 9e46c1b | sandbox lesson, note only |

a-04 and a-05 were amended (and re-tagged) after two security reviews from the lead. The notes in
`docs/outputs/a-04.txt` and `a-05.txt` tell the writer what to teach about them.

Verified 2026-11-03: every tag from a-03 to b-09 passes typecheck and tests in a clean worktree
(`git worktree add` + `pnpm install --frozen-lockfile`). a-02 has tests but no typecheck script yet, and
a-01 has no code. Every tag from a-04 to b-04 was smoked live on 8801 (outputs in `docs/outputs/`).

## Next

1. **c-02** (write the loop by hand, once): `scripts/loop.ts` with `@anthropic-ai/sdk` + `tsx` (dev deps), ~30 lines,
   then deleted in the same lesson (so the tag likely holds it, and c-03 removes it, or the tag shows it and the note
   says "delete it"). Blocker: a live run needs a real Anthropic key (the `default` gateway has none; unified billing
   says "Insufficient balance"). Options: record with the owner's key later, or run it once against the gateway's
   Anthropic endpoint after BYOK. Don't fake the output. Check `npm view @anthropic-ai/sdk version` and `tsx` that day.
2. c-03 … c-09 (plan §3 C): `AIChatAgent` from `@cloudflare/ai-chat` 0.12.2 (S0 report has the working shape),
   `durable_objects` + `new_sqlite_classes`, `routeAgentRequest`; terminal chat `scripts/chat.ts` (`agents/client`);
   `remember`/`forget` in agent SQL; `needsApproval` on `saveNote`; caps (`prepareStep`); `schedule()`. Bump `TAG` to
   `c-09` at the checkpoint. Keep the b-08 rules when readLink moves into the agent (exact links, no redirects, no notes
   tools after a page read) and the token / limit / caps on every route that spends model or D1 budget.
3. The owner (or a lane allowed to deploy) records the live deploys for a-05 and b-09: commands at the top of
   `docs/outputs/a-05.txt` and `b-09.txt`. The remote `klippy-db` schema is applied (0001_notes).

## Gotchas

- **The D1 driver** is `packages/data-table-d1` (copied from bits, owner 2026-11-03: not on npm "for now"). Its imports
  end in `.ts`, so `apps/agent/tsconfig.json` has `allowImportingTsExtensions`. Its 24 tests run with `remix test` on
  Miniflare inside `pnpm test` (no extra CI job). Lesson notes say only "the driver is included in the repo".
- **D1 in tests**: `vitest.config.mts` passes `TEST_MIGRATIONS` (`readD1Migrations`), and each spec that needs tables
  calls `applyD1Migrations` in `beforeAll`. A `setupFiles` entry broke `vi.mock('../src/model')` (it loaded the worker
  first), so don't use one. A `Response` for a fetch spy must be made inside `mockImplementation`, not
  `mockResolvedValue` (cross-request I/O error).
- **Scratch helpers** (recreate if gone): a kill script for 8801 and a clean-worktree verifier
  (`git worktree add --detach`, `pnpm install --frozen-lockfile`, typecheck, test, remove).
- The local D1 (`apps/agent/.wrangler`) holds notes from earlier recordings, so list outputs show old ids. Fine, but say so.

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
