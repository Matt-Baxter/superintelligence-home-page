// System One judge: typed questions with probabilities instead of free-text scoring.
//
// Provider chain, one attempt each, identical questions on every attempt:
//   1. Clef-Flash primary   https://clef.create360.ai   POST /v1/systemone   (self-hosted, no key)
//   2. Clef-Flash secondary https://clef.aiurl.tw       POST /v1/systemone   (self-hosted, no key)
//   3. Jev on Vercel AI Gateway  POST /v1/evaluate  model typesafe-ai/jev  (needs gateway credits)
//
// Switch on network error, timeout, 401/403/429, 5xx, or a malformed reply. Stop on 400/422: the input
// is wrong and another provider will reject it too. The gateway names Clef's `noul` type `boolean`.
//
// The judge never sees the rule verdicts. It answers from the recorded action + observation only, so
// agreement with the rule-based checker is an independent measurement, not an echo.
"use strict";

const PROVIDERS = [
  { name: "clef-primary", url: "https://clef.create360.ai/v1/systemone", model: "clef-flash", dialect: "clef" },
  { name: "clef-secondary", url: "https://clef.aiurl.tw/v1/systemone", model: "clef-flash", dialect: "clef" },
  { name: "gateway-jev", url: "https://ai-gateway.vercel.sh/v1/evaluate", model: "typesafe-ai/jev", dialect: "gateway" },
];

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const RELEVANT =
  "About AI progress toward superintelligence: capabilities, alignment, safety, interpretability, compute and scaling, governance, forecasting, or automating AI research.";

const SWITCH = (status) => status === 401 || status === 403 || status === 429 || status >= 500;

function toDialect(body, dialect) {
  if (dialect !== "gateway") return body;
  const questions = {};
  for (const [id, q] of Object.entries(body.questions)) questions[id] = q.type === "noul" ? { ...q, type: "boolean" } : q;
  return { ...body, questions };
}

function gatewayToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "";
}

function normalize(answers) {
  const out = {};
  for (const [id, a] of Object.entries(answers || {})) {
    if (!a || typeof a !== "object") continue;
    if (a.type === "noul" || a.type === "boolean") out[id] = { type: "noul", p: Number(a.noul ?? a.boolean ?? a.probability) };
    else if (a.type === "choice") out[id] = { type: "choice", choice: a.choice, probabilities: a.probabilities, confidence: a.confidence };
    else if (a.type === "score") out[id] = { type: "score", score: a.score, confidence: a.confidence };
  }
  return out;
}

async function ask(body, { timeoutMs = 20000, providers = PROVIDERS, fetchImpl = fetch } = {}) {
  const failures = [];
  for (const p of providers) {
    const headers = { "content-type": "application/json", "user-agent": UA };
    if (p.dialect === "gateway") {
      const t = gatewayToken();
      if (!t) { failures.push({ provider: p.name, reason: "no gateway credential" }); continue; }
      headers.authorization = `Bearer ${t}`;
    }
    const t0 = Date.now();
    try {
      const res = await fetchImpl(p.url, {
        method: "POST",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(toDialect({ ...body, model: p.model }, p.dialect)),
      });
      const text = await res.text();
      if (!res.ok) {
        const reason = `${res.status} ${text.replace(/\s+/g, " ").slice(0, 140)}`;
        failures.push({ provider: p.name, reason, ms: Date.now() - t0 });
        if (SWITCH(res.status)) continue;
        return { ok: false, failures };
      }
      let json;
      try { json = JSON.parse(text); } catch { failures.push({ provider: p.name, reason: "invalid JSON", ms: Date.now() - t0 }); continue; }
      const answers = normalize(json.answers);
      if (!Object.keys(answers).length) { failures.push({ provider: p.name, reason: "no answers", ms: Date.now() - t0 }); continue; }
      return { ok: true, provider: p.name, model: json.model || p.model, ms: Date.now() - t0, usage: json.usage || null, answers, failures };
    } catch (e) {
      failures.push({ provider: p.name, reason: String(e.name === "TimeoutError" ? "timeout" : e.message || e).slice(0, 140), ms: Date.now() - t0 });
    }
  }
  return { ok: false, failures };
}

