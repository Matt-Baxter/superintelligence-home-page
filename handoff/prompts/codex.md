# First message for Codex (paste and edit)

> You're working on the Superintelligence Homepage, a SEIS 606 class project (John Affolter and Matthew Baxter). Read `AGENTS.md` and `CLAUDE.md` first: their hard rules apply to you exactly (never push to or merge into `main`, never deploy or change Vercel/Neon/GitHub settings, no secrets, no Twitter/X, spec first with REQ IDs, shared documents need both humans, free tiers only, real people only as watchlist entries, synthetic labelled test data, no co-author trailers, never write agent log entries).
>
> Then read `handoff/README.md` and `handoff/STATE.md` for where things stand. Work from `fix/sync-with-main` on a new `feature/` branch.
>
> Today's job: [pick one]
> - the next open `[agent]` task in `specs/003-judge-fidelity/tasks.md` (open ones on 2026-11-07: T008, T050, T051);
> - the daily paper watch in `handoff/routines/paper-watch.md`;
> - a `[rules]` task I name here: ____.
>
> Before handing back, run `npm run preflight`, `npm run bench` and, for bigger changes, the browser test (`PORT=3200 node test/serve-fixtures.js` in the background, then `npm test`). Tick the task's checkbox in the commit that finishes it, name its REQ IDs in the commit message, push the branch, and report the exact pass/fail lines. Don't open or merge a pull request.

## If you're building John's bake-off version with Codex

Matt builds his version with Claude Code; John builds his with v0 or Codex. Use the bakeoff-entry skill (`agent-kit/skills/bakeoff-entry/SKILL.md`): stay on John's bake-off branch (`bakeoff/v0-john`, or one the humans name), build only against the shared spec (`specs/001-superintelligence-homepage/spec.md`) and constitution, and don't read Matt's `bakeoff/claude-matt` until both are submitted. CONTRACT.md names "John: v0"; adding Codex there is the humans' change, not yours.
