# generative-ui

Generative UI on json-render: an agent or a person writes a spec (`{root, elements}`) using only enabled blocks and actions; the server validates it and the browser renders it.

- **Routes**: `GET /api/ui/catalog` (blocks, actions, JSON schema, and `prompt`: the system prompt for an LLM), `POST /api/ui/validate` (`{spec}` → `{ok, issues}`), `GET /api/ui/views`, `GET /api/ui/views/:name` (→ `{view, spec}`, validated).
- **Pages**: `/m/studio` (admins: copy the LLM prompt, paste or edit a spec, validate, preview, download) and `/m/view?name=<view>`.
- **Uses**: `ui.views` (kernel). Any module registers a view with `ctx.point("ui.views").add(name, { title, description, admin?, spec | build(deps, req) })`; `build` returns a spec from live data.