// Clef's whole rendered prompt must fit in 4096 tokens, so steps and titles go in separate batches.
function stepQuestions(steps) {
  const questions = {};
  for (const s of steps) {
    questions[`S${s.n}`] = {
      type: "choice",
      instructions: `Acceptance check ${s.at}. Action taken: ${s.action}. Did what the browser observed satisfy this check?`,
      criteria: {
        pass: "The observation shows the check is met.",
        fail: "The observation shows the check is not met.",
        unknown: "The observation does not decide it, for example the page left the site or was blocked.",
      },
    };
  }
  const state = steps.map((s) => `S${s.n} [${s.at}] ${s.action} -> ${s.observation}`).join("\n");
  return { state, questions };
}

function sampleQuestions(sample) {
  const questions = {};
  sample.forEach((s, i) => {
    questions[`t${i}`] = { type: "noul", instructions: `Is title t${i} on topic?`, criteria: { true: RELEVANT, false: "Not about AI progress toward superintelligence." } };
  });
  return { state: sample.map((s, i) => `t${i}: ${s.title}`).join("\n"), questions };
}

const DECIDED = new Set(["pass", "fail"]);

// Pure: compare System One step choices with the rule verdicts. Proxies (supports/contradicts) are not
// decided verdicts, so only pass/fail rule steps count toward agreement.
function stepAgreement(steps, answers) {
  const rows = steps.map((s) => {
    const a = answers[`S${s.n}`];
    return { id: `S${s.n}`, at: s.at, rule: s.verdict, s1: a?.choice ?? null, confidence: a?.confidence ?? null };
  });
  const comparable = rows.filter((r) => DECIDED.has(r.rule) && r.s1);
  const agree = comparable.filter((r) => r.rule === r.s1).length;
  // Direction only: a proxy leaning the same way as System One. Reported separately, never as a verdict.
  const LEAN = { pass: "pass", supports: "pass", fail: "fail", contradicts: "fail" };
  const leaning = rows.filter((r) => LEAN[r.rule] && r.s1);
  const leanAgree = leaning.filter((r) => LEAN[r.rule] === r.s1).length;
  return {
    rows,
    agree,
    of: comparable.length,
    rate: comparable.length ? Number((agree / comparable.length).toFixed(3)) : null,
    direction: { agree: leanAgree, of: leaning.length },
  };
}

// Pure: threshold Noul probabilities at 0.5 and compare with the rule tagger's labels.
function labelAgreement(sample, answers) {
  const labels = sample.map((_, i) => {
    const p = answers[`t${i}`]?.p;
    return Number.isFinite(p) ? (p >= 0.5 ? 1 : 0) : null;
  });
  const uncertain = sample.map((_, i) => answers[`t${i}`]?.p).filter((p) => Number.isFinite(p) && p > 0.35 && p < 0.65).length;
  const both = labels.map((l, i) => [l, sample[i].rel]).filter(([l, r]) => l !== null && (r === 0 || r === 1));
  const agree = both.filter(([l, r]) => l === r).length;
  return {
    labels,
    probabilities: sample.map((_, i) => answers[`t${i}`]?.p ?? null),
    onTopic: labels.filter((l) => l === 1).length,
    uncertain,
    agreeWithRuleTagger: both.length ? Number((agree / both.length).toFixed(3)) : null,
  };
}

async function judgeBuild(build, opts = {}) {
  const steps = await ask(stepQuestions(build.steps), opts);
  const sample = build.sample.slice(0, 20);
  const titles = sample.length ? await ask(sampleQuestions(sample), opts) : { ok: false, failures: [{ provider: "-", reason: "empty sample" }] };
  return {
    steps: steps.ok ? { provider: steps.provider, model: steps.model, ms: steps.ms, failures: steps.failures, ...stepAgreement(build.steps, steps.answers) } : { error: steps.failures },
    relevance: titles.ok ? { provider: titles.provider, model: titles.model, ms: titles.ms, failures: titles.failures, ...labelAgreement(sample, titles.answers) } : { error: titles.failures },
  };
}

module.exports = { PROVIDERS, ask, toDialect, normalize, stepQuestions, sampleQuestions, stepAgreement, labelAgreement, judgeBuild };
