#!/usr/bin/env node
// Source grades, forecasts as events, outlet track records and buzz (modules/review/sources.js), on synthetic inputs
// (test data). Checks the published rules hold, that no forecast is pinned on a named person, that personal blogs
// are pooled rather than tracked per person, and that buzz never lifts the evidence rating.
const S = require("../modules/review/sources"), D = require("../modules/review/dossier"), R = require("../modules/review/review");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };

console.log("Source grades");
ok(S.OUTLETS.every((o) => S.GRADES.includes(o.grade) && o.label && o.why) && R.CRITERIA.source.outlets.length === S.OUTLETS.length, "every outlet kind has a grade and a reason, and the criteria page lists them all");
ok(S.grade({ url: "https://icml.cc/virtual/2026/poster/1" }).grade === "A" && S.grade({ url: "https://arxiv.org/abs/2611.00001" }).grade === "B", "peer-reviewed venue A, preprint B");
ok(S.grade({ url: "https://arxiv.org/abs/2611.00001", text: "This survey of 300 papers" }).grade === "B", "citing research never lifts a piece to A: only peer review does");
ok(S.grade({ url: "https://example-news.test/x", catalogKind: "news", text: "A study (arXiv 2611.00001) found" }).grade === "B", "a news piece that cites a paper goes up one step (C to B)");
ok(S.grade({ url: "https://example-news.test/x", catalogKind: "news", hype: 60 }).grade === "D", "heavy hype (50 or more) goes down one step");
ok(S.grade({ url: "https://example.test/blog", text: "Start your free trial of our platform today." }).grade === "E" && S.grade({ url: "https://x.test", catalogKind: "vendor" }).grade === "E", "a piece selling its own product, or a vendor blog, is E");
const g = S.grade({ url: "https://example.test/x", catalogKind: "news", text: "A study (arXiv 2611.00001) found", hype: 0 });
ok(g.why.length === 2 && /starts at C/.test(g.why[0]) && /one step up/.test(g.why[1]), "every step of a grade is written out");
const m1 = S.outlet("https://medium.com/@someone/post"), m2 = S.outlet("https://someone.substack.com/p/x");
ok(m1.personal && m1.id === "outlet:class-commentary" && m2.id === m1.id && !/someone/.test(m1.id + m1.label), "personal blogs and newsletters are pooled as a class, never tracked by the writer");
ok(S.outlet("https://www.example-news.test/a", "news").id === "outlet:example-news.test", "an organisation's outlet is tracked by its site");

console.log("Forecasts as events");
const at = "2026-11-07";
const f = (t) => S.predictions([t], at);
ok(f("Labs will automate research by 2028.")[0]?.due === "2028-12-31", "\"by 2028\" falls due at the end of 2028");
ok(f("A lab plans an automated researcher by March 2028.")[0]?.due === "2028-03-31", "\"by March 2028\" falls due at the end of March");
ok(f("Transformative change is likely within 18 months.")[0]?.due === "2028-05-07", "\"within 18 months\" counts from the publication date");
ok(f("Are we 18 months away from superintelligence?").length === 0, "a question is not a forecast");
ok(f("Progress was rapid in 2019 and will continue.").length === 0, "a past year is history, not a forecast");
ok(f("The model has 2028 parameters.").length === 0, "a number that isn't a time is ignored");
const named = f("Jane Sample predicts that AI will build its successors by 2028.")[0], acc = f("According to John Sample, it will be automatic by 2027.")[0];
ok(named && !/Jane Sample/.test(named.sentence) && /\[a named person\]/.test(named.sentence) && acc && !/John Sample/.test(acc.sentence), "names a forecast is pinned on are removed (no forecast attributed to a person)");
ok(!/\[a named person\]/.test(f("Sample Labs will ship it by 2027.")[0]?.sentence || ""), "an organisation's name is kept");
const rv = R.review({ kind: "article", url: "https://example.test/x", title: "Sample article (test data)", text: "Sample text about agents. Agents will run most research by 2029, the sample piece argues, with no data shown. More sample text follows here." , at });
ok(rv.forecasts.length === 1 && rv.edges.some((e) => e.rel === "predicts" && e.dst === rv.forecasts[0].qid) && rv.edges.some((e) => e.rel === "published-by"), "a review records its forecasts as event: nodes with predicts and published-by edges");

