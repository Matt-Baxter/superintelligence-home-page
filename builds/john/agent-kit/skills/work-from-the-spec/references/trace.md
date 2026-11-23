# The trace (docs/SPEC_TRACE.md)

One row per requirement or range, in this shape:

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-003 | Only superintelligence stories | `scope()` in `lib/analysis.js`, `stories.in_scope` | e2e: "REQ-003 / SC-003" |

- Ranges are fine (`REQ-009–012` or `REQ-009-012`); preflight expands them.
- "Checked by" names the exact check text printed by `npm test` or `npm run preflight`, so anyone can find it. A requirement with no automated check (REQ-019: live 2 weeks early) says "not automated" and how it's checked.
- Acceptance scenarios: name tests `US<story>-<scenario>` (for example `US1-5`), and success criteria `SC-00n`.
- Work that serves no requirement goes under "Beyond the spec" with a note, until both partners add it to the spec or it's removed.
- Preflight parses REQ IDs from `**REQ-0xx**` in every `specs/*/spec.md`.
