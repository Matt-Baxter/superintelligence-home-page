# Tasks: Sign-in protection, abuse guards and the test sign-in

**Spec**: [spec.md](spec.md)

Same rules as the other task files: `[agent]` any agent on a branch, `[people]` John and Matt decide. Nothing here changes a scoring rule.

- [ ] T000 [people] Approve or change spec 005 (REQ-057..REQ-062), including the default limits.
- [x] T010 [agent] [REQ-057] Hidden field and minimum fill time on sign-up; pause sign-up setting that never blocks the first account.
- [x] T011 [agent] [REQ-058] Per-account sign-in lock with a super-admin unlock.
- [x] T012 [agent] [REQ-059] Per-member budgets on claim checks, paper fetches, uploads, lab runs, knowledge queries, teardowns, UI validation and other writes.
- [x] T013 [agent] [REQ-060] Test sign-in on local and preview only, with audit rows.
- [x] T014 [agent] [REQ-061] Super-admin Security tab, per-environment settings row, audit on save.
- [x] T015 [agent] [REQ-062] Worked cases re-run live against the draft settings.
- [ ] T020 [agent] [REQ-058] [REQ-059] Move counters to a shared store (for example Upstash Redis) so limits hold across serverless instances.
