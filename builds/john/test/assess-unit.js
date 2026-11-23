// Assessment ladder and scorecard (specs/004, REQ-041..052): tested at the module boundary with stub models.
const A = require("../lib/assess");
const S = require("../lib/score");
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL " + msg); } };
const llm = (model, reply, calls = { n: 0 }) => ({ model, calls, chat: async () => { calls.n++; return typeof reply === "function" ? reply() : JSON.stringify(reply); } });

(async () => {
  // Tier 0: deterministic and free
  const clear = { title: "New reasoning model beats GPT on math benchmark with chain-of-thought RL" };
  const thin = { id: 7, title: "OpenAI releases new model" };
  ok(A.ground(clear).verdict === "relevant" && A.ground(clear).tier === 0, "two grounded topics + in scope settle at tier 0");
  ok(A.ground({ title: "Best pizza recipes for summer" }).verdict === "irrelevant", "no ontology term + out of scope settle at tier 0");
  ok(A.ground({ title: "Hello world thing", url: "https://x.com/a/status/1" }).verdict === "reject", "social links are refused by rule");
  ok(A.ground(thin).verdict === "unsure", "thin grounding is left for a model");
  ok(A.inputHash(thin) === A.inputHash({ ...thin }) && A.inputHash(thin) !== A.inputHash(clear), "input hash is stable and content-addressed");

  // Clear cases never call a model
  const never = llm("t1", { relevant: true, topics: [], confidence: 1 });
  await A.assess(clear, { tier1: never });
  ok(never.calls.n === 0, "a tier-0 decision spends no model call");

  // Tier 1 accepted when confident and agreeing with grounding
  const t1 = llm("cheap", { relevant: true, topics: ["capabilities"], confidence: 0.9, reason: "launch" });
  const t2 = llm("bigger", { relevant: false, topics: [], confidence: 0.6 });
  let r = await A.assess(thin, { tier1: t1, tier2: t2 });
  ok(r.tier === 1 && r.verdict === "relevant" && t2.calls.n === 0, "confident tier 1 settles without tier 2");
  ok(r.trail.length === 2 && r.trail[0].tier === 0, "trail records every tier that ran");

  // Low confidence escalates
  const shaky = llm("cheap", { relevant: true, topics: ["capabilities"], confidence: 0.4 });
  const t2b = llm("bigger", { relevant: true, topics: ["capabilities"], confidence: 0.8 });
  r = await A.assess(thin, { tier1: shaky, tier2: t2b });
  ok(r.tier === 2 && r.model === "bigger", "low tier-1 confidence escalates to tier 2");

  // Ontology checks on model output
  const c = A.checkReply(JSON.stringify({ relevant: true, topics: ["capabilities", "made-up-topic"], confidence: 1 }), { topics: ["capabilities"] });
  ok(c.ok && c.topics.join() === "capabilities" && c.dropped === 1 && c.confidence === 0.8, "unknown topic ids are dropped and cost confidence");
  ok(!A.checkReply("not json", { topics: [] }).ok, "non-JSON replies fail their check");
  ok(A.checkReply(JSON.stringify({ relevant: true, topics: ["safety"], confidence: 1 }), { topics: ["capabilities"] }).disagrees, "disagreement with grounding is flagged");

  // Budget and failure fall back to unsure, never a guess
  const t1c = llm("cheap", { relevant: true, topics: ["capabilities"], confidence: 0.9 });
  r = await A.assess(thin, { tier1: t1c, budget: { tier1: 0 } });
  ok(r.verdict === "unsure" && t1c.calls.n === 0 && r.trail[1].skipped === "budget", "spent budget skips the call and stays unsure");
  r = await A.assess(thin, { tier1: llm("cheap", () => { throw new Error("rate limited"); }) });
  ok(r.verdict === "unsure" && /rate limited/.test(r.trail[1].skipped), "a model error stays unsure with the reason recorded");

  // Raw replies archive when Blob is configured
  const saved = [];
  r = await A.assess(thin, { tier1: t1c, archive: async (path, body) => { saved.push(path); return "blob://" + path; } });
  ok(saved.length === 1 && r.blob === "blob://" + saved[0] && saved[0].startsWith(`assessments/${A.RULES_VERSION}/7-tier1`), "raw reply archived under a versioned path");

  // Scorecard: grounded and buzz are separate, each check is pass/fail/null
  const story = { title: "Lab posts insane breakthrough", nsources: 1, sources: [{ kind: "lab" }], orgs: ["x"], papers: [], analysis: { benchmarks: [{ score: 90 }] } };
  const card = S.card({ story });
  ok(card.checks.every((k) => ["pass", "fail", "null"].includes(k.result)), "every check is pass, fail or null");
  ok(card.checks.find((k) => k.id === "measured").result === "fail" && card.salt.some((s) => /hype/.test(s)), "hype headline fails and adds a grain of salt");
  ok(card.checks.find((k) => k.id === "independence").result === "fail", "lab-only coverage fails independence");
  ok(card.checks.find((k) => k.id === "on_topic").result === "null", "unassessed story is null, not fail");
  ok(card.buzz === null && card.raters.count === 0, "no buzz before enough people react");

  const raters = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ user_id: i + 1, kind: "vote", age_days: 30, votes: 50, public_notes: 0, ...extra }));
  const few = S.card({ story, raters: raters(2) }), some = S.card({ story, raters: raters(3) }), many = S.card({ story, raters: raters(12) });
  ok(few.buzz === null && some.buzz > 0 && many.buzz > some.buzz && many.buzz < 100, "buzz needs 3 people, grows with reactions, never reaches 100");
  ok(some.grounded === many.grounded, "votes never move the grounded score");
  const dupes = S.card({ story, raters: [...raters(3), ...raters(3)] });
  ok(dupes.raters.count === 3, "one person counts once however many times they react");
  const fresh = S.card({ story, raters: raters(3, { age_days: 0.1, votes: 0 }) });
  ok(fresh.buzz < some.buzz && fresh.raters.byClass.new === 3, "new accounts count for less");
  ok(S.classify({ age_days: 30, activity: 500, public_notes: 20 }).id === "contributor", "heavy public writers are contributors");

  console.log(`assess-unit: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
