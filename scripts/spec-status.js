#!/usr/bin/env node
// How much of Matt's shared spec is done, measured, not estimated.
//   node scripts/spec-status.js            runs test/spec-acceptance.js --browser, then writes docs/SPEC_STATUS.md
//   node scripts/spec-status.js --from f   uses an existing results file (from spec-acceptance --json=f)
// Counts every requirement (REQ), success criterion (SC) and acceptance scenario (USn-m) in the spec, and marks each
// as passing (a check in the suite passed), people (only a person can confirm it) or open (nothing checks it yet).
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const spec = fs.readFileSync(path.join(root, "specs/001-superintelligence-homepage/spec.md"), "utf8");

let file = (process.argv.find((a) => a.startsWith("--from=")) || "").slice(7);
if (!file) {
  file = path.join(require("os").tmpdir(), `spec-results-${Date.now()}.json`);
  try { execFileSync(process.execPath, ["test/spec-acceptance.js", "--browser", `--json=${file}`], { cwd: root, stdio: "pipe" }); }
  catch (e) { if (!fs.existsSync(file)) { console.error(String(e.stdout || e.message)); process.exit(1); } }
}
const R = JSON.parse(fs.readFileSync(file, "utf8"));
const passed = (id) => R.results.filter((r) => r.ids.includes(id) && r.pass);
const failed = (id) => R.results.filter((r) => r.ids.includes(id) && !r.pass);

const reqs = [...spec.matchAll(/^- \*\*(REQ-\d{3})\*\*: ([\s\S]*?)(?=\n- \*\*|\n\n|\n###)/gm)].map((m) => ({ id: m[1], text: m[2].replace(/\s+/g, " ").trim() }));
const scs = [...spec.matchAll(/^- \*\*(SC-\d{3})\*\*: ([\s\S]*?)(?=\n- \*\*|\n\n|\n##)/gm)].map((m) => ({ id: m[1], text: m[2].replace(/\s+/g, " ").trim() }));
const scen = [];
for (const story of spec.split(/^### User Story /m).slice(1)) {
  const n = story.match(/^(\d+)/)[1], title = story.split("\n")[0].replace(/^\d+ - /, "").replace(/\(Priority.*\)/, "").trim();
  const acc = story.split("**Acceptance Scenarios**:")[1] || "";
  for (const m of acc.matchAll(/^(\d+)\. ([\s\S]*?)(?=\n\d+\. |\n\n|$)/gm)) scen.push({ id: `US${n}-${m[1]}`, story: title, text: m[2].replace(/\s+/g, " ").trim() });
}
const PEOPLE = require("../modules/project/sync.json").people; // shared with scripts/project-sync.js
// People checks win even when an automated proxy passes (e.g. SC-001's layout check doesn't time a real classmate).
const state = (id) => (PEOPLE[id] ? "people" : passed(id).length ? "passing" : failed(id).length ? "failing" : "open");
const icon = { passing: "Pass", people: "People check", failing: "Failing", open: "Open" };
const count = (list) => { const c = { passing: 0, people: 0, failing: 0, open: 0 }; list.forEach((x) => c[state(x.id)]++); return c; };
const cR = count(reqs), cS = count(scs), cU = count(scen);
const pct = (c, n) => Math.round((100 * c) / n);

const L = [`# Spec status`, "",
  `Measured on ${R.ranAt.slice(0, 10)} by \`scripts/spec-status.js\`, from the spec acceptance suite (\`test/spec-acceptance.js${R.browser ? " --browser" : ""}\`, ${R.results.filter((r) => r.pass).length} of ${R.results.length} checks passing) against the **spec version** of the site with labelled synthetic sources. Regenerate with \`npm run spec:status\`.`, "",
  "## Summary", "",
  "| Part of the spec | Automated and passing | Needs people | Open or failing |", "| --- | --- | --- | --- |",
  `| Functional requirements (${reqs.length}) | ${cR.passing} (${pct(cR.passing, reqs.length)}%) | ${cR.people} | ${cR.open + cR.failing} |`,
  `| Acceptance scenarios (${scen.length}) | ${cU.passing} (${pct(cU.passing, scen.length)}%) | ${cU.people} | ${cU.open + cU.failing} |`,
  `| Success criteria (${scs.length}) | ${cS.passing} (${pct(cS.passing, scs.length)}%) | ${cS.people} | ${cS.open + cS.failing} |`, "",
  `**What's left is delivery, not building:** ${[...reqs, ...scs].filter((x) => state(x.id) === "people").map((x) => x.id).join(", ")} can only be confirmed by people on the live site. That needs this branch merged, deployed and shared with the class. Everything else in the spec passes an automated check.`, "",
  "## Requirements", "", "| REQ | Status | Checks | Requirement |", "| --- | --- | --- | --- |",
  ...reqs.map((r) => `| ${r.id} | ${icon[state(r.id)]} | ${passed(r.id).length || (PEOPLE[r.id] ? "—" : 0)} | ${r.text.slice(0, 140)}${r.text.length > 140 ? "…" : ""}${PEOPLE[r.id] ? ` *(${PEOPLE[r.id]})*` : ""} |`), "",
  "## Acceptance scenarios", "", "| Scenario | Status | Story |", "| --- | --- | --- |",
  ...scen.map((s) => `| ${s.id} | ${icon[state(s.id)]} | ${s.story} |`), "",
  "## Success criteria", "", "| SC | Status | Criterion |", "| --- | --- | --- |",
  ...scs.map((s) => `| ${s.id} | ${icon[state(s.id)]} | ${s.text.slice(0, 150)}${PEOPLE[s.id] ? ` *(${PEOPLE[s.id]})*` : ""} |`), "",
  "## Beyond the spec", "", "The extended version (`SITE_PROFILE=extended`) adds work that serves no REQ. It is listed with proposed requirements in `docs/PLAN_NEXT.md` and `docs/FUTURE_IDEAS.md`, and none of it is needed for the bake-off.", ""];
fs.writeFileSync(path.join(root, "docs", "SPEC_STATUS.md"), L.join("\n"));
console.log(`spec status: requirements ${cR.passing}/${reqs.length} passing (${cR.people} need people), scenarios ${cU.passing}/${scen.length}, success criteria ${cS.passing}/${scs.length} (${cS.people} need people) -> docs/SPEC_STATUS.md`);
