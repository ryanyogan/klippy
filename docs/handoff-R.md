# Lane R handoff (2026-11-03, after f-08: course F done; courses A-F complete)

Lane R builds this repo, the reference for bits' build-along courses (bits `docs/plans/build-along.md`,
decision 071). Read that plan (§1–§5, lane R in §7) and bits `docs/plans/build-along/s0.md` first.

## Goal

One commit and one annotated tag per lesson, in course order (`a-01` … `f-08`). Each tag is green
(typecheck, tests, a `wrangler dev` smoke on port 8801 where relevant) and has its real output in
`docs/outputs/<tag>.txt`. Small steps a beginner can follow. Pinned versions, checked with `npm view` on
the day. Tests never call a real model or the real internet. The repo is PUBLIC at github.com/ryanyogan/klippy with
CI on every push: push main and each new tag as you go (`git push origin main --follow-tags`). Pushed tags are public:
never rewrite or force-push them; fix forward in the next tag and say so in its output.

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
| c-09 | (see `git log`) | checkpoint: `TAG = 'c-09'`; local tour + check recorded; deploy dry-run only |
| d-01 | (see `git log`) | `AGENTS.md` (30 lines); a real `claude -p` run shows Claude Code loads it |
| d-02 | | `skills-lock.json` (remix, cloudflare, agents-sdk, frontend-design via `npx skills@1.7.6`); `.claude/skills/` gitignored |
| d-03 | | `.mcp.json`: context7, firecrawl (`${FIRECRAWL_API_KEY:-}`), cloudflare-docs (`https://docs.mcp.cloudflare.com/mcp`, not the plan's agents.cloudflare.com URL) |
| d-04 | | `docs/ui-brief.md`; a real plan-mode review found 3 gaps, all closed |
| d-05 | | `apps/web` (Worker `klippy-web`): routes/router/controllers, layout, **the one stylesheet**, `AGENT` service binding; `pnpm dev:web` = one wrangler process with both configs on 8802 |
| d-06 | | GitHub sign-in (`remix/auth`, signed cookie session, `cop()`), allowlist **by numeric id** (`ALLOWED_GITHUB_IDS`, amended after review; `app/allowlist.test.ts` under `node --test`), agent name `gh-<id>`, `agentFetch` adds `KLIPPY_TOKEN` server-side |
| d-07 | | `/notes`: list, search (`like`), delete (POST → 303) with `@klippy/db` + `data-table-d1` on the same D1; data-schema for q and id |
| d-08 | 12847a9 | AI Elements → Remix components in `apps/web/app/ui/` (conversation, message, tool, sources, prompt-input; Apache-2.0 credit lines + `AI-ELEMENTS-LICENSE.txt`); `ai` added; home renders the saved chat; **a refused get-messages is a role=alert line + 502** (the d-07 "0 saved messages" gap) |
| d-09 | a0cc6aa | the chat island: `clientEntry('/assets/chat.js#Chat')`, `app/actions/public/{entry,chat}.tsx`, esbuild `build:client` → `public/assets` (gitignored) via wrangler `build.command`; `/chat` checks upgrade (426), Origin (403), drops Cookie, `agentFetch` → `/agents/klippy/gh-<id>`; Approve/Deny continue the same reply. Proven in headless Chromium: streaming, approval, reload; wrong token → 401 on page and socket |
| d-10 | 06d162e | a **real** `claude -p` plan-mode review of the diff (verbatim in d-10.txt), then fixes: `ChatSession` (TypedEventTarget) out of the component, no stuck states, failed send keeps text, parts in order, agent's saved copy applied after a reply (Deny → "You said no") |
| d-11 | f322060 | checkpoint: `TAG = 'd-11'`; public `GET /klippy/check` on web (own controller, data-schema nonce, `CHECK_LIMITER` 10/min per address, ns 1002) proxying the agent's check; `deploy:web`; both dry-runs build. Live deploy PENDING |

| e-01 | 54f2741 | sandbox lesson, note only (paste vs search, caching first) |
| e-02 | (see `git log`) | `sources` table (0002, owner = Klippy name, kind note/link/file, note_id FK cascade); `IngestWorkflow` (AgentWorkflow): load → fetch (fetchWeb from `agents/webfetch`, private hosts refused, no redirects, 1 MB, retries 3) → store → ready / failed; `saveLink` (needsApproval, typed links only, private set behind afterPage); chat `saveNote` also queues the note; `POST /agents/klippy/<name>/file` (DO `onRequest`, text/markdown/html/pdf, 1 MB, toMarkdown); 30 sources/day |
| e-03 | | `chunks` (0003, FK cascade); `chunk.ts` (paragraphs, headings, 1,200 chars, 200 overlap); `saveChunks` one idempotent batch, ≤ 50 |
| e-04 | | Vectorize `klippy-notes` (768, cosine, metadata index `owner`) **created on the owner's account**, binding `VECTORIZE` remote; step `embed` (bge-base-en-v1.5), ids `chunk-<id>`, metadata { owner, sourceId } |
| e-05 | | FTS5 `chunks_fts` (0004, external content + triggers), `rrf.ts`, `keywordSearch` (quoted words), `hybridSearch`, `hydrate` (owner re-checked); `GET /agents/klippy/<name>/search?q=` (rate-limited) |
| e-06 | | `chunks.context` + FTS rebuilt (0005); `contextModel` = `ai(anthropic('claude-haiku-5-5'))` (@ai-sdk/anthropic 4.0.96, provider-native path so cacheControl reaches Claude) + GLM fallback; one Workflow step per chunk; context embedded and indexed |
| e-07 | | `rerank.ts` (bge-reranker-base); `searchNotes` (hybrid 20 → rerank 5, wrapped `<untrusted_saved_content>`, numbered); system prompt cites [n] / "That's not in your notes."; **retrieval cut**: after searchNotes (turn or chat) every writing tool (remember, forget, remindMe, saveNote, saveLink) throws and only READ_ONLY is offered; web `Sources` shows "[n] title" |
| e-08 | | `pnpm eval:retrieval` (vitest.eval.config.mts, remote bindings), 6 docs / 12 questions, recall@5. **Bug: used the real index with colliding ids — fixed in e-09; never run e-08's eval** |
| e-09 | | checkpoint `TAG = 'e-09'`; eval fix forward: `VECTORIZE_EVAL` → `klippy-notes-eval` (created), -eval name guard, prefixed ids, deletes only its own; waits for all vectors |
| f-01 | 2daa210 | agent `workers_dev: false` + `preview_urls: false` (docs: workers.dev off leaves preview URLs on); web `POST /sources/file` (1 MB, multipart, 303 to /notes?sent=1) and `GET /sources/search`, signed in, agent named from the session; upload form on /notes |
| f-02 | 47d6288 | `model(env, { route, user?, cache? })`: gateway `metadata` { app, route, user } on every call (both legs); check probe opts into the gateway cache (`cacheKey` + `cacheTtl` 300: cacheTtl alone caches nothing, caching is off by default); `ask` returns `cache` (HIT seen on a fresh server) |
| f-03 | 155daff | web `USER_LIMITER` (ns 1003, 30/min, key gh-<id>) on upload, search, chat socket; agent `DAILY_TOKEN_BUDGET` var (200000) checked before each turn, usage table in the DO. **Charged only in onFinish: fixed forward in f-04 and f-05** |
| f-04 | 5ea1a96 | `logTurn` / `logRefused` (console.log objects, shape only); /ask step log shape only; **budget fix 1**: reserve before each step, settle after (cancelled turns pay) |
| f-05 | 7225952 | `test/injection.spec.ts` (poisoned page, poisoned saved note via real FTS; obeying fake model; nothing happens); system prompt hint line; **budget fix 2**: per-step reserve from that step's messages (chars/3 + 300), missing count keeps the reserve, settle on the reserve's day |
| f-06 | 41bffde | CI `deploy` job on main after `check`: D1 migrations → agent → web via wrangler-action v4.1.3 (`wranglerVersion` 4.157.0, pnpm), every step gated on `CLOUDFLARE_API_TOKEN` (skips green now) |
| f-07 | b958ed3 | web: commented custom domain; `previews` block with no AGENT/DB (a Preview's service binding calls production), nobody allowed, own limiter namespaces 3002/3003; `agentFetch` 503 without AGENT; CI `preview` job on PRs, same gate |
| f-08 | 4004d43 | checkpoint `TAG = 'f-08'`; tour through the web app (check, file, search, chat with a source in headless Chromium) |

c-07 was amended (2026-11-03, after two security reviews): the honest "ran out of steps" text when the 8-step cap stops a turn mid tool-call (`OUT_OF_STEPS` shared with /ask), and the page cut enforced three ways (no private tools built when a page is in the chat; prepareStep fail-closed; `afterPage()` makes notes/memory/remind tools throw once readLink ran in the turn). c-08 rebased: nudge turns build no tools at all. c-07…c-09 re-tagged; 58/64/64 tests.

a-04 and a-05 were amended (and re-tagged) after two security reviews from the lead. The notes in
`docs/outputs/a-04.txt` and `a-05.txt` tell the writer what to teach about them.

Verified 2026-11-03: f-01…f-08 each pass frozen install, typecheck and tests in a clean worktree (agent 96 → 111, web 3,
driver 24) and are green in GitHub Actions (main and tag runs; on main the deploy job runs and skips every step with its
notice). f-01, f-03, f-07, f-08 smoked through `pnpm dev:web` on 8802; f-02 … f-05 on 8801. Before: e-02…e-09 each pass frozen install, typecheck and tests in a clean worktree (e-09: agent 96, web 3,
driver 24) and are green in GitHub Actions (main and tag runs); each was smoked on 8801 (outputs in docs/outputs).
Before: d-08…d-11 each pass frozen install, typecheck and tests in a clean worktree (agent 64, web 3, driver 24), d-11's web dry-run also from a clean worktree (986 KiB); d-08…d-11 smoked on 8802. Earlier: c-07, c-08, c-09 and d-01…d-07 pass frozen install, typecheck and tests in a clean worktree (d-07: agent 64 tests + web 3). d-05…d-07 smoked with `pnpm dev:web` on 8802 (curl; outputs in docs/outputs). Earlier: every tag from c-02 to c-09 passes install (frozen lockfile), typecheck, tests and
`wrangler deploy --dry-run` in a clean worktree (c-09: 14 files, 57 tests). Every tag from c-03 to c-09 was smoked
on 8801 with `wrangler dev` (curl, and `pnpm chat` from c-04). Before that: every tag from a-03 to b-09 passes typecheck and tests in a clean worktree
(`git worktree add` + `pnpm install --frozen-lockfile`). a-02 has tests but no typecheck script yet, and
a-01 has no code. Every tag from a-04 to b-04 was smoked live on 8801 (outputs in `docs/outputs/`).

## Next

1. Courses A–F are built (a-01 … f-08). Course G (MCP) is outline only ("coming soon"): don't build it until the owner asks.
2. Everything waiting on the owner is in the checklist below. The first deploy is the big one: items 3, 7, 10, 13 together.
3. Writer notes worth carrying into the lessons: the f-03 page must point at the two budget fixes (f-04, f-05); b-03's
   step log now logs shape only (f-04); `pnpm chat` is local only since f-01; the notes table has no owner (see Gotchas).

## Owner checklist (every PENDING item, all tags; nothing here was faked)

Recording account facts: the `default` gateway has no Anthropic key, so every model answer so far came from the
Workers AI fallback (`@cf/zai-org/glm-4.7-flash`) and each output says so.

1. **Anthropic key on the gateway (BYOK)**: dashboard → AI → AI Gateway → `default` → provider keys → Anthropic.
   Unblocks items 2 and 8.
2. **c-02 live loop** (needs a key in a local file, not the gateway):
   `cd ~/code/klippy && git checkout c-02 && pnpm install --frozen-lockfile && cd apps/agent && echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .dev.vars && pnpm loop "What time is it right now?" 2>&1 | tee -a ../../docs/outputs/c-02.txt`
3. **Agent deploys a-05 / b-09 / c-09** (one deploy at master covers the code; per-tag recordings optional):
   `pnpm --filter agent exec wrangler login`; `pnpm --filter agent exec wrangler secret put KLIPPY_TOKEN` (value:
   `openssl rand -hex 32`); `pnpm deploy`; `curl -s "https://klippy.<subdomain>.workers.dev/klippy/check?nonce=checkpoint-live"`;
   `pnpm --filter agent exec wrangler tail` while curling (a-05); `KLIPPY_URL=https://klippy.<subdomain>.workers.dev pnpm chat me` (c-09).
   Remote D1 schema is already applied (b-09). **Since f-01 the agent at master has no public URL**: the workers.dev curl
   and `pnpm chat` against it only work if you deploy an older tag (a-05 … e-09) to record those lessons; at master, check
   through the web app (item 7). Remote migrations 0002–0005 (item 10) must run before deploying e-02 or later.
4. **d-03 MCP approval**: run `claude` in ~/code/klippy, approve context7, firecrawl and cloudflare-docs when asked
   (project servers; don't add them to user settings), then
   `claude -p "Use the cloudflare-docs MCP: what is the service binding config key in wrangler.jsonc? One line, with the page URL."`
   and paste the answer into docs/outputs/d-03.txt.
5. **GitHub OAuth app (d-06/d-07 local round trip)**: github.com/settings/developers → New OAuth App; homepage
   `http://localhost:8802`, callback `http://localhost:8802/auth/github/callback`. Put GITHUB_CLIENT_ID,
   GITHUB_CLIENT_SECRET and your numeric id (`gh api user --jq .id`) in ALLOWED_GITHUB_IDS in apps/web/.dev.vars.
   `pnpm dev:web`, sign in: expect "Hi, <name>", "Your Klippy is gh-<id>." and the chat (since d-08 the
   "N saved messages" line is gone). A second GitHub account: expect the 403.
6. **d-09/d-10 in a real browser, signed in for real** (after 5): send a message, approve one saveNote, deny one,
   reload. Our recordings used headless Chromium with a local test cookie.
7. **d-11 live deploy (both Workers)**: a second OAuth app (or edit the first) for
   `https://klippy-web.<subdomain>.workers.dev` + `/auth/github/callback`; set APP_ORIGIN and ALLOWED_GITHUB_IDS in
   apps/web/wrangler.jsonc; deploy the agent first (item 3); then in apps/web
   `for s in GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET SESSION_SECRET KLIPPY_TOKEN; do pnpm exec wrangler secret put $s; done`
   (KLIPPY_TOKEN = the agent's; SESSION_SECRET = `openssl rand -base64 32`), `pnpm deploy:web`, then
   `curl -s "https://klippy-web.<subdomain>.workers.dev/klippy/check?nonce=bits-d11-live" | tee -a docs/outputs/d-11.txt`.
   Untested: whether `secrets.required` lets the first `secret put` precede the first deploy (it should create the
   Worker); if not, deploy once, then put the secrets.
8. **Re-record with Claude** (after 1): a-04 … d-11 model outputs, which are all fallback answers now.
9. **GitHub CI secrets (f-06)**: repo → Settings → Secrets → Actions: `CLOUDFLARE_API_TOKEN` (account-owned token with
   Workers Scripts Edit + D1 Edit; add Workers Routes / zone access with a custom domain) and `CLOUDFLARE_ACCOUNT_ID`.
   The next push to main then migrates D1, deploys the agent, then the web app. Put the Workers' own secrets first
   (items 3 and 7), or the first CI deploy builds Workers that can't start. actionlint never ran (not installed; denied once).
10. **Remote D1 migrations 0002–0005** (course E): `cd apps/agent && pnpm exec wrangler d1 migrations apply DB --remote`.
    The lane's attempt was denied by the permission classifier (production action). Needed before any deploy of e-02+.
11. **Re-record e-06 with Claude** (after 1): contexts came from the GLM fallback and `cachedTokens` was 0; expect a cache
    hit from the second chunk of a document over 512 tokens.
12. **Vectorize indexes on the account**: `klippy-notes` (app) and `klippy-notes-eval` (eval only), both 768/cosine with an
    `owner` metadata index. Learners create their own; ours hold dev-smoke vectors only.
13. **After the first deploy (f-01)**: `curl -s https://klippy.<sub>.workers.dev/` should no longer reach the agent
    (workers.dev off); the web app still works. Paste both into docs/outputs/f-01.txt.
14. **Gateway spend limit (f-02)**: dashboard → AI → AI Gateway → `default` → spend limits: e.g. a per-day dollar limit
    scoped by the `user` metadata key, plus an account Budget alert (Billing). Neither is set.
15. **Saved queries (f-04)**: after a deploy and a few chats, Workers & Pages → klippy → Observability: Filter event = turn,
    Sum tokens.total + Count + P90 ms, Group By agent → Save as "Klippy: tokens per user"; and event = turn.refused,
    Count, Group By reason → "Klippy: refused turns". Screenshot or paste into docs/outputs/f-04.txt.
16. **Custom domain / Previews (f-07, optional)**: uncomment `routes` in apps/web/wrangler.jsonc with a hostname on your
    zone (then APP_ORIGIN and the OAuth callback); for PR Previews, set the four web secrets once with
    `wrangler preview base-config secret put <NAME>` (NEW values) and open a PR from a branch of this repo.

## Gotchas

- **Course F**: `kill.sh` greps `--port <n>` in `ps`, so never run it in the same Bash call whose command line contains
  "--port 8801" (it kills its own shell, exit 144); start servers with `P=8801 … --port $P`. wrangler dev 4.157.0 has a
  local observability API (`POST /cdn-cgi/local/explorer/api/local/observability/query`, SQL over `logs` / `spans`;
  messages are JSON strings, so `json_extract(message, '$[0].event')`); in the two-config web process it didn't return
  the agent's lines. The platform's invocation log records the full request URL, including `?token=` on `pnpm chat`'s
  socket (local only since f-01). The budget tests drive cancellation with `agent.saveMessages(msgs, { signal })` inside
  `runInDurableObject` and a MockLanguageModelV4 that aborts on step N. `previews.secrets` is in wrangler's schema but
  `deploy --dry-run` rejects it ("Unexpected fields"). **The notes table (b-05) has no owner column**: every Klippy on one
  D1 shares it (listNotes shows everyone's). Fine for a one-person Klippy behind the GitHub allowlist; a multi-user
  lesson would need an owner on notes (sources and chunks already have one).

- **Course E**: Vectorize is eventually consistent (vectors queryable ~1 min after upsert; deletes lag too). There's no
  local Vectorize: `remote: true` in dev, a mocked `src/retrieval/vectors` in tests. The local AI binding refuses to run
  in tests ("Binding AI needs to be run remotely"), so any test that runs the ingest Workflow must mock
  `src/retrieval/vectors` and `src/ingest/context` (approval.spec does). Workflows in tests: `introspectWorkflow(env.INGEST)`
  + `disableRetryDelays()` + `waitForStatus`; explicit `dispose()` (the test tsconfig has no AsyncDisposable lib).
  `wrangler types` drops `query` from the bge-reranker input type (worked around in rerank.ts). Search is per owner
  (agent name): a fresh name has no sources. `pnpm eval:retrieval` needs `--reporter=verbose` to show its report.
- **Permission classifier**: `wrangler d1 migrations apply --remote` was denied as a production deploy. Don't work around.

- **Island props are typed serializable**: `clientEntry` rejects `UIMessage[]` (metadata: unknown); the prop is
  `SerializableObject[]` and the island casts once (`as unknown as UIMessage[]`).
- **Island setup runs on the server**: open the socket in `handle.queueTask` (browser only); `ChatSession` is loaded
  with `await import()` there, so agents/client stays out of the server render path. Close on `handle.signal`.
- **Agent's saved copy vs the stream**: after Deny the stream leaves the part at approval-requested; the
  `CF_AGENT_CHAT_MESSAGES` broadcast has `output-denied`. ChatSession keeps a broadcast that lands mid-reply and
  applies it when the reply ends.
- **Testing the bad-token path**: `wrangler dev … --var KLIPPY_TOKEN:wrong-token` overrides the web Worker only.
- **Browser checks**: headless Chromium from bits' Playwright (`/home/ryan/code/bits/node_modules/.pnpm/playwright@1.64.1`)
  with `context.addCookies` for the local test cookie (secure cookies work on http://localhost). Scratch scripts:
  `cookie.mjs` (run from apps/web) and `d09-browser.cjs` in the session scratchpad, not in the repo.
- `claude -p --permission-mode plan` writes a copy of its plan to ~/.claude/plans/.
- The fallback model's text can contradict what happened ("Note saved" before approval; "system error" after Deny).
  The tool card is the truth; lessons say so.

- **Web local dev**: `pnpm dev:web` runs `wrangler dev --port 8802 -c wrangler.jsonc -c ../agent/wrangler.jsonc`
  (one process, so AGENT resolves without the shared dev registry). Its local D1 lives under apps/web/.wrangler, not
  the agent's: apply migrations there (`wrangler d1 migrations apply DB --local` in apps/web).
- **apps/web/.dev.vars** (gitignored) has placeholder GitHub values, a random SESSION_SECRET, ALLOWED_GITHUB_IDS=1 and
  the agent's KLIPPY_TOKEN. Signed-in pages were tested with a local-only cookie for id 1 (script not in the repo):
  with `maxAge`, remix's session middleware stores `{"value": …, "expires": …}` inside the signed cookie.
- **requireAuth narrowing**: as controller middleware it types `context.auth.identity`; as action middleware it doesn't.
- `wrangler types --strict-vars=false` for apps/web (APP_ORIGIN, ALLOWED_GITHUB_IDS change per deploy).
- Web tests: only `app/*.test.ts` under `node --test` (owner: no front-end tests; the allowlist test was asked for by
  the coordinator). They're excluded from tsc (no Node types in the Worker tsconfig).
- `cloudflare:workers` `env` is used at module scope in apps/web (cookie secret, GitHub provider).
- Don't chain `;` after a failing python edit before `git commit --amend` (it happened once; no harm, but check).

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
