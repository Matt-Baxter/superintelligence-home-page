---
name: write-portable-sql
description: Write database code that works on both SQLite (local, tests) and Postgres (Neon in production) and stays inside the free tiers - schema, migrations, queries, indexes, pruning. Use when touching lib/db.js, adding a table or column, or writing any query.
---

# Write portable SQL

All queries go through `lib/db.js`: `db.get`, `db.all`, `db.run` (→ `{changes}`), `db.insert` (→ new id), `db.exec`, `db.tx(async t => …)`, `db.now()`, `db.sizeBytes()`.

1. **Write once, run on both**: `?` placeholders, no engine-specific functions. The rules and the traps already hit are in `references/sql.md`.
2. **New table**: add `CREATE TABLE IF NOT EXISTS` to `schema()` with `${ID}` for the key and `${T}` for timestamp defaults; add indexes for every column you filter or join on.
3. **New column on an existing table**: append to `ADDED_COLUMNS` (it's added at boot if missing, so live databases upgrade in place). Never edit an existing `CREATE TABLE` to add it.
4. **Contract**: a new table, column or changed shape needs a row in `docs/CONTRACT.md` (change-the-contract skill).
5. **Free tier**: anything that grows without limit needs pruning, and nothing may poll or hold connections open. Limits and current tactics: `references/free-tier.md`.
6. **Test on both engines** (run-tests skill, including the Postgres step).
