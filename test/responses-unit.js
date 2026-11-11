#!/usr/bin/env node
// Paper responses (proposed REQ-056..059, spec 006): reading, analysis, plan, video script, captions, article, posts,
// the feature flag and the routes behind it. Synthetic sample papers only (test/fixtures/papers, labelled test data).
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { execFileSync } = require("node:child_process");
let pass = 0, fail = 0; const NAMES = []; const ok = (c, m, name = null) => { c ? pass++ : fail++; if (name) NAMES.push(name); console.log(c ? "  ✓" : "  ✗", m); };
const has = (cmd, args = ["--version"]) => { try { execFileSync(cmd, args, { stdio: "ignore" }); return true; } catch { return false; } };
const FX = path.join(__dirname, "fixtures", "papers");
process.env.SITE_PROFILE = "extended"; process.env.FETCH_MINUTES = "0";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-responses-"));
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ""; delete process.env.POSTGRES_URL;
const R = require("../modules/responses/reader"), A = require("../modules/responses/analysis"), P = require("../modules/responses/plan");
const V = require("../modules/responses/video"), W = require("../modules/responses/write"), F = require("../modules/responses/flags"), { respond } = require("../modules/responses/respond");

(async () => {
  console.log("REQ-056: reading the full text");
  const html = await R.read(path.join(FX, "sample-paper.html"));
  ok(/test data/.test(html.title) && html.authors.length === 2, "arXiv-style HTML: title and authors");
  ok(html.sections.map((s) => s.kind).join() === "intro,method,experiments,limitations,conclusion,references", `sections and their kinds (${html.sections.map((s) => s.kind).join(", ")})`);
  ok(html.tables.length === 1 && html.tables[0].rows.length === 4 && html.tables[0].rows[1].join("|") === "Greedy|41%|68.0", "table cells are kept");
  ok(/p<alpha_t/.test(html.sections[1].text), "inline maths keeps its TeX (p<alpha_t), so the sentence isn't cut");
  ok(html.links.includes("https://github.com/example-org/sample-gated-repair") && html.references === 2 && html.fullText, "links, reference count and a full-text flag");
  if (has("pdftotext", ["-v"])) {
    const pdf = await R.read(path.join(FX, "sample-monitor-paper.pdf"), { meta: { title: "Sample Monitor Paper for the PDF Reader (test data)" } });
    ok(pdf.source === "pdf" && pdf.sections.map((s) => s.heading).join("|") === "1 Introduction|2 Method|3 Experiments|4 Conclusion", `PDF: numbered headings on their own line are rejoined (${pdf.sections.map((s) => s.heading).join(" | ")})`);
    ok(/^This is a synthetic sample paper/.test(pdf.abstract) && pdf.tables.length === 1, "PDF: abstract and table caption");
    const a = A.analyse(pdf);
    const c97 = a.contributions.find((c) => /97%/.test(c.text));
    ok(c97 && c97.level === "not found in the body" && a.abstractNumbers.find((n) => n.number === "97%").inBody === false, "an abstract number the body never shows (97%) is flagged, and becomes an open question");
    ok(a.questions.some((q) => /97%/.test(q.text)), "...as an open question");
  } else console.log("  (pdftotext not installed: PDF checks skipped)");
  const abs = R.fromText("Abstract. This is a sample abstract (test data). We propose a method that improves accuracy by 4%.", { title: "Sample abstract-only paper (test data)" });
  ok(!abs.fullText && A.analyse(abs).strength === "abstract only" && A.analyse(abs).penalties.some((p) => p.id === "abstract-only"), "abstract-only input is labelled as such, never rated as read in full");

  console.log("REQ-057: analysis");
  const a = A.analyse(html);
  const lv = Object.fromEntries(a.contributions.map((c) => [c.text.slice(0, 18), c.level]));
  ok(lv["We show that the g"] === "backed" && a.contributions.find((c) => /41%/.test(c.text)).evidence.some((e) => e.id === "table.1"), "a numeric claim is matched to the body result and the table that back it");
  ok(lv["We propose Gated S"] === "described", "a 'we propose' claim is matched to the method that describes it");
  ok(lv["Finally, we introdu"] === undefined ? a.contributions.some((c) => /SampleBench/.test(c.text) && c.level === "not found in the body") : false, "a claim with no result in the body (SampleBench, 72.4%) is flagged");
  ok(a.abstractNumbers.filter((n) => !n.inBody).map((n) => n.number).join() === "120,72.4%", "abstract numbers missing from the body are listed (120, 72.4%)");
  const met = a.checklist.filter((c) => c.met).map((c) => c.id).sort().join();
  ok(met === "ablation,baselines,code,independent-benchmark,limitations,theory,variance", `full-text checklist (${met})`);
  ok(a.benchmarks.join() === "HotpotQA,DROP,APPS" && a.ownBenchmark, "benchmarks named, and the paper's own benchmark noticed");
  ok(a.checklist.every((c) => c.met === !!c.evidence) && a.checklist.filter((c) => c.met).every((c) => c.evidence.length > 10), "every met check quotes where it was found");
  ok(A.CHECKS.reduce((n, c) => n + c.points, 0) === 100 && a.rigor === Math.round(a.checklist.reduce((n, c) => n + c.earned, 0) + a.penalties.reduce((n, p) => n + p.points, 0)), `the rigor score is the sum of published points (${a.rigor}/100)`);
  ok(JSON.stringify(A.analyse(html)) === JSON.stringify(a), "analysis is deterministic");

  console.log("REQ-058: plan, video, article and posts");
  const p = P.plan(a, html), checks = P.check(p, a);
  ok(p.beats.map((b) => b.visual.kind).join() === "title,claims,flow,bars,checklist,questions,sources", `beats (${p.beats.map((b) => b.visual.kind).join(", ")})`);
  ok(checks.every((c) => c.ok), `machine acceptance checks pass (${checks.map((c) => `${c.id}: ${c.why}`).join("; ")})`);
  ok(p.beats.find((b) => b.id === "evidence").narration.includes("Those are the paper's numbers"), "the paper's numbers are labelled as the paper's");
  ok(p.beats.every((b) => !/\b(we|our) (propose|show|prove|introduce)\b/i.test(b.narration)), "the paper's claims are voiced as the authors', not ours");
  const bad = { ...p, beats: [...p.beats, { id: "x", goal: "", narration: "It is 99.9 times better.", lines: [{ text: "It is 99.9 times better.", cue: 0 }], visual: { kind: "sources", items: [] }, seconds: 3 }] };
  ok(!P.check(bad, a).find((c) => c.id === "cites").ok, "a number in the narration that isn't in the paper fails the 'cites' check");
  const sc = V.scene(p);
  ok(/class PaperResponse\(Scene\)/.test(sc.source) && !/MathTex|Tex\(|DecimalNumber/.test(sc.source), "the Manim scene needs no LaTeX install");
  if (has("python3")) { const f = path.join(process.env.DATA_DIR, "scene.py"); fs.writeFileSync(f, sc.source); let compiles = true; try { execFileSync("python3", ["-m", "py_compile", f], { stdio: "pipe" }); } catch { compiles = false; } ok(compiles, "scene.py is valid Python"); }
  const srt = V.captions(p.beats), cues = srt.trim().split(/\n\n+/);
  const ends = cues.map((c) => c.split("\n")[1].split(" --> ").map((t) => { const [h, m, s] = t.replace(",", ".").split(":"); return h * 3600 + m * 60 + Number(s); }));
  ok(cues.length >= p.beats.length && ends.every(([s, e], i) => e > s && (i === 0 || s >= ends[i - 1][1] - 1e-6)) && ends.at(-1)[1] <= p.beats.reduce((n, b) => n + b.seconds, 0), `captions are ordered and inside the video (${cues.length} cues)`);
  const sb = V.playerStoryboard(p);
  ok(sb.scenes.length === p.beats.length && sb.scenes.every((s) => ["title", "say", "bars", "graph"].includes(s.kind)), "the browser explainer gets scenes it knows how to play");
  const art = W.article(a, p), posts = W.posts(a, p, "https://example.test/m/responses?r=sample");
  ok(/## References/.test(art) && /not a peer review/.test(art) && /Full-text rigor: \*\*\d+\/100\*\*/.test(art), "the article has the rigor table, a references list and says it isn't a peer review");
  ok(posts.every((x) => !x.limit || x.length <= x.limit) && posts.every((x) => !/twitter|x\.com/i.test(x.channel + x.text)), `every post fits its network and none is for Twitter/X (${posts.map((x) => `${x.channel} ${x.length || "-"}`).join(", ")})`);

  console.log("REQ-060: production planning, QA and what it learned");
  const Prod = require("../modules/lab/production"), QA = require("../modules/responses/qa"), { offering } = require("../modules/responses/respond");
  const same = Prod.SIT_IDS.map((sit) => { const x = Prod.astar({ situation: sit }), u = Prod.astar({ situation: sit, heuristic: 0 }); return { sit, eq: Math.abs(x.cost - u.cost) < 1e-9, fewer: x.expanded <= u.expanded }; });
  ok(same.every((x) => x.eq) && same.every((x) => x.fewer), `A* finds the same optimum as uniform-cost search in every situation, expanding no more nodes`, "A* finds the same optimum as uniform-cost search in every situation");
  // Robustness: halve or raise by half every assumption of the viewer and cost model; the A* plan should still beat
  // the first plan we shipped.
  const simBase = JSON.parse(JSON.stringify(Prod.SIM)); let wins = 0, tries = 0;
  for (const [g, k] of [["viewer", "decayPerSecond"], ["viewer", "densityDrain"], ["viewer", "motionLift"], ["viewer", "misalignDrain"], ["viewer", "dropK"], ["cost", "perSecond"], ["cost", "perLostUnit"], ["cost", "perLostViewer"]])
    for (const f of [0.5, 1.5]) { Prod.SIM[g][k] = simBase[g][k] * f; for (const sit of Prod.SIT_IDS.slice(0, 5)) { tries++; if (Prod.astar({ situation: sit }).cost < Prod.scorePlan(Prod.FIRST_PLAN, sit).cost) wins++; } Prod.SIM[g][k] = simBase[g][k]; }
  ok(wins === tries, `the A* plan beats the first shipped plan in ${wins} of ${tries} perturbed models`);
  ok(p.search.situation === "partial+table+mech+res+q" && Prod.parseSit(p.search.situation).strength === a.strength, `the plan's situation agrees with the analysis (${p.search.situation})`);
  const planned = (p.search.chosen || []).filter((x) => !x.startsWith("skip")), shown = p.beats.map((b) => b.variant);
  ok(JSON.stringify(planned) === JSON.stringify(shown), `every beat A* plans is a beat the video shows (${shown.join(", ")})`, "every beat A* plans is a beat the video shows");
  const noRes = Prod.astar({ situation: "partial+mech+q" }).plan.map((x) => x.variant);
  ok(!noRes.includes("quote-card") && !Prod.astar({ situation: "partial+mech+res" }).plan.some((x) => ["three-questions", "one-question"].includes(x.variant)), "...and it never plans a quote with no result to quote, or questions when none are open");
  const rule = Prod.evaluate(Prod.BASELINES["full video on strong papers, else article"]);
  const learned = [1, 2, 3].map((seed) => { const L = Prod.qlearn({ seed }); return Prod.evaluate(Prod.policyFrom(L.Q, L.visits, 30)); });
  const lo = Math.min(...learned.map((x) => x.reward)), hi = Math.max(...learned.map((x) => x.reward));
  ok(hi - lo < 0.5 && lo > rule.reward + 0.3, `the learned offering is stable across seeds (${lo}..${hi}) and beats the hand rule (${rule.reward})`, "the learned offering is stable across seeds and beats the hand rule");
  const fullW = Prod.evaluate(Prod.BASELINES["always full video"], { budget: 800 }), postsW = Prod.evaluate(Prod.BASELINES["always posts"], { budget: 800 });
  ok(fullW.weeks === postsW.weeks && fullW.weeks.length > 50, "every policy is evaluated on the same weeks (same papers arrive, whatever a policy does)", "every policy is evaluated on the same weeks");
  ok(Prod.evaluate(Prod.BASELINES["always full video"], { budget: 0 }).overclaimPerWeek === 0, "an oversell only counts when the video actually ships");
  const trust = { ...Prod.SIM.trust }; Prod.SIM.trust.full = 0; Prod.SIM.trust.short = 0;
  const noPenalty = (() => { const L = Prod.qlearn({ seed: 7 }); return Prod.evaluate(Prod.policyFrom(L.Q, L.visits, 30)); })(); Object.assign(Prod.SIM.trust, trust);
  ok(noPenalty.overclaimPerWeek > 0.5 && learned.every((x) => x.overclaimPerWeek < 0.1), `without the trust penalty the learner oversells thin papers (${noPenalty.overclaimPerWeek} a week vs ${learned[0].overclaimPerWeek}): that behaviour comes from the reward we wrote, not from data`, "without the trust penalty the learner oversells thin papers");
  const before = Prod.UNITS.flatMap((u) => u.variants).find((v) => v.id === "bars").seconds;
  Prod.applyCalibration({ "one-claim": { seconds: Prod.UNITS.flatMap((u) => u.variants).find((v) => v.id === "one-claim").assumedSeconds * 2, n: 1 } });
  const bars2 = Prod.UNITS.flatMap((u) => u.variants).find((v) => v.id === "bars");
  ok(bars2.seconds === Math.round(bars2.assumedSeconds * 2) && !bars2.calibrated, `calibration scales unmeasured variants by the observed bias (bars ${bars2.assumedSeconds} s assumed -> ${bars2.seconds} s when the one measured variant ran 2x)`, "calibration scales unmeasured variants by the observed bias");
  Prod.applyCalibration(); ok(Prod.UNITS.flatMap((u) => u.variants).find((v) => v.id === "bars").seconds === before, "...and reloading the calibration file restores the planner exactly");
  const off = offering(p.search.situation);
  ok(off.offering && off.channel && off.class === "partial+visual", `the plan names a suggested offering (${off.offering}, ${off.voice}, ${off.channel})`, "the plan names a suggested offering");
  const edge = { slug: "edge", title: "Sample edge cases (test data)", beats: [
    { id: "toy", variant: "curve-trace", visual: { kind: "curve", title: "Sample (test data)", series: [{ name: "one point", points: [[3, 5]] }], verdict: "" }, lines: [{ text: "One.", cue: 0 }, { text: "Two.", cue: 1 }], seconds: 3 },
    { id: "toy", variant: "curve-trace", visual: { kind: "curve", title: "Sample (test data)", series: [{ name: "all negative", points: [[0, -3], [1, -2], [2, -1]] }], verdict: "toy scale" }, lines: [{ text: "One.", cue: 0 }], seconds: 3 },
    { id: "mechanism", variant: "flow-diagram", visual: { kind: "flow", steps: ["Only one step"] }, lines: [{ text: "One.", cue: 0 }, { text: "Loop.", cue: 1 }], seconds: 3 } ] };
  const es = V.scene(edge).source, ranges = [...es.matchAll(/x_range=\[([-\d.e]+), ([-\d.e]+), ([-\d.e]+)\], y_range=\[([-\d.e]+), ([-\d.e]+)/g)].map((m) => m.slice(1).map(Number));
  ok(ranges.length === 2 && ranges.every(([a0, a1, st, b0, b1]) => a1 > a0 && st > 0 && b1 > b0) && ranges[1][4] >= -1 && !/T\(""/.test(es) && /len\(boxes\) > 1/.test(es), "edge-case scenes are generated without zero-width axes or empty labels", "edge-case scenes are generated without zero-width axes or empty labels");
  const fake = { slug: "fake", analysis: { strength: "partly supported" }, checks: [{ id: "cites", ok: true, why: "ok" }], plan: { search: { situation: "strong+table+mech+res+q" }, beats: [{ id: "rigor", variant: "top-checks", seconds: 12, slots: [6], lines: [{ text: "It reports spread (seeds, runs, intervals or error bars).", cue: 0 }] }] } };
  const q = Object.fromEntries(Object.entries(QA.CHECKS).map(([id, fn]) => [id, fn(fake, os.tmpdir())]));
  ok(!q.speakable.ok && !q.situation.ok && q.sync.skip && q.edges.skip, "QA flags brackets in spoken lines and a situation that disagrees with its analysis, and skips video checks when there's no video");
  const ledger = require("../modules/responses/learnings.json").learnings;
  const missingGuard = ledger.filter((l) => { const [kind, name] = [l.guard.split(":")[0], l.guard.slice(l.guard.indexOf(":") + 1)]; return kind === "qa" ? !QA.CHECKS[name] : kind === "unit" ? !(NAMES.includes(name) || name === "every learning has a guard that exists") : true; });
  ok(!missingGuard.length && ledger.every((l) => l.symptom && l.cause && l.fix), `every learning has a guard that exists (${ledger.length} learnings${missingGuard.length ? `; missing: ${missingGuard.map((l) => `${l.id} ${l.guard}`).join(", ")}` : ""})`, "every learning has a guard that exists");

  console.log("REQ-059: feature flag in the CMS meta layer");
  ok(F.resolve({}).responses === "staff", "default: staff only (behind the curtain)");
  ok(!F.visible("off", { admin: true }) && F.visible("staff", { admin: true }) && !F.visible("staff", { admin: false }) && !F.visible("staff", null) && F.visible("public", null), "off hides from everyone, staff shows admins only, public shows everyone");
  let refused = 0; for (const x of [{ nope: "on" }, { responses: "on" }]) { try { F.validate(x); } catch { refused++; } }
  ok(refused === 2, "unknown flags and modes are refused");

  // Routes on a real server with a disposable database.
  const { app, boot, db } = require("../server"); await boot();
  const server = app.listen(0, "127.0.0.1"); await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sign = async (u) => { const r = await fetch(base + "/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: "sample-only-123" }) }); return r.headers.get("set-cookie").split(";")[0]; };
  try {
    const adminC = await sign("sample-responses-admin"), readerC = await sign("sample-responses-reader");
    const call = (c, m, p2, body) => fetch(base + p2, { method: m, headers: { cookie: c || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = fs.readFileSync(path.join(FX, "sample-paper.html"), "utf8");
    const built = await call(adminC, "POST", "/api/admin/responses", { title: "Gated Self-Repair: Sample paper for the paper reader (test data)", url: "https://example.test/sample-paper", text });
    const b = await built.json();
    ok(built.status === 200 && b.slug && b.checks.every((c) => c.ok), `an admin builds a response from pasted text (${b.slug})`);
    ok((await call(readerC, "GET", "/api/responses")).status === 404 && (await call(null, "GET", `/api/responses/${b.slug}`)).status === 404, "staff mode: a reader and a guest get 404");
    ok((await call(adminC, "GET", `/api/responses/${b.slug}/storyboard`)).status === 200, "staff mode: the admin sees it");
    ok((await call(readerC, "PUT", "/api/admin/features", { responses: "public" })).status === 403, "a reader can't change a flag");
    ok((await call(adminC, "PUT", "/api/admin/features", { responses: "loud" })).status === 400, "an unknown mode is refused");
    ok((await call(adminC, "PUT", "/api/admin/features", { responses: "public" })).status === 200 && (await call(readerC, "GET", `/api/responses/${b.slug}`)).status === 200, "public mode: a reader can read it");
    ok((await call(readerC, "POST", "/api/admin/responses", { source: "2611.10787" })).status === 403, "public mode: building stays admin-only");
    const audit = await db.all("SELECT action, detail FROM admin_audit WHERE action LIKE 'features.%' OR action LIKE 'responses.%'");
    ok(audit.some((x) => x.action === "features.set" && /staff -> public/.test(x.detail)) && audit.some((x) => x.action === "responses.build"), "flag changes and builds are in the admin audit log");
    const d = await call(adminC, "POST", `/api/admin/responses/${b.slug}/draft`, {});
    const dj = await d.json(), rev = await db.get("SELECT action FROM editorial_revisions WHERE post_id = ?", dj.id), post = await db.get("SELECT status, body FROM editorial_posts WHERE id = ?", dj.id);
    ok(d.status === 200 && rev.action === "generate" && post.status === "draft" && /## References/.test(post.body), "the article becomes an Editorial draft (revision 'generate'), not a published post");
    ok((await call(adminC, "PUT", "/api/admin/features", { responses: "off" })).status === 200 && (await call(adminC, "GET", "/api/responses")).status === 404, "off: even the admin gets 404 until it's switched back on");
    ok((await call(adminC, "POST", "/api/admin/responses", { title: "x", url: "https://x.com/a/status/1", text: "Sample text (test data)" })).status === 404, "...and nothing can be built while it's off");
    await call(adminC, "PUT", "/api/admin/features", { responses: "staff" });
    ok((await call(adminC, "POST", "/api/admin/responses", { title: "Sample (test data)", url: "https://x.com/a/status/1", text: "Sample text (test data)" })).status === 400, "a Twitter/X link is refused as a source");
  } finally { await new Promise((r) => server.close(r)); if (db.end) await db.end(); }
  console.log(`\nresponses unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
