---
name: open-pull-request
description: Prepare a branch and pull request for this repo following CONTRIBUTING.md. Use when the human asks to "make a PR", "push this", or "get this ready for review".
---

# Open a pull request

Follow [CONTRIBUTING.md](../../../CONTRIBUTING.md). You prepare the branch; the human opens or merges the PR on GitHub.

1. **Branch.** If on `main`, create `feature/<short-name>` (or `fix/…`, or stay on the human's `bakeoff/…` branch). Never commit to `main`.
2. **Check scope.** List the files changed. If any of these changed, flag it as a **contract change** and stop to tell the human before continuing:
   - a table in `lib/db.js`;
   - an API route, or a request or response shape, in `server.js`;
   - auth behaviour.

   A contract change needs a new row in `docs/CONTRACT.md` and both partners' approval.
3. **Build and test.**
   - `npm run build` if `client/` or `views/catalog.mjs` changed.
   - Start `npm run dev:sample` in the background, then run `npm test`.
   - It must end with `0 failed`. If anything fails, fix it or report it. Don't open a PR on red.
4. **Secrets check.** `git diff --cached` must not contain `.env`, keys, tokens, database URLs or passwords.
5. **Commit** with a one-line summary and a short why. Note that an agent did the work (for example `Co-Authored-By: Claude …`).
6. **Push** with `git push -u origin <branch>` and give the human the "Create a pull request" link the push prints.
7. **Draft the PR description** using `.github/pull_request_template.md`:
   - what changed;
   - its type;
   - the exact test line;
   - how to try it;
   - which agent did the work and what still needs a human to check.
8. **Agent log reminder.** If the human corrected you during this work, remind them to write it up in the app's Agent log page *in their own words*. Do not write or suggest the entry text.
