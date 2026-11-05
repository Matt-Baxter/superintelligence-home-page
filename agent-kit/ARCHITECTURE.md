# Agent kit architecture

## One source, three levels, many adapters

```
                      agent-kit/  (the only place knowledge is written)
   ┌──────────────────────────────┬───────────────────┬─────────────┬──────────────┐
   │ skills/<name>/SKILL.md       │ agents/*.md       │ hooks/      │ mcp/server.js│
   │ skills/<name>/references/*.md│ (subagents)       │ (guard)     │ (runtime)    │
   └──────────────┬───────────────┴─────────┬─────────┴──────┬──────┴──────┬───────┘
                  │                         │                │             │
   adapters:      ▼                         ▼                ▼             ▼
   Claude Code in repo ── .claude/skills, .claude/agents (symlinks), .claude/settings.json (hook)
   Claude Code plugin ─── .claude-plugin/marketplace.json → agent-kit/.claude-plugin/plugin.json
   Claude apps / API ──── dist/agent-kit/skills/<name>.zip            (npm run kit:export)
   MCP clients ────────── agent-kit/mcp/server.js over stdio           (tools, resources, prompts)
   AGENTS.md readers ──── AGENTS.md index                              (npm run kit:sync)
   Anything else ──────── dist/agent-kit/agent-kit.md, cursor/*.mdc    (npm run kit:export)
```

Nothing is copied by hand. The symlinks, the generated indexes and the export are all derived, and `npm run kit:check` (inside preflight) fails if any drift.

## Progressive disclosure

| Level | Content | Loaded | Budget |
| --- | --- | --- | --- |
| 1 | Rules + skill index (`CLAUDE.md`, `AGENTS.md`); skill names and descriptions | Always | One table row per skill |
| 2 | One `SKILL.md`: the steps for one job | When the task matches the description | Under 80 lines |
| 3 | `references/*.md`: tables, weights, pitfalls | Only when the SKILL.md says to | No limit, one topic per file |

The MCP server mirrors the same levels as tools: `list_skills` → `load_skill` → `load_reference`.

## The runtime

`mcp/server.js` is the portable runtime: JSON-RPC over stdio, no dependencies, so it runs anywhere Node 22 runs (laptop, sandbox, CI, a cloud session).
- **Knowledge tools**: always on.
- **App tools** call the repo's own code, so an agent in any client works exactly like the live site: `tag_text`, `analyze_text`, `parse_feed` (core), `list_modules` (the kernel's map), `ui_catalog` and `validate_spec` (generative UI), `list_judges` and `run_judge` (decision module). They turn on when the server finds the repo (`SI_REPO`, the working directory, or the kit's parent folder).
- **No network, no writes, no secrets.** Fetching stays with the client's own web tools, so the server is safe to run in sandboxes.

## Guardrails

The hard rules live in `CLAUDE.md` (for agents to read) and in `hooks/guard.js` (enforced before a tool runs, where the runtime supports hooks). The guard blocks:
- pushes to `main`;
- merges into `main`;
- Vercel and Neon changes;
- Twitter/X URLs written into source files.

Runtimes without hooks rely on the written rules, the git pre-push hook and preflight.

## Adding a runtime

Write an adapter that reads `agent-kit/` without changing it: a symlink, a generated file in `dist/`, or a client config for the MCP server. Add its check to `scripts/agent-kit.js` and a row to `README.md`.

## The app is pluggable too

The kit mirrors the app's own architecture: the app is a modular monolith (`kernel/`, `modules/`, see `modules/README.md`) where features plug into extension points (`http.routes`, `ui.nav`, `ui.blocks`, `ui.views`, `db.schema`, `feeds.formats`, `analysis.signals`, `decision.judges`). The add-a-module, generative-ui and run-a-judge skills cover building on it.
