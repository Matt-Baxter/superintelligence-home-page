# Notes for AI agents (v0, Claude, others)

The full guide is [CLAUDE.md](CLAUDE.md). It applies to every agent, not just Claude. The short version:

- Work on a branch (`feature/…`, `fix/…`, `bakeoff/…`). Never push to or merge into `main`, and never deploy.
- Build against [CONTRACT.md](CONTRACT.md). Changing a table, API route or response shape is a contract change and needs both humans.
- Never write agent log entries. The humans write them in their own words.
- No secrets in code; no Twitter/X sources; test data is synthetic and labelled "Sample".
- Before saying it works: run `npm run preflight` (and `npm test` for bigger changes), and report the exact result.
