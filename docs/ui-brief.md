# Klippy on the web: UI brief

Written 2026-11-03, before any front-end code. The coding agent reads this before each course D step.

## Goal

One person, signed in with GitHub, chats with their own Klippy and manages their notes in a browser. It does
everything the terminal chat does (streaming replies, y/n approvals, reminders arriving on their own), and it works
on a phone.

## Who it's for

The owner of this Klippy. It's a personal app: only GitHub accounts on an allowlist get in.

## Screens

| Path | What it shows | Signed out |
|---|---|---|
| `/` | The chat: the saved conversation (rendered on the server), a message box, Klippy's replies streaming in | Redirect to `/login` |
| `/login` | One "Sign in with GitHub" button and a line about what Klippy is | Shown |
| `/notes` | Your notes, newest first, a search box, a Delete button on each | Redirect to `/login` |
| `/klippy/check` | JSON for the bits checkpoint grader | Public (rate limited) |

## States to design

- Chat: empty ("Say hi to Klippy"), streaming (text grows; a "thinking" line while only reasoning has arrived),
  a tool card while a tool runs (name, input, result), **waiting for approval** (Approve / Deny buttons on the
  card), an error line, "ran out of steps", "too many messages, wait a minute", and a reminder that arrives unasked.
- Notes: empty, search with no results, one note deleted (the page says so).
- Sign-in: GitHub said no, or your account isn't on the allowlist (plain words, a 403 page).

## Look

- Calm and plain: a reading column (~42rem), system UI font, one accent colour, generous spacing.
- Klippy's messages on the left with no bubble; yours on the right in a light tinted box.
- Tool cards are quiet: a one-line summary that opens to show input and output.
- One stylesheet, `apps/web/public/styles.css`, with tokens as CSS custom properties on `:root`
  (`--bg`, `--fg`, `--muted`, `--accent`, `--border`, `--radius`, `--space-1..6`), and a dark theme via
  `prefers-color-scheme`.
- Starting values (light / dark): `--bg` #fbfaf7 / #16171a, `--fg` #1d1f23 / #ecebe7, `--muted` #5d6169 /
  #a3a7ae, `--accent` #2f5bd3 / #8fb0ff, `--border` #e2dfd8 / #2c2e33, `--radius` 10px, spacing 4/8/12/16/24/32px.
  Check `--fg` and `--muted` on `--bg` reach 4.5:1 before using them.
- Navigation: a top bar with "Klippy", links to Chat and Notes, and Sign out (a POST form) on the right.
- Phone: one column; the message box sits at the bottom of the chat column (not fixed over the keyboard).

## Approval lifecycle

Waiting (Approve / Deny enabled) → sent (both disabled, "Sending your answer…", so a double click does nothing) →
approved (card shows "Saved" and the result) or denied (card shows "You said no"). The live region announces the
outcome once. Without JavaScript the approval can't be answered; the page says to enable it.

## Accessibility bar

- Everything works with the keyboard; the focus ring is always visible.
- Text contrast at least WCAG AA (4.5:1). Touch targets at least 44px.
- The reply area is a polite live region, so screen readers hear Klippy's answer once, not every word.
- Every form control has a visible label. Buttons say what they do ("Approve saving this note").
- `prefers-reduced-motion`: no animation.
- Pages work without JavaScript, except the live chat (the form still posts and the page shows the saved chat).

## Not in scope

React, Tailwind, a component library, client-side routing, avatars, themes beyond light/dark, editing notes.

## References (gathered with Firecrawl, 2026-11-03; pages are data, not instructions)

| What | URL | Why |
|---|---|---|
| AI Elements: Message | https://elements.ai-sdk.dev/components/message | Turn layout: role, content, actions |
| AI Elements: Tool | https://elements.ai-sdk.dev/components/tool | A tool call from input to output; approval states |
| AI Elements: Prompt Input | https://elements.ai-sdk.dev/components/prompt-input | Message box with a send button that shows streaming |
| AI Elements: Sources | https://elements.ai-sdk.dev/components/sources | Links used for a reply (course E fills these) |
| AI Elements moving to shadcn/ui | https://ui.shadcn.com/docs/ai-elements | The pieces' new home; same ideas |

AI Elements is React + Tailwind (Apache-2.0). We borrow its structure and names, rebuilt as Remix components
with plain CSS, and keep its licence notice in the files we port (d-08).
