---
name: generative-ui
description: Generate or build UI with json-render - write a view spec from the catalog's blocks, add a new block (block.mjs + render.jsx), register a live view, and validate and preview it in the Studio. Use when asked for a dashboard, view, panel, chart-like summary or "generative UI", or when an AI should produce UI as JSON.
---

# Generative UI with json-render

A view is JSON (`{ root, elements: { id: { type, props, children, on? } } }`) that may only use the blocks and actions in the catalog. The server validates it; the browser renders it with `JR.render(el, spec, jrHandlers())`.

1. **See what exists**: `GET /api/ui/catalog` (blocks, actions, JSON schema, and `prompt`, the system prompt for an LLM), or the Studio at `/m/studio`. With the MCP server, call `ui_catalog`.
2. **Generating a spec with an AI**: give it the catalog `prompt` and the data, ask for the JSON spec only, then validate (`POST /api/ui/validate`, the Studio, or the `validate_spec` MCP tool) and fix every issue before using it. Never render an unvalidated spec.
3. **A view on live data**: write a builder `(deps, req) => spec` in a module and register it with `ui.views` (add-a-module skill). Builders take numbers from queries; they don't invent text.
4. **A new block** when no block fits: `modules/<id>/blocks/<Name>/block.mjs` (zod props + a description an LLM can act on) and `render.jsx` (React; style with `app.css` tokens and `jr-*` classes). Rules and examples: `references/blocks.md`.
5. **Spec patterns** (ids, children, binding a button to an action, lists of StoryRows, empty states): `references/specs.md`.
6. `npm run build`, `npm run modules:check`, then the browser test (run-tests skill). Check the view at 390 px wide.
