# Lane R handoff (2026-11-03, after c-09)

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
| c-02 | 528e377 | `scripts/loop.ts` (30 lines, `@anthropic-ai/sdk` 1.4.0 + `tsx` 4.23.15 dev deps, `claude-haiku-5-5`), fake-client test; `"type": "module"` in apps/agent. **Live run PENDING** (no key) |
| c-03 | 3a08324 | loop script deleted; `@cloudflare/ai-chat` 0.12.2, `nodejs_compat`, DO `Klippy` + migration v1, `Klippy extends AIChatAgent`, `/agents/*` behind the token. Amended after security review: `?token=` only on the WebSocket upgrade, stripped before routing |
| c-04 | 6d6c2b2 | `pnpm chat <name>`: `scripts/chat.ts` (AgentClient + WebSocketChatTransport + readUIMessageStream) |
| c-05 | 9ab10c6 | `remember` / `forget` (facts table in agent SQL, 50 × 200 chars), facts in the system prompt per turn, `/clear` |
| c-06 | 99ad5c4 | notes tools in the agent, `saveNote` with `needsApproval`; the terminal answers y/n (`cf_agent_tool_approval` + continuation stream) |
| c-07 | fc5272c | `isStepCount(8)`, repeat-call guard (`toolChoice: 'none'`), readLink back; no notes/memory/reminder tools once a page is anywhere in the chat |
| c-08 | 8e619d8 | `remindMe` → `schedule()` → `nudge()` → `saveMessages`; amended after security review: nudge turns get no tools, nudge messages carry `metadata.nudge` and never feed readLink's allowlist, 10 waiting / 20 fired per day |
| c-09 | f4e67b7 | checkpoint: `TAG = 'c-09'`; local tour + check recorded; deploy dry-run only |

a-04 and a-05 were amended (and re-tagged) after two security reviews from the lead. The notes in
`docs/outputs/a-04.txt` and `a-05.txt` tell the writer what to teach about them.

Verified 2026-11-03: every tag from c-02 to c-09 passes install (frozen lockfile), typecheck, tests and
`wrangler deploy --dry-run` in a clean worktree (c-09: 14 files, 57 tests). Every tag from c-03 to c-09 was smoked
on 8801 with `wrangler dev` (curl, and `pnpm chat` from c-04). Before that: every tag from a-03 to b-09 passes typecheck and tests in a clean worktree
(`git worktree add` + `pnpm install --frozen-lockfile`). a-02 has tests but no typecheck script yet, and
a-01 has no code. Every tag from a-04 to b-04 was smoked live on 8801 (outputs in `docs/outputs/`).

## Next

1. **Pending recordings** (nothing below was faked; each output file says what's missing):
   - c-02, the hand-written loop against Claude itself. Needs a real Anthropic API key:
     ```sh
     cd ~/code/klippy && git checkout c-02 && pnpm install --frozen-lockfile
     cd apps/agent && echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .dev.vars
     pnpm loop "What time is it right now?" 2>&1 | tee -a ../../docs/outputs/c-02.txt
     git checkout master   # then commit the output on c-02's commit (amend + re-tag), as the other tags were
     ```
   - With Claude instead of the Workers AI fallback (after storing the Anthropic key on the `default` gateway, BYOK):
     re-record a-04 … c-09. The c-course commands are in each `docs/outputs/c-0N.txt` heading (`pnpm dev --port 8801`
     in one terminal, the `printf … | KLIPPY_URL=http://localhost:8801 pnpm chat <name>` line in another).
   - Live deploys for a-05, b-09 and c-09 (commands at the top of those output files). The c-09 deploy creates the
     Durable Object (migration v1).
2. Course D (plan §3 D): the web front end over the agent. The S0 report has the island + service-binding shape.
   `scripts/chat.ts` is the reference for the client protocol (history, approvals, continuations, server-driven turns).
3. Known gap to decide: when the 8-step cap stops a chat turn mid tool-call, the reply has no text (c-07 notes).

## Gotchas

- **Tokens in URLs** (security review, c-03): the Authorization header everywhere; `?token=` only on the
  `Upgrade: websocket` request under `/agents/`, deleted from the URL before `routeAgentRequest`. Never log URLs.
- **Agent tests**: `env.Klippy.getByName(name).saveMessages([...])` drives a turn; `runInDurableObject` reaches
  methods and `this.sql`; `vi.mock('../src/model')` applies inside the DO. The fake model has `doStream` now.
  Approvals are answered over a real socket (`SELF.fetch` with `Upgrade: websocket` + `?token=`), see approval.spec.
- **AIChatAgent without `<Env>`**: the test-only `TEST_MIGRATIONS` binding widens `Cloudflare.Env`; `<Env>` breaks the
  constraint. `underLimit` takes `Pick<Env, 'LIMITER'>`.
- **Terminal client protocol** (no React hook): continuation after an approval needs `transport.expectToolContinuation()`,
  `reconnectToStream()`, routing `cf_agent_stream_pending/resuming/resume_none` to the transport, and
  `readUIMessageStream({ stream, message })` with the paused message, or the stream ends at the tool output.
- **Piped `pnpm chat`**: input lines don't echo; keep stdin open (`(printf …; sleep 100) | pnpm chat`) to see a reminder.
- `nudge()` is a public method (the scheduler calls it by name); it's not `@callable`, so clients can't call it.

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
