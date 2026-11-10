# Test troubleshooting

Problems already hit in this repo, and the fix.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `pkill -f serve-fixtures` kills your own shell (exit 144) | The pattern matches the command line of the shell running pkill | Anchor it: `pkill -f "^node --no-warnings test/serve-fixtures"` |
| `ERR_CONNECTION_REFUSED` on 3200/3300 | Server not started yet, or it crashed on boot | `sleep 2` after starting; read its log; a missing module (e.g. a new `lib/*.js` not created yet) crashes boot |
| Sign-up in a test script silently fails | Usernames must be at least 3 characters | Use names like `dbguser` |
| Drag-and-drop does nothing in Playwright | The drop target is off-screen in a scrolling container | Make the target visible at the test viewport (1200 px wide) |
| Navigating to `/page#/other` doesn't re-render | Same document; only the hash changed | The page needs a `hashchange` listener, or use `reload()` |
| A `hidden` element still shows | A CSS `display` rule beats the `hidden` attribute | `app.css` has `[hidden]{display:none!important}`; don't override it |
| Rows lay out strangely on a new page | Class name collides with an `app.css` class (`.row`, `.cols`, `.panel`, `.tabs`) | Use a page-specific name (the project page uses `.irow`) |
| Postgres test server: "no response" on 5433 | The local cluster stopped with the container | Restart it with `pg_ctl -D <datadir> -o '-p 5433 -k /tmp' start` as a non-root user |
| `fixture://` URL refused | `ALLOW_FIXTURE_FEEDS` isn't `1` | Only the sample-data servers set it; never set it in production |
| The test catalog shows real sources | `SOURCE_CATALOG` not set | The sample-data servers point it at `test/fixtures/sample-catalog.json` |
| Test counts change after adding a fixture source | Feed and filter checks count stories | Add new fixture sources through the admin API late in `e2e.js`, not in `serve-fixtures.js` |
| Live feeds fail in the sandbox | The sandbox can't reach most sites | Use fixtures; say plainly that live fetching is unverified |
| `waitForSelector('select option')` times out | Options inside a `<select>` are never "visible" | Pass `{ state: 'attached' }` |
| "registered twice" when a test boots a second kernel | A module kept registry state at file level | Create registries inside `register(env)` |
| A module page 404s on Vercel but works locally | `public/m/` wasn't generated | `npm run build` runs `scripts/modules.js gen`; check the build log |
| New block doesn't render (blank) | Browser registry not regenerated | `npm run build`; `npm run modules:check` reports a stale `client/blocks.gen.jsx` |
