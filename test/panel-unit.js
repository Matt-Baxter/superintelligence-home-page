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
function model(id, { meet = ["numbers", "baseline", "uncertainty", "method", "sample", "held-out", "limitations"], hype = 10, prestigeBoost = 0, hypeSwing = 0, fakeQuotes = false } = {}) {
  const seen = [];
  return { id, model: `${id}-stub`, seen, async chat(msgs) {
    const u = msgs[1].content; seen.push(u);
    const text = (u.match(/"""\n([\s\S]*?)\n"""/) || [])[1] || "";
    const top = /top peer-reviewed journal/.test(u), calm = !/breakthrough/i.test(text);
    const blog = /anonymous personal blog/.test(u);
    let ids = [...meet]; if (prestigeBoost && top) ids = ids.concat(["artifacts"]); if (prestigeBoost && blog) ids = ["numbers"];
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
  const worded = await P.judgeWith(model("worded", { hypeSwing: 40 }), TEXT);
  ok(worded.biased.some((b) => /wording/.test(b)), `a model swayed by wording alone is flagged (sensitivity ${worded.sensitivity.wording})`);

  console.log("Compare and choose");
  const agreed = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("model-b", { hype: 20 })] });
  ok(agreed.status === "agreed" && !agreed.needsPerson && agreed.judges.length === 3 && /mean/.test(agreed.rule), "two fair models that agree are averaged with the rules judge");
  const split = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("model-c", { meet: ["numbers"], hype: 60 })] });
  const lows = split.judges.map((j) => j.credibility);
  ok(split.status === "disagreed" && split.needsPerson && split.credibility === Math.min(...lows), `disagreeing models give the most conservative credibility (${split.credibility}) and send it to a person`);
  const withBias = await P.panel({ text: TEXT, rules, models: [model("model-a"), model("swayed", { prestigeBoost: 20 })] });
  ok(withBias.status === "incomplete" && withBias.setAside.some((s) => s.id === "swayed") && withBias.credibility === rules.credibility, "a set-aside model leaves fewer than two usable, so the panel is incomplete and the rules judge stands");
  const one = await P.panel({ text: TEXT, rules, models: [model("model-a")] });
  ok(one.status === "incomplete", "one model is never enough: at least two different models are compared");
  const broken = await P.panel({ text: TEXT, rules, models: [model("model-a"), { id: "down", model: "x", chat: async () => { throw new Error("connection refused"); } }] });
  ok(broken.status === "incomplete" && broken.errors[0].id === "down", "a model that fails is reported, not guessed");
  ok(P.modelsFromEnv("").length === 0, "no models are called unless PANEL_MODELS is set");
  ok(/two different models/.test((R.CRITERIA.panel || {}).about || "") && /more than 10/.test(R.CRITERIA.panel.about), "the panel rule and its limits are published with the criteria");

  console.log(`\npanel unit: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
