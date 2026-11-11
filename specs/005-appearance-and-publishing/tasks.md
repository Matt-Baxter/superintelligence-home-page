# Tasks: Appearance, CMS delivery and content generation

**Spec**: [spec.md](spec.md)

Same tags as `specs/004-parity/tasks.md`: `[agent]` any agent on a `feature/` branch, `[rules]` changes scoring (only when a person asks), `[people]` John and Matt decide. **Format**: `- [ ] T### [who] [REQ-0xx] description (files)`.

## Phase 0: approval

- [ ] T500 [people] [REQ-053] Approve, change or drop REQ-053..REQ-055, and confirm that a reader's look kept in their browser is a preference, not personal data under REQ-012.
- [ ] T501 [people] [REQ-053] Decide whether any theme may have a colour accent (today every theme keeps the ink accent).

## Phase 1: built on feature/themes-layouts-cms-2026-11-11

- [x] T510 [agent] [REQ-053] Appearance module: catalog, site default with audit, public options route, admin page with preview (modules/appearance)
- [x] T511 [agent] [REQ-053] Reader Display menu and the look on <html> (public/js/api.js), theme, layout, type and size CSS (public/css/app.css)
- [x] T512 [agent] [REQ-053] Contrast check reads every theme block (scripts/unslop.js)
- [x] T520 [agent] [REQ-054] RSS, JSON Feed and embed card for published posts (modules/editorial/routes.js, content.js, pages/journal.html)
- [x] T530 [agent] [REQ-055] Rule-written drafts: weekly digest, topic round-up, story explainer (modules/editorial/content.js)
- [x] T531 [agent] [REQ-055] Channel versions of a saved draft, no Twitter/X (modules/editorial/content.js, pages/editorial.html)
- [x] T540 [agent] [REQ-053] Unit and browser checks (test/publishing-unit.js, test/e2e.js)

## Phase 2: later

- [ ] T550 [agent] [REQ-053] Keep a signed-in reader's look with their account so it follows them between devices (needs T500's answer on REQ-012)
- [ ] T551 [agent] [REQ-054] Atom output to match REQ-045 if both partners prefer one feed format
