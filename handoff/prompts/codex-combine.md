# Codex: first message to paste

You are working in this repository on John Affolter's behalf. Read `AGENTS.md`, then `handoff/SI-HANDOFF-2026-11-07.md`, and follow both exactly.

Do task 1 in section 3 of the handoff: create `feature/si-combined` from `fix/sync-with-main`, bring in `origin/feature/judge-fidelity-rules` with `git merge --squash`, resolve the conflicts area by area as the handoff describes (keep both judges' improvements; union the benchmark items; one PARITY, INTERFACES and SPEC_TRACE), and commit each area separately.

Hard rules: commit as John Affolter <affo4353@stthomas.edu> (`git config user.name "John Affolter"`, `git config user.email "affo4353@stthomas.edu"`); no trailers of any kind; never name an AI assistant, model or vendor in commits, files or reports; never push to `main` or any of Matt's branches; never merge, deploy or force-push; do not renumber requirements until John says the numbering is agreed.

Then run every check listed in section 3, step 2, and report each exact pass/fail line. If everything passes, push `feature/si-combined` and stop. If anything fails, push nothing and report what failed and where.
