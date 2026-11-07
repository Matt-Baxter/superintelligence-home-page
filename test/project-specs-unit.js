#!/usr/bin/env node
// Specs view parser (modules/project/specs.js, REQ-030 proposed) on fixture text (Sample, test data), then on the
// repo's own specs: REQ-001..REQ-040, approved for the shared 001 and proposed for the rest. No database, no network.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const S = require("../modules/project/specs");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };

const SPEC = `# Feature Specification: Sample spec (test data)

**Status**: Proposed, **not approved**. Sample text for the parser test.

### Functional Requirements

- **REQ-902**: The sample system SHOULD do a second thing.
- **REQ-901**: The sample system MUST do one thing
  across a wrapped line, and MUST NOT do another.
- **REQ-903**: The sample system MAY do a third thing.

## Success Criteria
- **SC-901**: Not a requirement.
`;
const TASKS = `# Tasks: Sample (test data)

- [ ] T001 [agent] [REQ-901] Sample open agent task (test data)
- [x] T002 [rules] [P] [REQ-901] [REQ-902] Sample done rules task (test data)
- [ ] T003 [people] Sample people task with no REQ (test data)
- [ ] not a task line
`;
const TRACE = `| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-901 | One thing | \`lib/sample.js\` with a \\| pipe | unit: "sample" |
| REQ-902–903 | Two things | \`modules/sample\` | not automated |
`;
const STATUS = `Measured on 2026-11-07 by the sample.

| Part of the spec | Automated and passing | Needs people | Open or failing |
| --- | --- | --- | --- |
| Functional requirements (3) | 2 (67%) | 1 | 0 |

| REQ | Status | Checks | Requirement |
| --- | --- | --- | --- |
| REQ-901 | Pass | 2 | The sample system MUST … |
`;

const s = S.parseSpec(SPEC);
ok(s.title === "Sample spec (test data)" && s.status === "proposed", `title and Status line: ${s.title} / ${s.status}`);
ok(s.reqs.map((r) => r.id).join() === "REQ-901,REQ-902,REQ-903", "requirements in id order, success criteria left out");
ok(s.reqs[0].text === "The sample system MUST do one thing across a wrapped line, and MUST NOT do another.", "a wrapped requirement is read whole");
ok(s.reqs.map((r) => r.level).join() === "MUST,SHOULD,MAY", "MUST / SHOULD / MAY levels");
ok(S.parseStatus("**Status**: Draft (shared bake-off spec; both partners build against it)").status === "approved", "the shared spec's Status line reads as approved");
ok(S.parseStatus("**Status**: Draft").status === "proposed", "anything else is proposed");
const t = S.parseTasks(TASKS);
ok(t.length === 3 && t[0].who === "agent" && !t[0].done && t[1].done && t[1].who === "rules" && t[1].reqs.join() === "REQ-901,REQ-902" && t[2].who === "people" && !t[2].reqs.length, "tasks: id, who tag, REQs, done");
const tr = S.parseTrace(TRACE);
ok(tr["REQ-901"].code === "`lib/sample.js` with a | pipe" && tr["REQ-901"].check === 'unit: "sample"', "trace row: code and check, escaped pipe kept");
ok(tr["REQ-902"] && tr["REQ-903"] && tr["REQ-903"].check === "not automated", "a range row (REQ-902–903) covers each REQ");
const st = S.parseStatusDoc(STATUS);
ok(st.measured === "2026-11-07" && st.summary.length === 1 && st.summary[0].people === "1" && st.reqs["REQ-901"] === "Pass", "SPEC_STATUS: date, summary and per-REQ status");
ok(S.parseStatusDoc("") === null, "no status file is null");

// collect() on a throwaway tree built from the fixtures
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "si-specs-"));
fs.mkdirSync(path.join(dir, "specs", "901-sample"), { recursive: true }); fs.mkdirSync(path.join(dir, "docs")); fs.mkdirSync(path.join(dir, "modules", "project"), { recursive: true });
fs.writeFileSync(path.join(dir, "specs", "901-sample", "spec.md"), SPEC); fs.writeFileSync(path.join(dir, "specs", "901-sample", "tasks.md"), TASKS);
fs.writeFileSync(path.join(dir, "docs", "SPEC_TRACE.md"), TRACE); fs.writeFileSync(path.join(dir, "docs", "SPEC_STATUS.md"), STATUS);
fs.writeFileSync(path.join(dir, "modules", "project", "sync.json"), JSON.stringify({ people: { "REQ-903": "Sample people check (test data)", "SC-901": "Sample (test data)" } }));
const c = S.collect({ root: dir }), r1 = c.reqs.find((r) => r.id === "REQ-901"), r3 = c.reqs.find((r) => r.id === "REQ-903");
ok(c.source === "files" && c.specs.length === 1 && c.specs[0].totals.reqs === 3 && c.specs[0].totals.open === 2 && c.specs[0].totals.done === 1, "per-spec totals");
ok(r1.open === 1 && r1.done === 1 && r1.trace.code.includes("lib/sample.js") && r1.measured === "Pass", "a REQ carries its tasks, trace and measured status");
ok(r3.people === "Sample people check (test data)" && c.people.length === 1 && c.people[0].id === "SC-901", "people checks: on the REQ, and the rest listed apart");
ok(c.specs[0].unlinkedTasks.map((x) => x.id).join() === "T003", "tasks with no REQ are kept on the spec");
fs.rmSync(dir, { recursive: true, force: true });

// The repo's own specs
const real = S.collect(), ids = real.reqs.map((r) => r.id);
const want = Array.from({ length: 52 }, (_, i) => `REQ-${String(i + 1).padStart(3, "0")}`);
ok(want.every((id) => ids.includes(id)) && ids.length === 52, `repo: REQ-001..REQ-052 (${ids.length})`);
ok(real.reqs.every((r) => r.status === (r.spec === "001" ? "approved" : "proposed")), "repo: 001 approved, 002, 003 and 004 proposed");
ok(real.reqs.filter((r) => r.spec === "004").length === 12 && real.reqs.find((r) => r.id === "REQ-042").tasks.some((x) => x.id === "T011"), "repo: 004 has REQ-041..REQ-052, REQ-042 its tasks");
ok(real.reqs.every((r) => r.trace), "repo: every REQ has a trace row");
ok(real.reqs.find((r) => r.id === "REQ-019").people && real.reqs.find((r) => r.id === "REQ-037").tasks.some((x) => x.id === "T041"), "repo: REQ-019 has its people check, REQ-037 its tasks");
// Deployments without specs/ (Vercel bundles modules/** only) read the build snapshot instead.
S.writeSnapshot(); const empty = fs.mkdtempSync(path.join(os.tmpdir(), "si-specs-none-")), snap = S.collect({ root: empty });
ok(snap.source === "snapshot" && snap.reqs.length === 52 && snap.reqs[0].trace, "no specs/ folder: the build snapshot answers with the same 52 REQs");
fs.rmSync(empty, { recursive: true, force: true });
console.log(`\nproject specs unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
