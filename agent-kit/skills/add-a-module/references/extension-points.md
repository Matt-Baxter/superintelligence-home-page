# Extension points

Lifecycle per boot: `register(env)` for every module (declare points you own) → `setup(ctx)` in dependency order (contribute) → `mount(app, deps)` (routes) → `start(deps)` after the database is ready (`ctx.onStart(fn)`).

| Id | Owner | Call in setup(ctx) | Notes |
| --- | --- | --- | --- |
| `http.routes` | kernel | `ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps))` | Mounted before static files. Use `deps.auth`, `deps.admin`, `deps.wrap`; return JSON from the wrapped handler. |
| `ui.nav` | kernel | `.add({ href: "/m/<page>", label, admin?: true, order?: 0-100 })` | Order under 20 sits next to Feed; 80+ goes at the end. Comes back from `/api/me` as `user.nav`. |
| `ui.blocks` | kernel | folder `blocks/<Name>/block.mjs` + `render.jsx` | No call needed; `npm run build` regenerates `client/blocks.gen.jsx`. Names are global; duplicates fail. |
| `ui.views` | kernel | `.add(name, { title, description, admin?, spec })` or `{ …, build: (deps, req) => spec }` | Served at `/api/ui/views/:name` and `/m/view?name=`; validated against the catalog. |
| `db.schema` | kernel | `.addSql(sql)`, `.addColumns([["table", "col", "TYPE DEFAULT x"]])`, `.addPrune(async (db) => …)` | Write `${ID}` and `${T}` (escaped in template literals) for the engine's id and timestamp types. Portable SQL (write-portable-sql skill). Prune anything that grows. |
| `feeds.formats` | kernel | `.add("my-format", { label, json?: true, parse: (body) => items })` | Items: `{ title, url, summary, published, authors[], score?, arxivId? }`. Shows up in Admin's format lists. |
| `analysis.signals` | kernel | `.add({ factor, max, score: (ctx) => ({ points, detail }) \| null })` | `ctx` has title, text, summary, authors, kinds, nsources, topics, benchmarks, claims. Points are capped at `max` and shown as a `why` line. |
| `meta.actions` | kernel | `.add(require("./actions"))`: a list of `{ id, title, about, method, path, params?, effect?, undo?, req?, page? }` | Describes your routes in plain words for `GET /api/admin/meta` and the runnable list at `/m/control#actions`. Every write needs `undo`; `test/meta-unit.js` fails on a description with no matching route. |
| `decision.judges` | decision | `.add({ id, name, description, method, inputs?, judge(input) })` | Requires the `decision` module. |

Declaring your own point (in `register(env)`): `env.registerExtensionPoint("area.name", (contributingModule) => ({ add(x) { … } }))`. Keep state created inside `register`, not at file level (the kernel may boot more than once in tests). Additive only; for a breaking change add `area.nameV2`.

`deps` passed to routes, views and start hooks: `app, db, auth, admin, wrap, str, bad, forbid, notFound, bool, now, KINDS, FORMAT_IDS, harvester, audit, tagger, feeds, analysis, storyRows, views, kernel`.
