# Handoff: start here (Codex, v0 and any other agent)

Written 2026-11-07 (on branch `feature/judge-fidelity-rules`, which contains `feature/judge-fidelity-spec`, until merged), so the work can move between agents. In the bake-off, **Matt builds with Claude Code** and **John builds with v0 or Codex**; other agents (the scheduled paper watch, helpers) follow the same rules. Everything an agent needs to carry on is in this repository; nothing lives only in a chat.

## Read in this order

1. [`AGENTS.md`](../AGENTS.md) and [`CLAUDE.md`](../CLAUDE.md): the hard rules. They apply to every agent, whatever its name. In short: never push to or merge into `main`; never deploy or change Vercel, Neon or GitHub settings; no secrets; no Twitter/X; spec first, with REQ IDs; the spec, constitution, CONTRACT.md and WORKING_AGREEMENT.md need both humans; free tiers only; real people only as watchlist entries; synthetic, labelled test data; no co-author trailers; never write agent log entries.
2. [`STATE.md`](STATE.md): where things stand today, which branches hold what, and the decisions waiting for the humans.
3. The open work: [`specs/004-parity/tasks.md`](../specs/004-parity/tasks.md) (newest: parity gaps) and [`specs/003-judge-fidelity/tasks.md`](../specs/003-judge-fidelity/tasks.md), and the proposed requirements in [`specs/002-research-layer/spec.md`](../specs/002-research-layer/spec.md) and [`specs/003-judge-fidelity/spec.md`](../specs/003-judge-fidelity/spec.md). The shared spec is [`specs/001-superintelligence-homepage/spec.md`](../specs/001-superintelligence-homepage/spec.md). How the site compares with 35 other AI-news and research apps, with the gaps ranked: [`docs/PARITY.md`](../docs/PARITY.md); the gaps that need new requirements are proposed in [`specs/004-parity/spec.md`](../specs/004-parity/spec.md) (REQ-041..REQ-052, not approved) with [`tasks.md`](../specs/004-parity/tasks.md).
4. The skill for the job: [`agent-kit/skills/<name>/SKILL.md`](../agent-kit/skills) (plain Markdown, any tool; index in AGENTS.md).
5. When you need something else: [`docs/HUB.md`](../docs/HUB.md), one generated page with every skill, spec, check, measure, pitfall and open decision.

## How work moves

- **Pick a task** from a `specs/<nnn>/tasks.md`. The tag says who may do it: `[agent]` any agent, unattended; `[rules]` changes scoring, only when a person asks in a session; `[people]` the humans.
- **Branch** from `fix/sync-with-main` (or `main` once that is merged): `feature/<short-name>`. One task, or a few small related ones, per branch.
- **Check**: `npm run preflight` (includes the judge edge cases), `npm run bench`, and `npm test` for bigger changes (start `PORT=3200 node test/serve-fixtures.js` first). Report the exact pass/fail lines.
- **Tick** the task's checkbox in the same commit that finishes it, and name its REQ IDs in the commit message.
- **Push the branch**; the humans open and merge the pull request. `node scripts/project-sync.js` mirrors every task and proposal into the Project tracker (`/m/project`), and a ticked box moves its issue to Done.

## Per tool

- **Codex**: open the repo locally (`git clone https://github.com/Matt-Baxter/superintelligence-home-page`, `npm ci`). Codex reads `AGENTS.md` from the repo root down to the folder it works in (not `CLAUDE.md`), so `AGENTS.md` carries the full rules and commands; keep it under Codex's 32 KiB default. Paste [`prompts/codex.md`](prompts/codex.md) as the first message. The daily paper watch is written out for Codex in [`routines/paper-watch.md`](routines/paper-watch.md).
- **v0**: import the GitHub repo with `bakeoff/v0-john` as the base branch; v0 works on its own branch and opens pull requests into it ([`docs/V0.md`](../docs/V0.md) has the steps and v0's habits to watch for). Paste [`prompts/v0.md`](prompts/v0.md) as the first message. v0 can't run the local checks: watch the Preflight check on GitHub.

## What's in this folder

| File | What it is |
| --- | --- |
| [`STATE.md`](STATE.md) | Status on 2026-11-07: branches, today's papers and toy, dossier ratings, check results, open decisions |
| [`prompts/codex.md`](prompts/codex.md) | First message for Codex |
| [`prompts/v0.md`](prompts/v0.md) | First message for v0 |
| [`routines/paper-watch.md`](routines/paper-watch.md) | The daily paper-watch routine, written for any agent |
| [`MANIFEST.md`](MANIFEST.md) | Every file the handoff points at, grouped, so nothing is missed |
