# Superintelligence Homepage agent kit

Everything an agent needs to work on this repo, in one folder, usable from many runtimes. The same Markdown skills are loaded by Claude Code natively, by any MCP client through the bundled server, and by tools without either through the exported bundle.

| Part | What it is |
| --- | --- |
| `skills/<name>/SKILL.md` + `references/` | 13 skills, written for progressive disclosure: index → steps → details |
| `agents/*.md` | 3 subagents: source-scout, significance-reviewer, verifier |
| `hooks/` | Guard that blocks pushes to main, merges, deploys and Twitter/X sources |
| `mcp/server.js` | MCP server (no dependencies): skills as tools, resources and prompts, plus app tools: `tag_text`, `analyze_text`, `parse_feed`, `list_modules`, `ui_catalog`, `validate_spec`, `list_judges`, `run_judge` |
| `.claude-plugin/plugin.json`, `.mcp.json` | Claude Code plugin manifest |

How it fits together: [ARCHITECTURE.md](ARCHITECTURE.md).

## Use it

| Where | How |
| --- | --- |
| **Claude Code in this repo** (terminal, desktop app, web, cloud sessions) | Nothing to install. `.claude/skills/<name>` (one link per skill, so Spec Kit's skills sit beside them) and `.claude/agents` link here and `.claude/settings.json` turns on the guard. |
| **Claude Code anywhere else** | `/plugin marketplace add Matt-Baxter/superintelligence-home-page`, then `/plugin install si-homepage-kit@superintelligence-homepage`. Set `SI_REPO` to a clone to enable the app tools. |
| **Claude apps (claude.ai, desktop) and the Claude API** | `npm run kit:export`, then upload `dist/agent-kit/skills/<name>.zip` as a skill. |
| **Claude Desktop, Cursor, VS Code or any MCP client** | Add the server from `dist/agent-kit/mcp-configs.json` (`node <clone>/agent-kit/mcp/server.js`, env `SI_REPO=<clone>`). |
| **Codex, Cursor, Copilot, Jules** | They read `AGENTS.md` in the repo root; Cursor can also take `dist/agent-kit/cursor/si-homepage.mdc` as a rule. |
| **v0 or any chat** | Paste or attach `dist/agent-kit/agent-kit.md` (the whole kit as one file, index first). |
| **Local sandbox or CI** | `npm run kit:check` validates the kit; `npm run kit:mcp` starts the server on stdio. |

## Change it

1. Edit or add `skills/<name>/SKILL.md` (frontmatter `name` = folder, `description` saying "Use when …", under 80 lines). Put detail in `references/` and mention each file in the SKILL.md.
2. `npm run kit:sync` regenerates the index in `CLAUDE.md` and `AGENTS.md`.
3. `npm run preflight` runs `kit:check` (structure, links, index, manifests, MCP handshake).
4. Bump `version` in both `.claude-plugin/plugin.json` and the root `.claude-plugin/marketplace.json` when you change behaviour others rely on.
