# Klippy

Klippy is a personal agent on Cloudflare Workers: one Durable Object per person that chats, remembers facts,
keeps notes in D1, reads links and sends reminders. It's built one lesson at a time; each lesson is a git tag.

## Layout

- `apps/agent/`: the agent Worker (`Klippy extends AIChatAgent`, tools in `src/tools/`, tests in `test/`).
- `packages/db/`: D1 table definitions (`remix/data-table`) and SQL migrations, shared by every app.
- `packages/data-table-d1/`: the D1 driver for `remix/data-table`. Don't edit it here.
- `docs/outputs/<tag>.txt`: what each lesson ran and saw. Never invent output in these files.

## Commands (repo root)

- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm dev`.
- One app: `pnpm --filter agent <script>`.

## Rules

- Read the installed docs before using an API you aren't sure of (`node_modules/<pkg>/docs` or README).
  `agents`, `ai` and `remix` change fast; don't trust memory for them.
- Pin exact versions (no `^`). Check a new version with `npm view <pkg> version` the day you add it.
- Tests never call a real model or the real internet: mock `../src/model` and `fetch`.
- Secrets live in `.dev.vars` (gitignored) and `wrangler secret put`. Never write a real key into a file.
- Every route that spends model budget keeps its token check, its rate limit and its input cap.
- Keep changes small: one lesson, one change. Ask before adding a dependency.

## Done means

`pnpm typecheck` and `pnpm test` pass, and you've said what you ran and what you saw.
