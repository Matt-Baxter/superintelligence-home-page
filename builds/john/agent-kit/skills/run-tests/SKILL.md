---
name: run-tests
description: Run preflight, the unit checks and the two-user browser test on synthetic data, on SQLite and Postgres, and report the exact result. Use before any pull request, after changing code, or when asked "does it work?".
---

# Run the tests

1. **Preflight** (about 3 s, no browser): `npm run preflight`. It must end with `Preflight passed.`
2. **Browser test** (about 2 min):
   ```bash
   npm run build
   npm run dev:sample &          # http://localhost:3200, throwaway SQLite, synthetic feeds
   npm test                      # two users, every page, phone width
   pkill -f "^node --no-warnings test/serve-fixtures"
   ```
3. **Postgres too** when SQL or the schema changed: start a throwaway database, then
   `DATABASE_URL=postgres://… npm run dev:sample:pg &` (port 3300; it wipes that database) and `BASE=http://localhost:3300 npm test`.
4. **Report the exact last lines**: `N passed, M failed` and `page errors: …`, for each engine. For a ✗, quote the check and find the cause. Don't rerun until it passes by luck.
5. **Look at the screenshots** in `shots/` if you changed a page.

Adding checks: browser checks go in `test/e2e.js` (one `ok(condition, 'what it proves')` each); pure-logic checks go in a `test/*-unit.js` file that preflight runs. New fixtures go in `test/fixtures/`, synthetic and labelled "(test data)".

When something fails for no obvious reason (port in use, a test that passes alone, Postgres won't start), read `references/troubleshooting.md`.
