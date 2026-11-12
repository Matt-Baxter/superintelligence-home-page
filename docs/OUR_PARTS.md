# Our parts: who does what next

John Affolter and Matthew Baxter · SEIS 606 Project 2 · Superintelligence Homepage

Tick items off by editing this file (self-merge is fine). Details live in the linked guides.

## Due Nov 11, 5:15 pm: Week 9 homework (both of us)

Paul asked for three documents, and "these can be in a repo":

- [ ] **Working agreement:** [docs/WORKING_AGREEMENT.md](WORKING_AGREEMENT.md). Settle the `[confirm]` items (chat tool, check-in days, spending cap) and fill both "Confirmed" columns in the roles table.
- [ ] **Initial spec:** [docs/SPEC.md](SPEC.md). **Matt is writing this one**; the current file is a starting draft he can rewrite or replace.
- [ ] **Contract:** [docs/CONTRACT.md](CONTRACT.md). Both of us tick our boxes in the change log.
- [ ] **Submit:** once the three files are merged to `main`, each of us submits in Canvas (text entry) with the three GitHub links, and emails Paul the same links, since his slide said "submit via email".

## Matt (Claude · GitHub owner)

1. [ ] **Give Vercel access to the repo:** github.com/apps/vercel → Configure → Matt-Baxter → Only select repositories → add `superintelligence-home-page` → Save. ([DEPLOY.md](DEPLOY.md), step 1)
2. [ ] **Merge the setup pull request** `feature/vercel-postgres-and-plan-docs` once its Preflight check is green. It brings the Vercel and Postgres support, these docs, preflight and the Claude skills.
3. [ ] **Write the spec** in [docs/SPEC.md](SPEC.md) (and in the shared Plan doc if you like working there).
4. [ ] **Set up Claude Code** in the repo:
   ```bash
   git clone https://github.com/Matt-Baxter/superintelligence-home-page && cd superintelligence-home-page
   npm install            # also installs the pre-push preflight hook
   npm run preflight      # should end with "Preflight passed."
   claude                 # Claude Code reads CLAUDE.md and the skills in .claude/skills/
   ```
   Useful asks: "use the run-tests skill", "open a PR for this" (open-pull-request), "add the METR blog as a source" (add-feed-source), "I need a new field on stories" (change-the-contract), "work on my bake-off version" (bakeoff-entry).
5. [ ] **Start your bake-off branch** `bakeoff/claude-matt` from `main`.
6. [ ] **Agent log:** when Claude gets something wrong, write it up yourself in the app's Agent log page.

## John (v0 · Vercel owner)

1. [ ] **Create the Vercel project** in the account v0 uses: Add New → Project → import `Matt-Baxter/superintelligence-home-page` (after Matt's step 1). ([DEPLOY.md](DEPLOY.md), step 2)
2. [ ] **Add Neon:** Storage → Create Database → Neon, free plan, a US East region, connected to all environments. ([DEPLOY.md](DEPLOY.md), step 3)
3. [ ] **Add `CRON_SECRET`** (run `openssl rand -hex 32`) for Production and `APP_TZ=America/Chicago` for all environments, then deploy. ([DEPLOY.md](DEPLOY.md), steps 4–5)
4. [ ] **Sign up first** on the live site so you're the admin, then press **Fetch all now** on the Sources page and check the feeds show "OK".
5. [ ] **Start your bake-off** in v0 from the `bakeoff/v0-john` branch using the starter prompt in [docs/V0.md](V0.md).
6. [ ] **Agent log:** when v0 gets something wrong, write it up yourself in the app's Agent log page.

## Together, before building the bake-off

- [ ] Agree on the **comparison criteria and weights** for CLEF or JEV, and write them in `docs/BAKEOFF.md` (for example correctness on the tests, speed, code size, fit to the contract, and how it looks to classmates).
- [ ] Ask Paul for the **presentation date**. The live site has to be shared with the class at least 2 weeks before it.
