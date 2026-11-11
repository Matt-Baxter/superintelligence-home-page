#!/usr/bin/env node
// Work: planning and coordination for people and agents (proposed REQ-068..REQ-071, spec 009,
// openspec/changes/add-coordination-and-advisor). Synthetic sample tasks and users only, on a disposable database.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { spawnSync } = require("node:child_process");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
process.env.SITE_PROFILE = "extended"; process.env.FETCH_MINUTES = "0";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-work-"));
process.env.WORK_OUT = fs.mkdtempSync(path.join(os.tmpdir(), "si-work-out-"));
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ""; delete process.env.POSTGRES_URL;
process.env.KG_ENGINE = process.env.KG_ENGINE || "oxigraph";
const I = require("../modules/work/items"), O = require("../modules/work/overlap"), P = require("../modules/work/planner"), A = require("../modules/work/advisor");

const SPEC = `# Tasks: Sample (test data)
Nothing below starts until T900 is done.
## Phase 0
- [ ] T900 [people] [REQ-901] Approve the sample requirement
## Phase 1
- [ ] T910 [agent] [REQ-901] Build the sample reader (modules/sample/reader.js, test/sample-unit.js)
- [ ] T911 [agent] [REQ-902] Sample page after T910 (\`modules/sample/pages/\`)
- [x] T912 [agent] [REQ-901] Done already (modules/sample/old.js)
- [ ] T913 [rules] [REQ-902] Change the sample scoring (modules/sample/reader.js)`;
const CHANGE = `## 1. Built
- [x] 1.1 [agent] Sample store (modules/sample/store.js)
## 2. Gate for phase 2
- [ ] 2.1 [people] Decide the sample question
## 3. Phase 2
- [ ] 3.1 [agent] Sample encoder (modules/sample/encoder.js)
- [ ] 3.2 [agent] Sample walker after 3.1 (modules/sample/encoder.js, modules/sample/walk.js)`;

