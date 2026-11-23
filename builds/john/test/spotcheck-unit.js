// Spot checks (modules/review/spotcheck.js): the daily large-model safety loop stays cheap, honest and bounded.
const assert = require("assert");
const SC = require("../modules/review/spotcheck");

function fakeDb(docs) {
  const checks = [];
  return { checks, docs,
    async get(sql, day) { if (/COUNT/.test(sql)) return { n: checks.filter((c) => c.day === day).length }; },
    async all() { return docs.filter((d) => !checks.some((c) => c.doc_qid === d.qid)).sort((a, b) => b.id - a.id); },
    async run(sql, ...a) {
      if (/INSERT INTO review_spotchecks/.test(sql)) checks.push({ doc_qid: a[0], day: a[1], model: a[2], status: a[3], problem: a[4], quotes: a[5] });
      if (/UPDATE review_docs/.test(sql)) docs.find((d) => d.qid === a[0]).needs_person = 1;
    } };
}
const EXCERPT = "The model scored 92 percent on the benchmark. We did not test it on held-out data or report variance across seeds.";
const doc = (id, verdict, extra = {}) => ({ id, qid: `doc:${id}`, title: `Doc ${id}`, excerpt: EXCERPT, verdict, credibility: 70, needs_person: 0, result: "{}", ...extra });
const model = (reply) => ({ id: "fake", model: "big", calls: 0, async chat() { this.calls++; return typeof reply === "function" ? reply() : reply; } });
const NOW = new Date("2026-11-22T03:30:00Z");
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

(async () => {
  await t("no model configured: nothing is called and the run says why", async () => {
    const r = await SC.run(fakeDb([doc(1, "credible")]), { model: null, now: NOW });
    assert.strictEqual(r.checked, 0); assert.match(r.skipped, /No larger model/);
  });

  await t("daily budget is a hard cap even when the env asks for more", async () => {
    assert.strictEqual(SC.dailyMax({ SPOTCHECK_DAILY_MAX: "999" }), SC.HARD_CAP);
    assert.strictEqual(SC.dailyMax({ SPOTCHECK_DAILY_MAX: "-3" }), 0);
    assert.strictEqual(SC.dailyMax({}), 5);
  });

  await t("runs stop once today's budget is spent", async () => {
    const db = fakeDb(Array.from({ length: 10 }, (_, i) => doc(i + 1, "credible")));
    const m = model({ agree: true }), env = { SPOTCHECK_DAILY_MAX: "4", SPOTCHECK_SAMPLE: "3" };
    const a = await SC.run(db, { model: m, now: NOW, env }), b = await SC.run(db, { model: m, now: NOW, env }), c = await SC.run(db, { model: m, now: NOW, env });
    assert.deepStrictEqual([a.checked, b.checked, c.checked], [3, 1, 0]); assert.match(c.skipped, /budget/); assert.strictEqual(m.calls, 4);
  });

  await t("sampling spreads across verdicts and skips reviews a person already holds", async () => {
    const picked = SC.pick([doc(1, "credible"), doc(2, "credible"), doc(3, "hype"), doc(4, "weak", { needs_person: 1 }), doc(5, "weak")], 3);
    assert.deepStrictEqual(picked.map((d) => d.verdict).sort(), ["credible", "hype", "weak"]);
    assert.ok(!picked.some((d) => d.needs_person), "a review already with a person is not re-checked first");
  });

  await t("a quoted disagreement sends the review to a person", async () => {
    const db = fakeDb([doc(1, "credible")]);
    const r = await SC.run(db, { model: model({ agree: false, problem: "No held-out test.", quotes: ["We did not test it on held-out data"] }), now: NOW });
    assert.strictEqual(r.flagged, 1); assert.strictEqual(db.docs[0].needs_person, 1); assert.strictEqual(db.checks[0].status, "flagged");
  });

  await t("a disagreement with invented quotes changes nothing", async () => {
    const db = fakeDb([doc(1, "credible")]);
    const r = await SC.run(db, { model: model({ agree: false, quotes: ["The authors admit the result is fabricated"] }), now: NOW });
    assert.strictEqual(r.flagged, 0); assert.strictEqual(db.docs[0].needs_person, 0); assert.strictEqual(db.checks[0].status, "unsupported");
  });

  await t("unreadable replies and outages are logged, never treated as agreement", async () => {
    const db = fakeDb([doc(1, "credible"), doc(2, "hype")]);
    await SC.run(db, { model: model("I think it is fine"), now: NOW, env: { SPOTCHECK_SAMPLE: "1" } });
    await SC.run(db, { model: model(() => { throw new Error("429 rate limited"); }), now: NOW, env: { SPOTCHECK_SAMPLE: "1" } });
    assert.deepStrictEqual(db.checks.map((c) => c.status).sort(), ["error", "unreadable"]);
  });

  await t("the larger model sees only the masked excerpt, never a link or the full text", async () => {
    const msgs = SC.messages(doc(1, "credible", { excerpt: "See https://example.com/paper for details. " + EXCERPT }));
    const body = JSON.parse(msgs[1].content);
    assert.ok(!/https?:/.test(body.excerpt)); assert.ok(body.excerpt.length <= 400 + 40);
    assert.deepStrictEqual(Object.keys(body).sort(), ["credibility", "excerpt", "guardsFired", "verdict"]);
  });

  console.log(`\n${n} spot-check tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
