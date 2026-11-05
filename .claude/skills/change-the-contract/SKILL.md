---
name: change-the-contract
description: Change a table, API route, or request/response shape the right way, by updating docs/CONTRACT.md with a versioned change-log row before the code. Use whenever a change would break what the other partner builds against.
---

# Change the contract

`docs/CONTRACT.md` is what both partners (and both bake-off versions) build against. A shape change without a contract update breaks the other half.

1. **Say it first.** Tell the human what would change and who it affects (the other partner's area, or the other bake-off version). Get a go-ahead before editing.
2. **Bump the version.** New fields, routes or tables are a minor bump (0.3 → 0.4). Removing or renaming something, or changing a type, is a major bump (1.x → 2.0).
3. **Add a change-log row** at the bottom of the table in `docs/CONTRACT.md`:
   `| <version> | <Mon D, YYYY> | <what changed, in one or two sentences> | John ☐ · Matt ☐ |`
   Update the version line at the top of the file to match.
4. **Update the affected section**: "Data models", "API" (request and response columns), "Auth" or "Rules". Keep the examples exact.
5. **Then change the code** to match: schema in `lib/db.js` (portable SQL for both engines), routes in `server.js`, callers in `public/`.
6. **Test on both engines.** Run `npm test` against `dev:sample` (SQLite) and, for schema changes, against `dev:sample:pg` (see docs/DEPLOY.md).
7. **PR title starts with `Contract vX.Y:`**. Remind the human that both partners must tick their box in the change log before merging, and that the same change belongs in the shared Plan doc.