(async () => {
  console.log("REQ-068: work items from Spec Kit and OpenSpec");
  const items = I.link([...I.fromSpecKit(SPEC, "900"), ...I.fromOpenSpec(CHANGE, "sample-change", ["REQ-903"])]), k = (x) => items.find((i) => i.key === x);
  ok(k("spec:900/T910").files.join() === "modules/sample/reader.js,test/sample-unit.js" && k("spec:900/T911").files[0] === "modules/sample/pages/" && k("spec:900/T910").areas.join() === "modules/sample,test", "a task's files and areas come from its text");
  ok(k("spec:900/T910").blockedBy.join() === "spec:900/T900" && k("spec:900/T900").blocks.length === 3 && !k("spec:900/T912").blockedBy.length, "a Spec Kit gate blocks the open agent and rules tasks below it, not done ones");
  ok(k("spec:900/T911").dependsOn.includes("spec:900/T910") && k("change:sample-change/3.2").dependsOn.includes("change:sample-change/3.1"), '"after T910" and "after 3.1" become dependencies');
  ok(k("change:sample-change/3.1").blockedBy.join() === "change:sample-change/2.1" && k("change:sample-change/3.1").reqs.join() === "REQ-903" && k("change:sample-change/2.1").who === "people", "an OpenSpec Gate section blocks later sections; a change's tasks carry its REQs");
  const real = I.collect();
  ok(real.length > 50 && real.some((i) => i.source === "openspec") && real.some((i) => i.source === "speckit") && real.every((i) => i.key && Array.isArray(i.blockedBy)), `the repo's own ${real.length} tasks parse`);

  console.log("REQ-069: collisions");
  ok(O.pathsOverlap("modules/sample/", "modules/sample/x.js") && O.pathsOverlap("modules/sample/**", "modules/sample/a/b.js") && O.pathsOverlap("a.js", "./a.js") && !O.pathsOverlap("modules/sample.js", "modules/sample/x.js") && !O.pathsOverlap("modules/sam/", "modules/sample/x.js"), "paths overlap by equality, folder or glob prefix, not by a shared name prefix");
  ok(!O.eligible(k("spec:900/T900"), "agent").ok && O.eligible(k("spec:900/T900"), "person").ok && !O.eligible(k("spec:900/T913"), "agent").ok && O.eligible(k("spec:900/T913"), "agent", "person:sample-john").ok, "[people] tasks are people's; [rules] tasks need a person who asked");
  const now = Date.now(), until = new Date(now + 36e5).toISOString();
  const claims = [{ task: "spec:900/T910", actor: "agent:sample-a", kind: "agent", files: ["modules/sample/reader.js"], expires_at: until }, { task: "response:sample", actor: "person:sample-matt", soft: true, files: [], expires_at: until }];
  const free = I.link(items.map((i) => ({ ...i, dependsOn: [] })));
  const c1 = O.check({ task: "spec:900/T910", actor: "agent:sample-b" }, { claims, items: free });
  ok(!c1.ok && c1.hard.some((h) => h.type === "same-task") && c1.hard.some((h) => h.type === "files" && h.files[0] === "modules/sample/reader.js"), "a second claim on the same task and its files is refused, naming who holds them");
  const c2 = O.check({ task: "spec:900/T911", files: ["modules/sample/"], actor: "agent:sample-b" }, { claims, items: free, branches: [{ name: "feature/sample-x", files: ["modules/sample/pages/a.html"] }, { name: "feature/sample-y", files: ["modules/sample/pages/b.html"] }, { name: "mine", files: ["modules/sample/pages/c.html"] }], myBranch: "mine" });
  ok(c2.hard.some((h) => h.type === "files") && c2.warn.filter((w) => w.type === "branch").length === 1 && c2.warn[0].branches.join() === "feature/sample-x,feature/sample-y", "claiming a folder collides with a file inside it; open branches are one warning, without your own branch");
  ok(!O.check({ task: "x", files: ["CONTRACT.md"], actor: "person:sample-john", kind: "person" }, {}).ok && O.check({ task: "x", files: ["CONTRACT.md"], actor: "a" }, {}).hard[0].type === "shared-doc", "a shared document is never claimable alone: it needs both partners");
  ok(O.check({ task: "response:sample", actor: "person:sample-john", kind: "person" }, { claims }).ok && O.check({ task: "response:sample", actor: "person:sample-john", kind: "person" }, { claims }).warn.some((w) => w.type === "presence"), "someone viewing a page is presence, not a conflict");
  const board = O.board({ claims: [...claims, { task: "spec:900/T913", actor: "person:sample-john", files: ["modules/sample/reader.js"], expires_at: until }], items });
  ok(board.some((b) => b.type === "files" && b.severity === "error") && board.some((b) => b.type === "overlapping-tasks" && b.subjects[0] === "spec:900/T910"), "the board lists two holders of one file, and orders open tasks that share files");
  ok(!O.board({ items }).some((b) => b.type === "overlapping-tasks" && b.subjects.includes("change:sample-change/3.2") && b.subjects.includes("change:sample-change/3.1")), "tasks already ordered by a dependency aren't reported as overlapping");

  console.log("REQ-068: ranked next steps with reasons");
  const reqs = { "REQ-901": { level: "MUST", status: "approved", text: "Sample must" }, "REQ-902": { level: "SHOULD", status: "proposed", text: "Sample should" }, "REQ-903": { level: "MAY", status: "proposed", text: "Sample may" } };
  const n = P.next(free, { actor: "agent:sample-b", kind: "agent", claims: [], reqs });
  ok(n.next[0].key === "spec:900/T910" && n.next.every((x) => x.score === x.reasons.reduce((s, r) => s + r.pts, 0)), `the task that unblocks most and serves an approved MUST ranks first, and every score is the sum of its reasons (${n.next.map((x) => `${x.key.split("/")[1]}:${x.score}`).join(" ")})`);
  ok(!n.next.some((x) => x.who === "people") && !n.next.some((x) => x.key === "spec:900/T913") && n.skipped.some((s) => /\[rules\]/.test(s.why)), "an agent isn't offered people's decisions, or rules tasks nobody asked for");
  const held = P.next(free, { actor: "agent:sample-b", kind: "agent", claims, reqs });
  ok(!held.next.some((x) => x.key === "spec:900/T910") && held.next.find((x) => x.key === "spec:900/T911").reasons.length >= 1, "a task someone holds isn't offered");
  const gated = P.next(items, { actor: "person:sample-john", kind: "person", reqs });
  ok(gated.next[0].key === "spec:900/T900" && gated.skipped.some((s) => s.key === "spec:900/T910" && /waits for/.test(s.why)), "with the gate open, a person is offered the gate first and the gated tasks wait");
  const ini = P.initiatives(items, { reqs });
  ok(ini[0].req === "REQ-901" && ini[0].unblocks >= 3, "initiatives group open work by requirement, most unblocking first");

  console.log("REQ-070: the advisor");
  const facts = { reqs: [{ id: "REQ-901", spec: "900", text: "The system MUST read sample papers in full and map each claim to evidence", level: "MUST", status: "proposed", trace: null, tasks: [] }, { id: "REQ-902", spec: "900", text: "Sample", level: "SHOULD", status: "approved", trace: { code: "x" }, tasks: [] }],
    specs: [{ id: "900", dir: "900-sample", title: "Sample" }], specDir: { 900: "900-sample" }, hasTasks: { 900: true }, nextTask: { 900: 914 },
    capabilities: { papers: { title: "Paper reading", purpose: "Read papers in full, map claims to evidence" }, feed: { title: "Feed", purpose: "Stories on the homepage" } }, inChanges: {}, mapped: new Set(["REQ-902"]),
    items: [], mentions: { "REQ-901": { code: ["modules/sample/reader.js"], tests: ["test/sample-unit.js"] } }, tables: [{ name: "sample_rows", file: "modules/sample/module.js", cols: ["id", "body"] }, { name: "users", file: "lib/db.js", cols: ["id"] }], interfaces: "users are …",
    types: ["Module", "Block"], shaped: new Set(["Module"]), views: [{ name: "sample-view", module: "sample", spec: { bindings: { "/x": { source: "sample.missing" } }, elements: { b: { on: { press: { action: "runAction", params: { id: "sample.nope" } } } } } } }],
    sources: [{ kind: "source", id: "sample.list", module: "sample", about: "Sample rows for the test", params: { q: { type: "string" } }, access: "user", guarded: true }, { kind: "source", id: "sample.open", module: "sample", about: "Sample rows open to all", params: {}, access: "public", guarded: false }],
    actions: [{ kind: "action", id: "sample.save", module: "sample", about: "Save a sample row", params: { body: { type: "string", max: 100 } }, access: "admin", guarded: true, refresh: ["sample.list", "sample.gone"] }],
    sourceIds: new Set(["sample.list", "sample.open"]), actionIds: new Set(["sample.save"]), boundSources: new Set(), pageSources: new Set(["sample.list"]), learnings: [], today: "2026-11-11" };
  const adv = A.advise(facts), r = (rule) => adv.filter((x) => x.rule === rule);
  ok(r("openspec.unmapped").length === 1 && /capabilities\.papers/.test(r("openspec.unmapped")[0].draft), `an unmapped REQ gets the capability closest in wording (${r("openspec.unmapped")[0] && r("openspec.unmapped")[0].draft})`);
  ok(r("speckit.untraced")[0].draft.includes("| REQ-901 |") && r("speckit.untraced")[0].draft.includes("modules/sample/reader.js") && r("speckit.untraced")[0].draft.includes("test/sample-unit.js") && r("speckit.no-task")[0].draft.startsWith("- [ ] T914 [agent] [REQ-901]"), "an untraced REQ gets a trace row filled from the files that name it, and a numbered task");
  ok(r("bindings.unknown-refresh").length === 1 && r("bindings.view-references").length === 2 && r("bindings.unbound-source").map((x) => x.subject).join() === "source:sample.open", "unknown refresh targets, a view bound to a missing source or action, and an unused readable source are found");
  ok(r("validation.unbounded-string")[0].subject === "source:sample.list.q" && r("validation.inconsistent-guard")[0].subject === "source:sample.open", "an unbounded string and a source that skips its module's feature guard are found");
  ok(r("data-model.undocumented-table").map((x) => x.subject).join() === "table:sample_rows" && r("data-model.unshaped-type")[0].draft.includes("sh:targetClass si:Block"), "an undocumented table and a node type without a SHACL shape get drafts");
  ok(adv[0].severity === "error" && adv.every((x) => x.id.length === 10) && A.advise(facts).map((x) => x.id).join() === adv.map((x) => x.id).join() && A.advise(facts, { dismissed: new Set([adv[0].id]) })[0].dismissed, "errors come first; ids are stable, so a dismissal sticks");
  const realAdv = A.advise(A.gather({ items: real }));
  ok(!realAdv.some((x) => /rule failed/.test(x.why)) && realAdv.every((x) => x.why && x.target), `every rule runs on the repo itself (${realAdv.length} suggestions)`);

  console.log("REQ-069, REQ-071: claims, presence and stale writes through the app");
  const { app, boot, db } = require("../server"); await boot();
  const server = app.listen(0, "127.0.0.1"); await new Promise((res) => server.once("listening", res));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sign = async (u) => (await fetch(base + "/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: "sample-only-123" }) })).headers.get("set-cookie").split(";")[0];
  try {
    const john = await sign("sample-john"), matt = await sign("sample-matt"); await db.run("UPDATE users SET is_admin = 1");
    const call = (c, m, p, body) => fetch(base + p, { method: m, headers: { cookie: c || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const src = async (c, id, params = {}) => (await (await call(c, "POST", `/api/data/sources/${id}`, { params })).json()).data;
    const act = (c, id, input) => call(c, "POST", `/api/data/actions/${id}`, { input });
    const task = real.find((i) => !i.done && i.who === "agent" && !i.blockedBy.length).key;
    const a = await act(john, "work.claim", { task, files: ["modules/sample-claimed/"], intent: "Sample claim (test data)" });
    ok(a.status === 200 && fs.existsSync(path.join(process.env.WORK_OUT, "claims.json")), `John claims ${task}; the guard hook's cache is written`);
    const b = await act(matt, "work.claim", { task: "sample:other", files: ["modules/sample-claimed/x.js"] }), bj = await b.json();
    ok(b.status === 409 && /person:sample-john holds modules\/sample-claimed/.test(bj.error), `Matt's claim on a file inside John's folder is refused with the reason (${b.status})`);
    const agent = await act(matt, "work.claim", { task: "sample:other", files: ["modules/sample-claimed/x.js"], actor: "agent:sample-helper", force: true });
    ok(agent.status === 409, "an agent can't force past a collision, even when a person asks");
    const forced = await (await act(matt, "work.claim", { task: "sample:other", files: ["modules/sample-claimed/x.js"], force: true })).json();
    ok(forced.result.forced && forced.result.overridden.length === 1, "a person can force it, and the override is recorded");
    const conflicts = await src(john, "work.conflicts");
    ok(conflicts.some((x) => x.type === "files" && x.severity === "error"), "the forced overlap shows on the board as an error");
    const hook = (actor, file) => spawnSync(process.execPath, [path.join(__dirname, "..", "agent-kit", "hooks", "guard.js")], { input: JSON.stringify({ tool_name: "Edit", tool_input: { file_path: file, new_string: "x" }, cwd: hookRoot }), env: { ...process.env, SI_ACTOR: actor }, encoding: "utf8" });
    const hookRoot = fs.mkdtempSync(path.join(os.tmpdir(), "si-hook-")); fs.mkdirSync(path.join(hookRoot, "modules", "work"), { recursive: true }); fs.mkdirSync(path.join(hookRoot, "out", "work"), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "..", "modules", "work", "overlap.js"), path.join(hookRoot, "modules", "work", "overlap.js")); fs.copyFileSync(path.join(process.env.WORK_OUT, "claims.json"), path.join(hookRoot, "out", "work", "claims.json"));
    const h1 = hook("agent:sample-other", "modules/sample-claimed/y.js"), h2 = hook("person:sample-john", "modules/sample-claimed/y.js"), h3 = hook("agent:sample-other", "CONTRACT.md"), h4 = hook("agent:sample-other", "modules/elsewhere.js");
    ok(h1.status === 2 && /claimed by person:sample-john/.test(h1.stderr) && h2.status === 0 && h3.status === 2 && /both partners/.test(h3.stderr) && h4.status === 0, "the guard hook stops an agent editing a claimed file or a shared document, and lets the holder and free files through");
    ok((await (await act(john, "work.release", { task })).json()).result.released === 1 && !(await src(john, "work.claims")).some((c) => c.task === task), "John releases his claim");
    const nx = await src(john, "work.next", { kind: "agent", limit: 5 });
    ok(nx.next.length && nx.next.every((x) => x.who !== "people") && nx.next[0].reasons.length, "work.next ranks the repo's open tasks for an agent, with reasons");
    const brief = (await src(john, "work.brief", { kind: "agent" })).markdown;
    ok(/## Hard rules/.test(brief) && /Never push to `main`/.test(brief) && /## Next for you/.test(brief) && /npm run work -- claim/.test(brief), "the agent brief carries the hard rules, the next tasks and how to claim them");
    const adv1 = await src(john, "work.advice"); const first = adv1[0];
    await act(john, "work.advice-mark", { finding: first.id, state: "dismissed", note: "Sample (test data)" });
    const adv2 = await src(john, "work.advice"), adv3 = await src(john, "work.advice", { includeDismissed: true });
    ok(adv1.length > 0 && !adv2.some((x) => x.id === first.id) && adv3.find((x) => x.id === first.id).mark.state === "dismissed", `a dismissed suggestion leaves the list and keeps its mark (${adv1.length} suggestions in the running app)`);

    // Builder: two people on one response.
    const html = fs.readFileSync(path.join(__dirname, "fixtures", "papers", "sample-paper.html"), "utf8");
    const slug = (await (await act(john, "responses.build", { title: "Gated Self-Repair: Sample paper for the paper reader (test data)", url: "https://example.test/sample-paper", text: html })).json()).result.slug;
    await act(john, "work.claim", { task: `response:${slug}`, soft: true });
    const seen = await (await act(matt, "work.claim", { task: `response:${slug}`, soft: true })).json();
    ok(seen.result.warnings.some((w) => w.type === "presence" && w.actor === "person:sample-john"), "opening a response someone else has open names them");
    const e1 = await act(john, "responses.edit-line", { slug, beat: 0, line: 1, text: "Does the gate really help?", expectVersion: 1 });
    const e2 = await act(matt, "responses.edit-line", { slug, beat: 0, line: 2, text: "We read all of it.", expectVersion: 1 }), e2j = await e2.json();
    ok(e1.status === 200 && e2.status === 409 && /Version 2 was saved by sample-john/.test(e2j.error), `a save made against an old version is refused, naming who saved in between (${e2j.error && e2j.error.slice(0, 70)}…)`);
    ok((await act(matt, "responses.replan", { slug, maxSeconds: 60, expectVersion: 1 })).status === 409 && (await act(matt, "data.restore", { kind: "response", key: slug, version: 1, expectVersion: 1 })).status === 409, "re-plan and restore refuse a stale version too");
    const g = await src(matt, "responses.get", { slug });
    ok(g.version === 2 && g.plan.beats[0].lines[1].text === "Does the gate really help?" && (await act(matt, "responses.edit-line", { slug, beat: 0, line: 2, text: "We read all of it.", expectVersion: 2 })).status === 200, "after reloading, Matt's edit goes in on top of John's");
    // Many writers at the same instant: the version check and the claim check run inside one transaction each.
    const N = 20, cur = (await src(john, "responses.get", { slug })).version;
    const burst = await Promise.all(Array.from({ length: N }, (_, n) => act(n % 2 ? matt : john, "responses.edit-line", { slug, beat: 0, line: 2, text: `Sample burst edit ${n}.`, expectVersion: cur }).then((x) => x.status)));
    const after = (await src(john, "responses.get", { slug })).history.map((h) => h.version);
    ok(burst.filter((s) => s === 200).length === 1 && burst.filter((s) => s === 409).length === N - 1 && after[0] === cur + 1, `${N} simultaneous saves of version ${cur}: exactly one lands, the rest are refused (${burst.filter((s) => s === 200).length} saved)`);
    const grab = await Promise.all(Array.from({ length: N }, (_, n) => act(john, "work.claim", { task: `sample:burst-${n}`, files: ["modules/sample-burst/one.js"], actor: `agent:sample-burst-${n}` }).then((x) => x.status)));
    ok(grab.filter((s) => s === 200).length === 1 && grab.filter((s) => s === 409).length === N - 1, `${N} agents claiming one file at the same instant: exactly one gets it`);
  } finally { await new Promise((res) => server.close(res)); if (db.end) await db.end(); }
  console.log(`\nwork unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
