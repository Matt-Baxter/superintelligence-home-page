# UI kit

## Helpers in public/js/api.js
| Helper | Use |
| --- | --- |
| `api(path, {method, body, allow401})` | JSON fetch; `body` implies POST; throws `Error(message)` from the server; a 401 sends the user to sign in |
| `requireUser()` | Ensures a session, draws the top bar, returns `{id, username, name, admin}` |
| `$`, `$$` | `querySelector` / array of `querySelectorAll` |
| `esc(s)` | HTML-escape before any `innerHTML` |
| `params` | `URLSearchParams` of the page URL |
| `storyCard(story, {compact, listNote})` | The standard story `<li>` (votes, save, tags, significance badge, benchmark chips) |
| `ago(iso)`, `fmtDate(iso)` | "3h ago", "Nov 5, 2026" |
| `showErr(el, e)`, `flash(el, msg)` | Error and success messages |
| `copy(text, button)` | Clipboard with feedback |
| `KIND` | Labels for source kinds |
| `sigWhy(analysis)`, `fmtScore(score)` | Significance tooltip text; "71.7%" or "2.3 h" |
| `jrHandlers(extra)` | Actions json-render specs may trigger |

## Style tokens (app.css `:root`, with a dark-mode set)
`--bg --surface --fg --muted --line --accent --accent-soft --good --warn --bad` (+ `-soft`), `--radius`, `--font`, `--mono`. Use tokens, not hex colors, so dark mode works.

## Shared classes
`.pagehead .panel .tablewrap .btn .btn.primary .linkish .chips .chip .tag .seg-btns .tabs .feed .story .sig(.mid/.hi) .muted .small .err .ok .empty .cols`

## Pitfalls
- Global rules: `input, select, textarea { width: 100% }` and `.row > * { flex: 1 1 160px }`. Set `width: auto` for inline controls, and don't name your own class `.row`, `.cols`, `.panel` or `.tabs`.
- `[hidden]` is forced to `display: none`; toggle `el.hidden` instead of styles.
- Single-page apps (project page): update the hash with `history.replaceState` and listen for `hashchange`.
- Long tables: wrap in `.tablewrap` so phones scroll the table, not the page.
- The top bar is one line; on phones the nav row scrolls sideways.
