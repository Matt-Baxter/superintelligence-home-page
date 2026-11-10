---
name: open-pull-request
description: Prepare a branch, commit and pull request description for this repo (the human opens and merges the PR once preflight is green; no review needed). Use when asked to "make a PR", "push this", "ship this" or "merge it".
---

# Open a pull request

Follow [CONTRIBUTING.md](../../../CONTRIBUTING.md). You prepare the branch; the human opens the PR and merges it themselves once preflight is green. No review is required.

1. **Branch.** If on `main`, create `feature/<short-name>` (or `fix/…`, or stay on the human's `bakeoff/…` branch). Never commit to `main`.
2. **Check scope.** List the files changed. If any of these changed, flag it as a **contract change** and stop to tell the human before continuing:
   - a table in `lib/db.js`;
   - an API route, or a request or response shape, in `server.js`;
   - auth behaviour.

   Name the spec REQ IDs the change serves and update `docs/SPEC_TRACE.md`. A table, route or shape change gets a row in `docs/INTERFACES.md`; a change to the spec, constitution, CONTRACT.md or WORKING_AGREEMENT.md needs both partners.
3. **Preflight.** Run `npm run preflight` (about 3 seconds). It must end with "Preflight passed." For bigger UI or logic changes, also start `npm run dev:sample` and run `npm test` (the full browser test). Don't hand over a red branch.
4. **Secrets.** Preflight scans for them, but also glance at `git diff --cached` for anything private.
5. **Commit** with a one-line summary and a short why, naming the REQ ids. No co-author or session trailers: the humans asked for commits without them.
6. **Push** with `git push -u origin <branch>` and give the human the "Create a pull request" link the push prints. If the branch was cut from another unmerged branch, say which PR must merge first.
   Asked to merge? Explain that a human merges (hard rule) and give the merge order instead.
7. **Draft the PR description** using `.github/pull_request_template.md`:
   - what changed;
   - its type;
   - the exact test line;
   - how to try it;
   - which agent did the work and what still needs a human to check.
8. **Agent log reminder.** If the human corrected you during this work, remind them to write it up in the app's Agent log page *in their own words*. Do not write or suggest the entry text.
