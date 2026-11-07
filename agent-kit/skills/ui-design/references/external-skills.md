# Design skills worth installing

These are third-party or Anthropic skills that the humans can add to their own Claude Code (`/plugin` or by copying into `~/.claude/skills`). They aren't vendored here: check each licence first, and install them yourselves. The ui-design skill and `scripts/unslop.js` already cover the rules this repo needs, so these are optional depth.

| Skill | Source | Good for |
| --- | --- | --- |
| Frontend Design (Anthropic) | github.com/anthropics/claude-code (plugins) | Picking a deliberate aesthetic direction before coding; it bans the overused fonts. |
| Web Design Guidelines / agent skills (Vercel) | github.com/vercel-labs/agent-skills | Auditing UI against 100+ accessibility, performance and UX rules. |
| hallmark | github.com/Nutlope/hallmark (MIT) | Anti-slop gates and an `audit` mode that scores existing code. |
| Emil Kowalski's design skill | github.com/emilkowalski/skill | Animations, transitions and micro-interactions (the source of the motion rules). |
| UX Heuristics | github.com/wondelai/skills | Nielsen's 10 heuristics with severity scores. |
| Refactoring UI audit | github.com/LovroPodobnik/refactoring-ui-skill | Hierarchy, spacing, shadow and colour reviews. |
| Bencium UX designer | github.com/bencium/bencium-claude-code-design-skill | WCAG and motion reference docs. |
| Theme Factory, Canvas Design (Anthropic) | github.com/anthropics/skills | Palettes and type pairings; posters and graphics. |

Lists of these: pasqualepillitteri.it ("Best Claude Code skills for UI/UX design") and uxplanet.org ("Must-have UX/UI design skills for Claude Code").

## Checked on Nov 7, 2026

- **impeccable** (pbakaus, Apache-2.0) has audit, critique and polish workflows, but Skillstore rates its current version critical-risk: a live server that exposes its token over wildcard CORS, a shell-injection risk and subprocesses that bypass approvals. Don't install it until that review clears ([Skillstore](https://skillstore.io/skills/pbakaus-impeccable)).
- **minimalist-ui** (leonxlnx/taste-skill, MIT) prescribes warm monochrome, flat bordered cards and no heavy shadows, which is close to this repo's monochrome pass ([Skillstore](https://skillstore.io/skills/leonxlnx-minimalist-ui)).
- This repo's own look since the monochrome pass: neutral greys with black ink, status shown by fill and outline (never hue), 4px corners everywhere, Newsreader for headlines and story titles, IBM Plex Sans for the interface, fonts self-hosted in `public/fonts`. Before-and-after screenshots: `node test/design-shots.js <label>` writes `shots/design/`.
