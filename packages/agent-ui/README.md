# agent-ui

Original React components for agent products: trails, plans, approvals, inboxes, away summaries and cited answers.
Written from scratch for the Superintelligence Homepage and partners; no third-party component code is copied.

- **No dependencies** beyond React 18+. One stylesheet of CSS variables (`agent-ui.css`): light and dark, reduced motion.
- **Keyboard first:** every action works without a mouse (plan reorder with Alt+Arrow, approvals with A/R/E scoped to the
  stack, inbox with arrow keys), focus moves to the next thing to decide, and status changes are announced to screen readers.
- **Honest UI:** clocks tick only while something runs; a citation without a source is flagged instead of linking nowhere;
  edited approval arguments must parse before they can be approved; high-risk approvals ask twice; decisions can be undone.
- **Plain text only:** nothing a model writes is rendered as HTML.

| Component | What it does |
| --- | --- |
| `AgentTrail` | Steps with live timer, sub-steps, approval waits, retry, folded history |
| `AgentPlan` | Editable plan: rename, reorder (drag or keys), add, remove, run, retry from a failed step |
| `ApprovalGates` / `ApprovalCard` | Stacked requests with risk, diff, JSON-editable arguments, reasons, undo |
| `AgentInbox` | Filterable, searchable task list with expandable rows and actions |
| `AwaySummary` | "While you were away" card that folds into a divider |
| `AIAnswer` | Streamed, cited answer with source previews, copy with sources, feedback, follow-ups |

## Install

As a shadcn-compatible registry (once this folder is served over HTTPS):

```bash
npx shadcn@latest add <registry-url>/agent-inbox.json
```

Or copy `registry/agent-ui/` into your project and import from `./agent-ui`; add `agent-ui.css` once.

## Demo

`npm run demo` bundles `demo/demo.tsx` (sample data only) into `demo/index.html`.
