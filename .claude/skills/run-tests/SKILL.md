---
name: run-tests
description: Run the app on synthetic data and the two-user browser test, on SQLite and optionally Postgres, and report the exact result. Use before any PR or when asked "does it work?".
---

# Run the tests

Quick check first: `npm run preflight` (about 3 seconds, no browser). Then, for the full test:

1. `npm install` (first time) and `npm run build`.
2. Start the sample-data server in the background: `npm run dev:sample` (http://localhost:3200, a throwaway SQLite database with synthetic feeds).
3. Run `npm test`. It drives two signed-in users (`john`, `matt` test accounts) through feed, grouping, tags, votes, saves, notes, lists, sources, weekly brief, agent log and phone width.
4. **Report the exact last two lines** ("N passed, M failed" and "page errors: …"). For any ✗, quote the check name and investigate the cause. Don't retry until it passes by luck.
5. **Postgres** (when SQL or the schema changed): with a throwaway database, run `DATABASE_URL=postgres://… npm run dev:sample:pg` (port 3300; it resets that database), then `BASE=http://localhost:3300 npm test`.
6. Stop the background servers when done.

Screenshots from the test land in `shots/`. Look at them if you changed the UI.
