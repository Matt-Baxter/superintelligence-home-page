#!/usr/bin/env node
// Judge panel (modules/review/panel.js) with deterministic stand-in models (test doubles, no network): masking hides
// identity from every model, prestige- and wording-swayed models are set aside, invented quotes are thrown out,
// agreeing models are averaged with the rules judge, disagreeing ones give the most conservative result and a person,
// and fewer than two usable models leaves the panel incomplete. All text is synthetic test data.
const P = require("../modules/review/panel"), R = require("../modules/review/review");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const TEXT = "Sample abstract (test data) by Jane Sample of OpenAI, posted at https://sample.substack.com/p/x. We evaluated 3 agent variants on 500 tasks drawn from a held-out test set. Compared with the baseline, the agent solved 41.2% of tasks versus 35.0% (95% confidence interval 3.9 to 8.5, across 5 seeds). Limitations: the tasks are short. This is a breakthrough.";
const S = { numbers: "Compared with the baseline, the agent solved 41.2% of tasks versus 35.0% (95% confidence interval 3.9 to 8.5, across 5 seeds).", method: "We evaluated 3 agent variants on 500 tasks drawn from a held-out test set." };
// A stand-in model: decides which checks are met from the text it is shown and the context line, and records what it saw.
function model(id, { meet = ["numbers", "baseline", "uncertainty", "method", "sample", "held-out", "limitations"], hype = 10, prestigeBoost = 0, hypeSwing = 0, evidenceSwing = false, fakeQuotes = false } = {}) {
  const seen = [];
  return { id, model: `${id}-stub`, seen, async chat(msgs) {
    const u = msgs[1].content; seen.push(u);
    const text = (u.match(/"""\n([\s\S]*?)\n"""/) || [])[1] || "";
    const top = /top peer-reviewed journal/.test(u), calm = !/breakthrough/i.test(text);
    const blog = /anonymous personal blog/.test(u);
    let ids = [...meet]; if (prestigeBoost && top) ids = ids.concat(["artifacts"]); if (evidenceSwing && calm) ids = ["numbers"]; if (prestigeBoost && blog) ids = ["numbers"];
    const quoteFor = (c) => fakeQuotes ? "A sentence that does not appear anywhere in the text at all." : (["numbers", "baseline", "uncertainty"].includes(c) ? S.numbers : c === "limitations" ? "Limitations: the tasks are short." : S.method);
    const checks = Object.fromEntries(ids.map((c) => [c, { met: true, quote: quoteFor(c) }]));
    return JSON.stringify({ checks, hype: (calm ? hype : hype + hypeSwing) + (top ? -prestigeBoost * 3 : 0), credibility: 50, reason: "stub" });
  } };
}
const rules = R.review({ kind: "paper", title: "Sample (test data)", text: TEXT });

