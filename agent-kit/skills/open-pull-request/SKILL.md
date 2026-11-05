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

   A contract change needs a new row in `docs/CONTRACT.md` and both partners' approval.
3. **Preflight.** Run `npm run preflight` (about 3 seconds). It must end with "Preflight passed." For bigger UI or logic changes, also start `npm run dev:sample` and run `npm test` (the full browser test). Don't hand over a red branch.
4. **Secrets.** Preflight scans for them, but also glance at `git diff --cached` for anything private.
5. **Commit** with a one-line summary and a short why. Note that an agent did the work (for example `Co-Authored-By: Claude …`).
6. **Push** with `git push -u origin <branch>` and give the human the "Create a pull request" link the push prints. If the branch was cut from another unmerged branch, say which PR must merge first.
   Asked to merge? Explain that a human merges (hard rule) and give the merge order instead.
7. **Draft the PR description** using `.github/pull_request_template.md`:
   - what changed;
   - its type;
   - the exact test line;
   - how to try it;
   - which agent did the work and what still needs a human to check.
8. **Agent log reminder.** If the human corrected you during this work, remind them to write it up in the app's Agent log page *in their own words*. Do not write or suggest the entry text.
