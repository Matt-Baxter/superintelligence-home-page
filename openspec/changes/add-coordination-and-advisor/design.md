# Design: Planning and coordination for people and agents, and the advisor

## Context

People (John, Matt) and agents (Claude sessions, scheduled routines, v0) change one repo in parallel on many branches.
The task lists already say a lot: tags say who may take a task, a gate line says what waits for an approval, and most
tasks end with the files they touch. What was missing was one view of them, a way to say "I'm on this", and checks
that use both.

## Decisions

- **Read the plans, don't duplicate them.** Work items are parsed from `specs/<nnn>/tasks.md` and
  `openspec/changes/<id>/tasks.md` on every request (cached a minute); there is no task table to drift. Files come
  from the parenthesised paths in a task's text; dependencies from gates and "after T123" / "after 2.1".
- **Claims are leases.** A claim expires on its own (agent 2 h, person 24 h, presence 15 min, at most 72 h), so a
  crashed agent never holds work forever. Renewing is claiming again. Released and expired claims are pruned after 30
  days (Neon Free).
- **Hard conflicts refuse; soft ones warn.** Same task, overlapping files, a gated task, a task the actor may not take
  and a shared document refuse a claim. Open branches changing the same files, a done task and someone viewing the same
  page only warn. A person may force past a refusal (except eligibility); the claim records it and the board lists it.
  Agents can't force: a disagreement between agents goes to a person.
- **Paths overlap by folder or glob prefix**, not by a shared string prefix (`modules/sam/` doesn't hold
  `modules/sample/x.js`).
- **One transaction per claim**, serialised with an advisory lock on Postgres, so two claims can't both pass the check.
- **Stale writes: optimistic concurrency.** The builder sends the version it shows; the action compares it with the
  current one and refuses with who saved in between. The check runs inside the save's transaction with the artifact row locked
  (`FOR UPDATE` on Postgres), so of N simultaneous saves of one version exactly one lands.
- **Branches from git, not a service.** `npm run work -- sync` diffs each `origin/*` branch against `origin/main` and
  writes `out/work/branches.json`. No GitHub API calls, no polling.
- **The hook needs no database.** Every claim change writes `out/work/claims.json`; the guard hook reads it, finds the
  repo from the edited file, and blocks with the holder and expiry. A missing file allows the edit (best effort).
- **The advisor suggests; people decide.** Rules are small functions over gathered facts; each finding has a stable id
  (hash of rule, subject and reason) so accept and dismiss stick, a draft, and the file it belongs in. A finding on a
  shared document says it needs both partners. Nothing is written for the user. The closest capability for an unmapped
  requirement is chosen by word overlap (Jaccard over content words); the trace row for an untraced requirement is
  filled from the files that name it.
- **Explainable ranks.** The planner's score is a sum of named points, like the significance score; the weights are
  constants in `planner.js` and every reason is shown.

## Risks / Trade-offs

- Claims on local SQLite are per machine. Shared claims need `DATABASE_URL` on every agent's machine (task T923 is the
  people's call).
- File lists in task text are only as good as the text; a task without files can only collide by task.
- The advisor's rules can be noisy; dismissals keep the list short, and `severity` separates errors from ideas.
