#!/usr/bin/env node
// Measure the shared spec from acceptance evidence. Failing evidence always wins over a passing check.
const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "..");
const DEFAULT_SPEC = fs.readFileSync(path.join(root, "specs/001-superintelligence-homepage/spec.md"), "utf8");
function buildReport(R, { spec = DEFAULT_SPEC, people = require("../modules/project/sync.json").people, timeZone = process.env.APP_TZ || "America/Chicago" } = {}) {
  const ids = (value) => Array.isArray(value) && value.every((id) => typeof id === "string" && id.trim().length > 0);
  if (!R || typeof R.ranAt !== "string" || !Number.isFinite(Date.parse(R.ranAt)) || typeof R.browser !== "boolean" || !Array.isArray(R.results) || !R.results.length || R.results.some((r) => !r || !ids(r.ids) || !r.ids.length || typeof r.pass !== "boolean") || (R.uncovered !== undefined && !ids(R.uncovered)) || (R.testable !== undefined && !ids(R.testable))) throw new Error("Acceptance evidence is missing or malformed.");
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
const PEOPLE = people; // shared with scripts/project-sync.js
// People checks win even when an automated proxy passes (e.g. SC-001's layout check doesn't time a real classmate).
const state = (id) => (PEOPLE[id] ? "people" : failed(id).length ? "failing" : passed(id).length ? "passing" : "open");
const icon = { passing: "Pass", people: "People check", failing: "Failing", open: "Open" };
const count = (list) => { const c = { passing: 0, people: 0, failing: 0, open: 0 }; list.forEach((x) => c[state(x.id)]++); return c; };
const cR = count(reqs), cS = count(scs), cU = count(scen);
const pct = (c, n) => Math.round((100 * c) / n);

const zone = timeZone;
const measuredDay = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(R.ranAt));
const scopeNote = /at least one superintelligence topic/.test(spec.replace(/\s+/g, " ")) && require("../lib/ontology.json").scope.min_topics > 1
  ? "> **Unresolved scope interpretation:** REQ-003 describes one-topic relevance; the current filter requires a strong term or two root topics. Weak borderline matches are also excluded by the spec. Passing fixture checks do not resolve this policy interpretation; John and Matt must confirm it. See [LOGIC_AUDIT.md](LOGIC_AUDIT.md)." : "";
const L = [`# Spec status`, "",
  `Measured on ${measuredDay} (${zone}) by \`scripts/spec-status.js\`, from the spec acceptance suite (\`test/spec-acceptance.js${R.browser ? " --browser" : ""}\`, ${R.results.filter((r) => r.pass).length} of ${R.results.length} checks passing) against the **spec version** of the site with labelled synthetic sources. Regenerate with \`npm run spec:status\`.`, "",
  ...(scopeNote ? [scopeNote, ""] : []), "## Summary", "",
  "| Part of the spec | Automated and passing | Needs people | Open or failing |", "| --- | --- | --- | --- |",
  `| Functional requirements (${reqs.length}) | ${cR.passing} (${pct(cR.passing, reqs.length)}%) | ${cR.people} | ${cR.open + cR.failing} |`,
  `| Acceptance scenarios (${scen.length}) | ${cU.passing} (${pct(cU.passing, scen.length)}%) | ${cU.people} | ${cU.open + cU.failing} |`,
  `| Success criteria (${scs.length}) | ${cS.passing} (${pct(cS.passing, scs.length)}%) | ${cS.people} | ${cS.open + cS.failing} |`, "",
  `**What's left:** ${cR.open + cR.failing + cU.open + cU.failing + cS.open + cS.failing ? "Open or failing checks remain; resolve them before claiming automated coverage." : "All listed automated requirements and scenarios pass in this local fixture run."} ${[...reqs, ...scs].filter((x) => state(x.id) === "people").map((x) => x.id).join(", ")} need people to confirm. A passing local restart check can demonstrate database persistence across an application restart; it does not prove a production redeployment.`, "",
  "## Requirements", "", "| REQ | Status | Checks | Requirement |", "| --- | --- | --- | --- |",
  ...reqs.map((r) => `| ${r.id} | ${icon[state(r.id)]} | ${passed(r.id).length || (PEOPLE[r.id] ? "—" : 0)} | ${r.text.slice(0, 140)}${r.text.length > 140 ? "…" : ""}${PEOPLE[r.id] ? ` *(${PEOPLE[r.id]})*` : ""} |`), "",
  "## Acceptance scenarios", "", "| Scenario | Status | Story |", "| --- | --- | --- |",
  ...scen.map((s) => `| ${s.id} | ${icon[state(s.id)]} | ${s.story} |`), "",
  "## Success criteria", "", "| SC | Status | Criterion |", "| --- | --- | --- |",
  ...scs.map((s) => `| ${s.id} | ${icon[state(s.id)]} | ${s.text.slice(0, 150)}${PEOPLE[s.id] ? ` *(${PEOPLE[s.id]})*` : ""} |`), "",
  "## Beyond the spec", "", "The extended version (`SITE_PROFILE=extended`) adds work that serves no REQ. It is listed with proposed requirements in `docs/PLAN_NEXT.md` and `docs/FUTURE_IDEAS.md`, and none of it is needed for the bake-off.", ""];
  const problems = R.results.filter((r) => !r.pass).length + (R.uncovered || []).length + cR.open + cR.failing + cU.open + cU.failing + cS.open + cS.failing;
  return { markdown: L.join("\n"), problems, reqs: cR, scenarios: cU, criteria: cS, state };
}
function main() {
  let file = (process.argv.find((a) => a.startsWith("--from=")) || "").slice(7);
  let failedRun = false;
  if (!file) {
    file = path.join(require("node:os").tmpdir(), `spec-results-${Date.now()}.json`);
    try { execFileSync(process.execPath, ["test/spec-acceptance.js", "--browser", `--json=${file}`], { cwd: root, stdio: "pipe" }); }
    catch (e) { failedRun = true; if (!fs.existsSync(file)) throw new Error(String(e.stdout || e.message)); }
  }
  const report = buildReport(JSON.parse(fs.readFileSync(file, "utf8")));
  const output = (process.argv.find((a) => a.startsWith("--out=")) || "").slice(6) || path.join(root, "docs/SPEC_STATUS.md");
  fs.writeFileSync(output, report.markdown);
  console.log(`spec status: requirements ${report.reqs.passing}/20 passing (${report.reqs.people} need people), scenarios ${report.scenarios.passing}, success criteria ${report.criteria.passing} (${report.criteria.people} need people) -> ${path.relative(root, output)}`);
  if (report.problems || failedRun) process.exitCode = 1;
}
module.exports = { buildReport };
if (require.main === module) { try { main(); } catch (e) { console.error(`spec status: ${e.message}`); process.exitCode = 1; } }
