# codemap

The repo as a graph, built by parsing the code (`scan.js`): pages call routes, routes read and write tables, routes live in files, files require files, modules contribute to extension points, spec requirements are met in files and checked by tests.

- **Page**: `/m/codemap` (admins): lanes of pages → routes → tables; click anything to trace its connections; type to search ("votes", "REQ-003", "project_issues").
- **Routes**: `GET /api/codemap` (the graph), `GET /api/codemap/trace?id=` (connected node ids), `GET /api/codemap/ask?q=` (matching nodes and their links). Admins only.
- **CLI**: `npm run codemap -- votes` answers from the terminal; `node scripts/codemap.js build` writes `data/codemap.json` (run by `npm run build`, used on Vercel).
- **Agents**: the MCP tool `codemap_query`.
- **Checks**: preflight fails when a page calls an API route that no module or core file defines.
- **Conventions it relies on**: routes are `app.<method>("<path>", …)`; pages call `api("/api/…")` or `fetch("/api/…")`; tables are `CREATE TABLE IF NOT EXISTS`. Code that doesn't follow them is invisible to the map.
