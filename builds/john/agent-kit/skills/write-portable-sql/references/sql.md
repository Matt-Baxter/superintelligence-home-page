# Portable SQL rules

| Do | Don't | Why |
| --- | --- | --- |
| `?` placeholders | `$1` | Translated to `$n` for Postgres |
| `INSERT OR IGNORE INTO …` | `ON CONFLICT DO NOTHING` written by hand | Translated for Postgres; `run().changes` is 0 when ignored on both |
| `ON CONFLICT (a, b) DO UPDATE SET …` | `INSERT OR REPLACE` | Postgres needs the conflict target named |
| Timestamps from JS: `db.now()` (ISO UTC, no ms) | `CURRENT_TIMESTAMP`, `now()` in queries | Same string format on both, sortable as text |
| `CASE WHEN a > b THEN a ELSE b END` | `MAX(a, b)` scalar | SQLite-only |
| Wrap `EXISTS(...)` results in `bool()` | Compare to 1 or true | 0/1 on SQLite, true/false on Postgres |
| `COUNT(*) AS n` and read `.n` | Rely on default column names | Names differ by engine |
| `LOWER(col) LIKE ?` with a lowercased `%term%` | `ILIKE` | Postgres-only |
| `CAST(x AS TEXT)` | `x::text` | Postgres-only syntax |
| Integers for flags (`0/1`) | `BOOLEAN` columns | One shape for both engines |
| JSON stored as `TEXT`, parsed in JS | JSON operators | Engine-specific |

## Traps already hit
- `db.insert` appends `RETURNING id` on Postgres: only use it on tables with an `id` column.
- `pg` returns BIGINT and COUNT as strings unless parsed; `lib/db.js` sets the parser, so don't cast in queries.
- `node:sqlite` is synchronous: `db.tx` serializes transactions, so don't call `db.*` (outside the transaction) from inside `tx(async t => …)`; use `t.*`.
- Ordering by a boolean expression (`x IS NULL`) works on both; ordering by an alias inside `CASE` doesn't on Postgres.
- Postgres is strict about `GROUP BY`: every selected non-aggregate column must be grouped.
