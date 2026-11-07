#!/usr/bin/env node
// Topic dossier rules (modules/review/dossier.js) on synthetic records (test data): every reference is traced, every
// [n] in the outputs resolves, people appear only as counts, the rating never claims more than its rule allows, and
// only toy checks of a reviewed paper's own idea lift the rating.
const D = require("../modules/review/dossier");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const doc = (i, cred, extra = {}) => ({ id: i, qid: `doc:sample${i}`, kind: "paper", title: `Sample paper ${i} (test data)`, url: `https://arxiv.org/abs/2611.0000${i}`, score: 20, credibility: cred, verdict: cred >= 60 ? "solid, modest step" : "minor", needs_person: 0, label: null,
  result: { survey: false, claims: [{ level: "backed", sentence: `Sample result ${i} rose from 30% to 40% across 5 seeds.` }], ...extra } });
const person = { id: "sample-person", label: "Sample Person" };
const base = (docs, examples) => D.analyse({ topic: "recursive-self-improvement", ids: ["recursive-self-improvement"], docs,
  docEdges: [...docs.map((d) => ({ src: d.qid, rel: "explains", dst: "concept:sample" })), { src: docs[0]?.qid, rel: "mentions", dst: `person:${person.id}` }].filter((e) => e.src),
  stories: [{ id: 9, title: "Sample story (test data)", url: "https://example.test/s", summary: "", sources: ["Sample feed"], entities: [{ kind: "person", entity: person.id }] }] },
  { examples, concepts: [{ id: "sample", name: "Sample concept" }] });
const ex = (id, ok2, url, topic = "topic:recursive-self-improvement") => ({ id, title: `Sample check ${id}`, topics: [topic], source: url ? { title: "Sample paper", url } : null, verdict: { supported: ok2, text: ok2 ? "Supported at toy scale: x." : "Not supported at toy scale: x." } });

const none = base([], []); ok(none.strength === "none yet", "no records: none yet");
ok(base([doc(1, 40)], []).strength === "thin", "only weak papers: thin");
ok(base([doc(1, 70)], []).strength === "early", "one credible paper: early");
ok(base([doc(1, 70), doc(2, 65)], [ex("g", true, null)]).strength === "early", "a general toy check doesn't lift the rating");
const full = base([doc(1, 70), doc(2, 65)], [ex("p", true, "https://arxiv.org/abs/2611.00001"), ex("q", false, "https://arxiv.org/abs/2611.00002")]);
ok(full.strength === "some support", "two credible papers plus a toy check of one's idea: some support (the top rating)");
ok(!/strong|proven|confirmed/i.test(JSON.stringify([full.strength, full.why])), "never rated strong, proven or confirmed");
ok(full.refs.every((r) => /^(doc|lab|story|concept):/.test(r.trace) && r.url), "every reference has a trace and a link");
const b = D.blog(full, "https://example.test"), nums = [...b.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
ok(nums.length > 0 && nums.every((n) => n >= 1 && n <= full.refs.length), "every [n] in the blog resolves to a reference");
ok(/## References/.test(b) && /Trace: `doc:sample1`/.test(b), "the blog lists references with traces");
ok(full.people.length === 1 && full.people[0].mentions === 2 && !/Sample Person (said|says|claims|argues|believes)/i.test(b), "people appear as mention counts only, with no claims");
ok(/not supported at toy scale/.test(b) && full.weak.some((w) => /did not support/.test(w.text)), "a failed toy check is reported, not hidden");
const P = D.posts(full, "https://example.test/m/dossier#recursive-self-improvement");
ok(P.every((p) => !/twitter\.com|x\.com/i.test(p.text)) && P.find((p) => /Bluesky/.test(p.channel)).text.length <= 280, "posts: no Twitter/X, short post within 280 characters");
const long = D.posts({ ...full, label: "Sample topic with a long name (test data)", why: "x".repeat(150), papers: [{ ...full.papers[0], title: "T".repeat(120) }] }, "https://example.test/m/dossier#sample");
ok(long.every((p) => (p.text.match(/"/g) || []).length % 2 === 0), "posts keep whole sentences: no quote is cut in half");
// REQ-037 (T041/T042): only High papers (credibility 65 or more around the cutoff 60, m = 5) count as credible; Border
// papers are listed as borderline; a held-up check of a paper that isn't credible doesn't lift the rating.
ok(base([doc(1, 60)], []).strength === "thin" && base([doc(1, 65)], []).strength === "early", "credibility exactly 60 is Border (thin); 65 = T + m is High (early)");
const bd = base([doc(1, 70), doc(2, 55)], []);
ok(bd.counts.credible === 1 && bd.counts.borderline === 1 && /## Borderline papers/.test(D.blog(bd)) && D.posts(bd).some((p) => /Borderline, not counted/.test(p.text)), "a Border paper (55 = T - m) is listed as borderline in the blog and posts, not counted as credible");
ok(base([doc(1, 70), doc(2, 65), doc(3, 58)], [ex("t", true, "https://arxiv.org/abs/2611.00003")]).strength === "early", "a held-up toy check of a Border paper doesn't lift early to some support (T042)");
const sb = D.storyboard(full);
ok(sb.scenes.every((s) => ["title", "say", "bars", "graph"].includes(s.kind) && s.seconds > 0), "the storyboard uses scenes the explainer player knows");
{
  const hi = doc(7, 80), lo = { ...doc(8, 20), verdict: "doubtful" };
  const d2 = D.analyse({ topic: "recursive-self-improvement", ids: ["recursive-self-improvement"], docs: [hi, lo], docEdges: [hi, lo].map((x) => ({ src: x.qid, rel: "explains", dst: "concept:sample" })), stories: [] }, { examples: [], concepts: [{ id: "sample", name: "Sample concept" }] });
  ok(d2.contested.length === 1 && d2.contested[0].high.credibility === 80 && d2.contested[0].low.verdict === "doubtful" && /## Where papers disagree/.test(D.blog(d2, "")), "a concept two papers explain but we judged far apart is listed as contested, in the blog too");
  const d3 = D.analyse({ topic: "recursive-self-improvement", ids: ["recursive-self-improvement"], docs: [doc(9, 70), doc(10, 65)], docEdges: [9, 10].map((i) => ({ src: `doc:sample${i}`, rel: "explains", dst: "concept:sample" })), stories: [] }, { examples: [], concepts: [] });
  ok(d3.contested.length === 0, "papers judged alike are not contested");
}
console.log(`\ndossier unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