(async () => {
  console.log("Masking");
  const m = P.mask(TEXT);
  ok(!/Jane Sample|OpenAI|substack|https?:/.test(m) && /\[NAME\]|\[PERSON\]/.test(m) && /\[ORG\]/.test(m) && /\[LINK\]/.test(m), "names, organisations and links are masked before a model reads the text");
  ok(/41\.2% of tasks versus 35\.0%/.test(m) && /held-out test set/.test(m), "the evidence itself is left intact");
  ok(!/breakthrough/i.test(P.neutralise(m)), "the wording mask neutralises hype words");
  const a = model("model-a"); await P.judgeWith(a, TEXT);
  ok(a.seen.length === 4 && a.seen.every((u) => !/Jane Sample|OpenAI/.test(u)), "every run of a model sees only the masked text (four runs: main, two prestige labels, calm wording)");
  const orders = a.seen.map((u) => (u.match(/^- [\w-]+:/gm) || []).join(""));
  ok(new Set(orders).size >= 3, "the rubric order changes between runs");

  console.log("Quote check");
  const fake = await P.judgeWith(model("fake", { fakeQuotes: true }), TEXT);
  ok(fake.rigor === 0 && fake.quotesDropped >= 7, "checks backed by quotes that aren't in the text are thrown out, and rigor is recomputed from what survives");

  console.log("Bias set aside");
  const swayed = await P.judgeWith(model("swayed", { prestigeBoost: 20 }), TEXT);
  ok(swayed.biased.some((b) => /prestige/.test(b)) && swayed.sensitivity.prestige > P.LIMITS.prestige, `a model that scores the same text higher when told it's from a top journal is flagged (sensitivity ${swayed.sensitivity.prestige})`);
  const worded = await P.judgeWith(model("worded", { evidenceSwing: true }), TEXT);
  ok(worded.biased.some((b) => /wording/.test(b)), `a model that finds evidence only when the text says "breakthrough" is flagged (evidence shift ${worded.sensitivity.wording})`);
  const faithful = await P.judgeWith(model("faithful", { hypeSwing: 40 }), TEXT);
  ok(!faithful.biased.length && faithful.sensitivity.wording === 0, "a model whose hype score drops when hype words are removed is not flagged: that's the published rubric, not bias");

  console.log("Compare and choose");
  const agreed = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("model-b", { hype: 20 })] });
  ok(agreed.status === "agreed" && !agreed.needsPerson && agreed.judges.length === 3 && /mean/.test(agreed.rule), "two fair models that agree are averaged with the rules judge");
  const split = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("model-c", { meet: ["numbers"], hype: 60 })] });
  const lows = split.judges.map((j) => j.credibility);
  ok(split.status === "disagreed" && split.needsPerson && split.credibility === Math.min(...lows), `disagreeing models give the most conservative credibility (${split.credibility}) and send it to a person`);
  const withBias = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("swayed", { prestigeBoost: 20 })] });
  ok(withBias.status === "incomplete" && withBias.setAside.some((s) => s.id === "swayed") && withBias.credibility === rules.credibility, "a set-aside model leaves fewer than two usable, so the panel is incomplete and the rules judge stands");
  console.log("Hard stops and escalation");
  const retracted = R.review({ kind: "paper", title: "Sample (test data)", text: TEXT + " This paper has been withdrawn by the authors." });
  const rp = await P.panel({ text: TEXT, rules: retracted, models: [model("model-a"), model("model-b", { hype: 12 })] });
  ok(rp.status === "agreed" && rp.verdict === "withdrawn" && rp.credibility <= retracted.credibility && rp.needsPerson, `two models agreeing a retracted paper is credible can't lift it: verdict ${rp.verdict}, credibility ${rp.credibility} (rules ${retracted.credibility})`);
  const weak = R.review({ kind: "article", title: "Sample (test data)", text: "This is already here and every lab knows it. It will soon change everything. Each year compounds the trend. It is inevitable." });
  const farAgree = await P.panel({ text: TEXT, rules: weak, models: [model("model-a"), model("model-b", { hype: 12 })] });
  ok(farAgree.status === "agreed" && Math.abs(farAgree.judges[1].credibility - weak.credibility) > P.LIMITS.escalate && farAgree.needsPerson && !farAgree.advice, "models that agree with each other far from the rules judge go to a person even with no advisor configured");
  const one = await P.panel({ text: TEXT, rules, models: [model("model-a")] });
  ok(one.status === "incomplete", "one model is never enough: at least two different models are compared");
  const broken = await P.panel({ text: TEXT, rules, models: [model("model-a"), { id: "down", model: "x", chat: async () => { throw new Error("connection refused"); } }] });
  ok(broken.status === "incomplete" && broken.errors[0].id === "down", "a model that fails is reported, not guessed");
  ok(P.modelsFromEnv("").length === 0, "no models are called unless PANEL_MODELS is set");
  ok(/two different models/.test((R.CRITERIA.panel || {}).about || "") && /more than 10/.test(R.CRITERIA.panel.about), "the panel rule and its limits are published with the criteria");

  console.log("Advisor (a bigger model that guides)");
  const advisorStub = (reply) => { const seen = []; return { id: "advisor", model: "advisor-stub", seen, async chat(msgs) { seen.push(msgs[1].content); return JSON.stringify(reply); } }; };
  const good = advisorStub({ prefer: "model-a", quotes: [S.numbers, "A sentence that is not in the text at all, invented."], advice: "Model A found the interval and the held-out set.", ruleIdea: "" });
  const adv = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("model-c", { meet: ["numbers"], hype: 60 })], advisor: good });
  ok(adv.status === "disagreed" && adv.advice && adv.advice.prefer === "model-a" && adv.advice.quotes.length === 1 && adv.advice.quotesDropped === 1, "on disagreement the advisor is asked, names the reading the text supports, and invented quotes are dropped");
  ok(adv.credibility === split.credibility && adv.needsPerson, "the advisor never sets the score: the most conservative result stands and a person decides");
  ok(good.seen.every((u) => !/Jane Sample|OpenAI|substack/.test(u)), "the advisor sees only the masked text");
  const quiet = advisorStub({ prefer: "model-a", quotes: [S.numbers], advice: "x" });
  const calm = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("model-b", { hype: 20 })], advisor: quiet });
  ok(calm.status === "agreed" && !calm.advice && quiet.seen.length === 0, "when the efficient models agree near the rules judge, the bigger model isn't called (cost stays low)");
  const noQuotes = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("model-c", { meet: ["numbers"], hype: 60 })], advisor: advisorStub({ prefer: "model-c", quotes: ["Nothing like this is in the text, so it fails."], advice: "y" }) });
  ok(noQuotes.advice.prefer === "none", "an advisor preference without a verified quote counts as no preference");
  const A = require("../scripts/advise");
  const v = A.vet({ items: [{ id: "b-x", credible: false, kind: "article", title: "Sample: hype with no source (test data)", text: "A sample article that asserts big progress without any source or number at all." }, { id: "b-y", credible: true, kind: "paper", title: "Real-looking title", text: "Long enough text that is not labelled as test data in its title at all here." }], ruleIdeas: ["Count unsourced superlatives."] });
  ok(v.items.length === 1 && v.items[0].id === "b-x" && v.ruleIdeas.length === 1, "advisor proposals are vetted: only labelled test data passes, and nothing is added to the benchmark without a person");
  ok(/at most 3 synthetic test items/.test(A.prompt([{ ok: false, label: "x", value: 1, why: "y" }], [])[0].content), "the advisor's review prompt asks for synthetic items and rule ideas only");

  const withdrawn = R.review({ kind: "paper", title: "Sample withdrawn paper (test data)", text: "This paper has been withdrawn by the authors. We evaluated 3 models on 50 tasks." });
  for (const models of [[], [model("model-a"), model("model-b")]]) {
    const result = await P.panel({ text: "Sample withdrawn paper (test data)", rules: withdrawn, models });
    ok(result.verdict === "withdrawn" && result.credibility <= 10 && result.needsPerson, "panel preserves withdrawal caps and human review with zero or two models");
  }
  console.log(`\npanel unit: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
