# Our parts: who does what next

John Affolter and Matthew Baxter · SEIS 606 Project 2 · Superintelligence Homepage

Tick items off by editing this file (self-merge is fine). Details live in the linked guides.

## Due Nov 11, 5:15 pm: Week 9 homework (both of us)

Paul asked for three documents, and "these can be in a repo":

- [ ] **Working agreement:** [WORKING_AGREEMENT.md](../WORKING_AGREEMENT.md). Settle the `[confirm]` items (chat tool, check-in days, spending cap) and both sign the bottom line.
- [x] **Initial spec:** [specs/001-superintelligence-homepage/spec.md](../specs/001-superintelligence-homepage/spec.md), written by Matt with Spec Kit under the [constitution](../.specify/memory/constitution.md). Open: REQ-020 (agent log: in the app, already built) and a session length for REQ-010 (30 days in John's build).
- [ ] **Contract:** [CONTRACT.md](../CONTRACT.md). Agree the comparison criteria weights, and both tick the change log (v0.5 also proposes constitution 1.2.0: review optional).
- [ ] **Submit:** once the three files are merged to `main`, each of us submits in Canvas (text entry) with the three GitHub links, and emails Paul the same links, since his slide said "submit via email".

## Matt (Claude · GitHub owner)

1. [ ] **Give Vercel access to the repo:** github.com/apps/vercel → Configure → Matt-Baxter → Only select repositories → add `superintelligence-home-page` → Save. ([DEPLOY.md](DEPLOY.md), step 1)
2. [ ] **Merge the setup pull request** `feature/vercel-postgres-and-plan-docs` once its Preflight check is green. It brings the Vercel and Postgres support, these docs, preflight and the Claude skills.
3. [x] **Write the spec** with Spec Kit (done: `specs/001-superintelligence-homepage`). Next: `/speckit-clarify` for REQ-020 and REQ-010, then `/speckit-plan` for your build.
4. [ ] **Set up Claude Code** in the repo:
   ```bash
   git clone https://github.com/Matt-Baxter/superintelligence-home-page && cd superintelligence-home-page
   npm install            # also installs the pre-push preflight hook
   npm run preflight      # should end with "Preflight passed."
   claude                 # Claude Code reads CLAUDE.md and the agent kit's skills (agent-kit/, linked from .claude/)
   ```
   Useful asks: "use the run-tests skill", "open a PR for this" (open-pull-request), "add the METR blog as a source" (add-sources), "this story is ranked too high" (tune-significance), "where does grouping happen?" (codebase-map), "I need a new field on stories" (change-the-contract), "work on my bake-off version" (bakeoff-entry), "which REQs does this serve?" (work-from-the-spec), plus Matt's Spec Kit skills (`/speckit-plan`, `/speckit-tasks`, …).
5. [ ] **Start your bake-off branch** `bakeoff/claude-matt` from `main`.
6. [ ] **Agent log:** when Claude gets something wrong, write it up yourself in the app's Agent log page.

## John (v0 · Vercel owner)

1. [ ] **Create the Vercel project** in the account v0 uses: Add New → Project → import `Matt-Baxter/superintelligence-home-page` (after Matt's step 1). ([DEPLOY.md](DEPLOY.md), step 2)
2. [ ] **Add Neon:** Storage → Create Database → Neon, free plan, a US East region, connected to all environments. ([DEPLOY.md](DEPLOY.md), step 3)
3. [ ] **Add `CRON_SECRET`** (run `openssl rand -hex 32`) for Production and `APP_TZ=America/Chicago` for all environments, then deploy. ([DEPLOY.md](DEPLOY.md), steps 4–5)
4. [ ] **Sign up first** on the live site so you're the admin, then **Admin → Harvest all now** and check the feeds show "OK".
5. [ ] **Start your bake-off** in v0 from the `bakeoff/v0-john` branch using the starter prompt in [docs/V0.md](V0.md).
6. [ ] **Agent log:** when v0 gets something wrong, write it up yourself in the app's Agent log page.

## Together, before building the bake-off

- [ ] Agree on the **comparison criteria and weights** in [CONTRACT.md](../CONTRACT.md) → Decision point (John proposed six, including staying on superintelligence). Score on the Decide page (`/m/decide`): weighted criteria, plus CLEF or JEV if you run them.
- [ ] Ask Paul for the **presentation date**. The live site has to be shared with the class at least 2 weeks before it.