console.log("Track records");
const doc = (o, cred, grade = "C") => ({ credibility: cred, result: { source: { grade, outlet: o } } });
const org = S.outlet("https://example-news.test/a", "news"), pool = S.outlet("https://medium.com/@a/b");
const docs = [doc(org, 50), doc(org, 60), doc(org, 70), doc(pool, 40, "D")];
const ev = (o, status) => ({ outlet: o.id, status });
let T = S.trackRecords(docs, [ev(org, "happened"), ev(org, "did-not"), ev(org, "unclear")]);
let o = T.find((x) => x.id === org.id);
ok(o.pieces === 3 && o.meanCredibility === 60 && o.resolved === 2 && o.hitRate === null, `no hit rate below ${S.MIN_RESOLVED} resolved forecasts, and "unclear" counts for neither side`);
T = S.trackRecords(docs, [ev(org, "happened"), ev(org, "happened"), ev(org, "did-not"), ev(org, "pending")]); o = T.find((x) => x.id === org.id);
ok(o.hitRate === 0.67 && o.pending === 1 && /worth following/.test(o.monitor || ""), "from 3 resolved forecasts the hit rate shows, and a frequent organisational outlet is flagged as worth following");
ok(T.find((x) => x.id === pool.id).monitor === null, "the pooled personal class is never flagged for monitoring");

console.log("Probabilities and Brier scores");
ok(S.probabilityIn("a 60% chance that AI builds its successors by 2028") === 0.6 && S.probabilityIn("a probability of 0.3 by 2030") === 0.3 && S.probabilityIn("70 percent likely by 2029") === 0.7 && S.probabilityIn("revenue grew 60% in 2025") === null, "a stated probability is read from the forecast's own sentence, and other percentages are not");
ok(f("A lab puts a 60% chance on agents automating research by 2028.")[0]?.probability === 0.6 && f("Labs will automate research by 2028.")[0]?.probability === null, "forecasts carry their stated probability, or none");
ok(Math.abs(S.brier(0.6, true) - 0.16) < 1e-9 && Math.abs(S.brier(0.6, false) - 0.36) < 1e-9, "Brier: (probability - outcome) squared");
const pe = (status, probability) => ({ outlet: org.id, status, probability });
let B = S.trackRecords(docs, [pe("happened", 0.8), pe("did-not", 0.3), pe("happened", 0.6)]).find((x) => x.id === org.id);
ok(B.brier === +((0.04 + 0.09 + 0.16) / 3).toFixed(3) && B.scored === 3, `from 3 scored forecasts the outlet's Brier score shows (${B.brier})`);
B = S.trackRecords(docs, [pe("happened", 0.8), pe("did-not", null), pe("happened", null)]).find((x) => x.id === org.id);
ok(B.brier === null && B.scored === 1, "forecasts without a stated probability are not Brier-scored");

console.log("Buzz versus evidence");
const many = (n, kind = "commentary") => Array.from({ length: n }, () => ({ at, kinds: [kind] }));
ok(S.buzz({ stories: many(3), at }).level === "quiet" && S.buzz({ stories: many(S.SOME), at }).level === "some" && S.buzz({ stories: many(S.LOUD), at }).level === "loud", `quiet under ${S.SOME}, loud at ${S.LOUD} or more`);
ok(S.buzz({ stories: many(30, "papers"), at }).items === 0, "paper feeds aren't buzz");
ok(S.buzz({ stories: [{ at: "2026-01-01", kinds: ["news"] }], at }).items === 0, "only the last 30 days count");
ok(/far more than it has been shown/.test(S.buzz({ stories: many(25), strength: "thin", at }).gap) && /shown more than it is talked about/.test(S.buzz({ stories: [], strength: "early", at }).gap), "the gap names talk outrunning evidence, and evidence outrunning talk");
const art = (i, cred) => ({ id: i, qid: `doc:s${i}`, kind: "article", title: `Sample article ${i} (test data)`, url: `https://example.test/${i}`, score: 20, credibility: cred, verdict: "minor", needs_person: 0, label: null, created_at: at,
  result: { claims: [{ level: "backed", sentence: "Sample." }], source: { grade: "B" }, judges: [{ id: "hype", score: 10 }] } });
const quiet = D.analyse({ topic: "superintelligence", ids: ["superintelligence"], docs: [art(1, 80), art(2, 75)], docEdges: [], stories: many(40, "news").map((s, i) => ({ ...s, id: i, title: "s", url: "u", sources: ["n"], entities: [] })) }, { at });
ok(quiet.strength === "thin" && quiet.buzz.level === "loud", "credible articles and loud buzz never lift the evidence rating: only papers and our own checks do");

ok(["https://time.com/article/x", "https://www.quantamagazine.org/x", "https://www.theregister.com/x"].every((u) => S.outletKind(u) === "news"), "more newsrooms are recognised as news, not open-platform commentary");
{ const f = S.predictions(["Sample (test data): one lab targets an automated AI researcher by March 2028."], "2026-11-10");
  ok(f.length === 1 && f[0].due === "2028-03-31", `a stated target with a date is a forecast ("targets ... by March 2028" -> ${f[0] && f[0].due})`); }
console.log(`\nsources unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
