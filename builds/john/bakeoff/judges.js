// Multi-family judge panel over a recorded analysis run.
//
// Each judge (a different model family) sees only the evidence packet the browser run recorded and
// scores the CONTRACT.md rubric. A deterministic checker then audits the reply against that evidence
// and sends the findings back; the judge revises, up to MAX_ROUNDS. Every round is traced. Scores the
// checker still rejects after the last round are quarantined (dropped, with the reason recorded), so a
// judge can never introduce a number the evidence does not support.
//
// Judges are model-assisted notes, not the partners' decision: CONTRACT.md reserves relevance and the
// human acceptance tests for the two partners.
//
//   node bakeoff/judges.js [runDir]      writes <runDir>/judges.json
"use strict";

const fs = require("fs");
const path = require("path");
const { create, parseJson } = require("../lib/providers");
const { clef } = require("./metrics");
const systemOne = require("./systemone");
const criteria = require("./criteria.json").criteria;

const MAX_ROUNDS = 3;
const SAMPLE_K = 20;
const AT_COUNT = 14;

// All reachable on the AI Gateway free tier (checked 2026-11-22). Anthropic and the newer Gemini
// Flash-Lite return 403 without gateway credits; add them via JUDGES once credits exist.
const PANEL = [
  { model: "openai/gpt-5-nano", family: "OpenAI", kind: "proprietary · small reasoning", temperature: 1 },
  { model: "openai/gpt-oss-120b", family: "OpenAI", kind: "open weights · reasoning MoE" },
  { model: "google/gemini-2.5-flash-lite", family: "Google", kind: "proprietary · fast" },
  { model: "deepseek/deepseek-v4-flash", family: "DeepSeek", kind: "open weights · MoE" },
  { model: "alibaba/qwen3-next-80b-a3b-instruct", family: "Alibaba", kind: "open weights · sparse MoE instruct" },
  { model: "moonshotai/kimi-k2", family: "Moonshot", kind: "open weights · large MoE" },
  { model: "meta/llama-4-scout", family: "Meta", kind: "open weights · MoE" },
  { model: "mistral/ministral-8b", family: "Mistral", kind: "open weights · 8B dense" },
];

// Which recorded evidence can decide each rubric criterion. Criteria with none must be null.
const EVIDENCE_FOR = { acceptance: "steps", relevance: "sample", usability: "steps" };

function packet(build) {
  return {
    build: build.id,
    url: build.url,
    consoleErrors: build.consoleErrors,
    steps: build.steps.map((s) => ({ id: `S${s.n}`, at: s.at, action: s.action, observation: s.observation, verdict: s.verdict })),
    clear: build.clear,
    clef: build.clef,
    sample: build.sample.slice(0, SAMPLE_K).map((s, i) => ({ i, title: s.title })),
  };
}

function acceptanceBounds(p) {
  const pass = p.steps.filter((s) => s.verdict === "pass").length;
  const fail = p.steps.filter((s) => s.verdict === "fail").length;
  if (!pass && !fail) return null;
  return { min: Math.round((100 * pass) / AT_COUNT), max: Math.round((100 * (AT_COUNT - fail)) / AT_COUNT) };
}

const validCites = (p) => new Set([...p.steps.map((s) => s.id), "clear", "clef", "sample"]);

// Pure: audit one judge reply against the packet. Returns a list of { code, criterion?, msg }.
function check(reply, p) {
  const flags = [];
  if (!reply || !Array.isArray(reply.criteria)) return [{ code: "schema", msg: "Reply needs a `criteria` array." }];
  const cites = validCites(p);
  const bounds = acceptanceBounds(p);
  for (const c of criteria) {
    const r = reply.criteria.find((x) => x && x.id === c.id);
    if (!r) { flags.push({ code: "schema", criterion: c.id, msg: `Missing criterion ${c.id}.` }); continue; }
    if (r.score === null || r.score === undefined) continue;
    if (!Number.isFinite(r.score) || r.score < 0 || r.score > 100) { flags.push({ code: "range", criterion: c.id, msg: `${c.id} score must be 0-100 or null.` }); continue; }
    if (!EVIDENCE_FOR[c.id]) flags.push({ code: "no-evidence", criterion: c.id, msg: `Nothing in the packet decides ${c.id}; it must be null.` });
    const rc = Array.isArray(r.cites) ? r.cites : [];
    if (!rc.length) flags.push({ code: "uncited", criterion: c.id, msg: `${c.id} has a score but cites no evidence.` });
    const bad = rc.filter((x) => !cites.has(x));
    if (bad.length) flags.push({ code: "bad-cite", criterion: c.id, msg: `${c.id} cites ids that do not exist: ${bad.join(", ")}.` });
    if (c.id === "acceptance") {
      if (!bounds) flags.push({ code: "bounds", criterion: c.id, msg: "No step is a decided pass/fail (proxies never count), so acceptance must be null." });
      else if (r.score < bounds.min || r.score > bounds.max) flags.push({ code: "bounds", criterion: c.id, msg: `Acceptance must lie in ${bounds.min}-${bounds.max} given the decided steps.` });
    }
  }
  const labels = reply.relevance;
  if (!Array.isArray(labels) || labels.length !== p.sample.length || labels.some((x) => x !== 0 && x !== 1)) {
    flags.push({ code: "relevance-shape", msg: `relevance must be ${p.sample.length} values, each 0 or 1, in sample order.` });
  } else {
    const rel = reply.criteria.find((x) => x && x.id === "relevance");
    const own = Math.round((100 * labels.reduce((a, b) => a + b, 0)) / labels.length);
    if (rel && Number.isFinite(rel.score) && Math.abs(rel.score - own) > 15) {
      flags.push({ code: "self-inconsistent", criterion: "relevance", msg: `Your labels mark ${own}% on-topic but you scored relevance ${rel.score}.` });
    }
  }
  return flags;
}

function diff(prev, next) {
  if (!prev || !next || !Array.isArray(prev.criteria) || !Array.isArray(next.criteria)) return null;
  const scores = criteria
    .map((c) => ({ id: c.id, from: prev.criteria.find((x) => x?.id === c.id)?.score ?? null, to: next.criteria.find((x) => x?.id === c.id)?.score ?? null }))
    .filter((d) => d.from !== d.to);
  const a = Array.isArray(prev.relevance) ? prev.relevance : [];
  const b = Array.isArray(next.relevance) ? next.relevance : [];
  const relabeled = b.filter((v, i) => a[i] !== undefined && a[i] !== v).length;
  return { scores, relabeled };
}

// Drop any score the checker still rejects after the last round.
function quarantine(reply, flags) {
  if (!reply || !Array.isArray(reply.criteria)) return { reply: null, dropped: [] };
  const hit = new Set(flags.filter((f) => f.criterion).map((f) => f.criterion));
  const dropped = [];
  const cleaned = reply.criteria.map((r) => {
    if (r && hit.has(r.id) && r.score !== null && r.score !== undefined) { dropped.push({ id: r.id, score: r.score }); return { ...r, score: null }; }
    return r;
  });
  const relevanceOk = !flags.some((f) => f.code === "relevance-shape");
  return { reply: { ...reply, criteria: cleaned, relevance: relevanceOk ? reply.relevance : null }, dropped };
}

const SYSTEM = [
  "You are one judge on a bake-off panel comparing two builds of a superintelligence news homepage.",
  "Score ONLY from the evidence packet. Never assume facts that are not in it.",
  `Rubric (weights): ${criteria.map((c) => `${c.id} ${c.weight} - ${c.measure}`).join("; ")}.`,
  "Each score is 0-100, or null when nothing in the packet decides it. Abstaining is correct, not a failure.",
  "Step verdicts: pass/fail are decided acceptance results; supports/contradicts are proxies that never count toward acceptance; unknown is undecided.",
  "Cite evidence by id: step ids (S1, S2, ...), 'clear', 'clef', or 'sample'.",
  "Also label each sample title 1 if it is about AI progress toward superintelligence (capabilities, alignment, safety, compute, governance, forecasting, AI R&D automation), else 0.",
  'Reply with JSON only: {"criteria":[{"id":"...","score":number|null,"reasoning":"one or two sentences","cites":["S1"]}],"relevance":[0|1,...]}',
].join("\n");

async function judgeBuild(llm, judge, p) {
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(p) }];
  const trace = [];
  let current = null;
  let promptChars = SYSTEM.length + messages[1].content.length;
  let replyChars = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const t0 = Date.now();
    let text = "";
    let parsed = null;
    let flags;
    try {
      text = await llm.chat(messages, { json: true, max_tokens: 8000, temperature: judge.temperature ?? 0 });
    } catch (e) {
      trace.push({ round, ms: Date.now() - t0, flags: [{ code: "call", msg: String(e.message || e).slice(0, 240) }], changed: null });
      break;
    }
    try {
      parsed = parseJson(text);
      flags = check(parsed, p);
    } catch (e) {
      flags = [{ code: "parse", msg: `${e.message}. Reply with the JSON object only.` }];
    }
    replyChars += text.length;
    trace.push({ round, ms: Date.now() - t0, flags, changed: diff(current, parsed) });
    if (parsed) current = parsed;
    if (!flags.length) break;
    const correction = `The checker found problems. Fix each one, keep everything else, and reply with the full JSON again:\n${flags.map((f) => `- [${f.code}] ${f.msg}`).join("\n")}`;
    messages.push({ role: "assistant", content: text || "(no reply)" }, { role: "user", content: correction });
    promptChars += correction.length + text.length;
  }
  const lastFlags = trace[trace.length - 1].flags;
  const { reply, dropped } = quarantine(current, lastFlags);
  return { final: reply, trace, settled: lastFlags.length === 0, dropped, estTokens: Math.round((promptChars + replyChars) / 4) };
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Fleiss' kappa for binary labels: raters x items.
function fleissKappa(rows) {
  const raters = rows.filter((r) => Array.isArray(r));
  if (raters.length < 2) return null;
  const n = raters.length;
  const N = raters[0].length;
  let pBar = 0;
  let ones = 0;
  for (let i = 0; i < N; i++) {
    const k1 = raters.reduce((a, r) => a + (r[i] === 1 ? 1 : 0), 0);
    ones += k1;
    const k0 = n - k1;
    pBar += (k1 * (k1 - 1) + k0 * (k0 - 1)) / (n * (n - 1));
  }
  pBar /= N;
  const p1 = ones / (n * N);
  const pe = p1 * p1 + (1 - p1) * (1 - p1);
  return pe === 1 ? 1 : Number(((pBar - pe) / (1 - pe)).toFixed(3));
}

function aggregate(results, p, build) {
  const live = results.filter((r) => r.final);
  const perCriterion = criteria.map((c) => {
    const scores = live.map((r) => ({ judge: r.judge.model, score: r.final.criteria.find((x) => x?.id === c.id)?.score })).filter((s) => Number.isFinite(s.score));
    const values = scores.map((s) => s.score);
    return { id: c.id, weight: c.weight, median: median(values), spread: values.length ? Math.max(...values) - Math.min(...values) : null, n: values.length, abstained: live.length - values.length, scores };
  });
  const low = perCriterion.reduce((a, c) => a + (c.weight * (c.median ?? 0)) / 100, 0);
  const high = perCriterion.reduce((a, c) => a + (c.weight * (c.median ?? 100)) / 100, 0);
  const labelRows = live.map((r) => r.final.relevance).filter((x) => Array.isArray(x));
  const majority = p.sample.map((_, i) => (labelRows.filter((r) => r[i] === 1).length * 2 > labelRows.length ? 1 : 0));
  const ruleLabels = build.sample.slice(0, SAMPLE_K).map((s) => s.rel);
  const agreeWithRule = labelRows.length ? Number((majority.filter((v, i) => v === ruleLabels[i]).length / majority.length).toFixed(3)) : null;
  return {
    perCriterion,
    weighted: { low: Math.round(low), high: Math.round(high) },
    relevance: {
      judges: labelRows.length,
      fleissKappa: fleissKappa(labelRows),
      agreeWithRuleTagger: agreeWithRule,
      panelClef: labelRows.length ? clef(p.sample.map((s, i) => ({ title: s.title, rel: majority[i] })), SAMPLE_K) : null,
    },
  };
}

function clearForJudge(r) {
  const decidable = Object.keys(EVIDENCE_FOR).length;
  const decided = r.final ? r.final.criteria.filter((c) => c && EVIDENCE_FOR[c.id] && Number.isFinite(c.score)).length : 0;
  const allCites = r.final ? r.final.criteria.flatMap((c) => (Array.isArray(c?.cites) ? c.cites : [])) : [];
  return {
    cost: { estTokens: r.estTokens, usd: null, note: "Token estimate from characters/4; endpoint does not report spend." },
    latencyMs: r.trace.reduce((a, t) => a + t.ms, 0),
    efficacy: { decided, of: decidable, rate: Number((decided / decidable).toFixed(3)) },
    assurance: { citesValid: allCites.filter((c) => r.validCites.has(c)).length, of: allCites.length, quarantined: r.dropped.length },
    reliability: { rounds: r.trace.length, firstRoundClean: r.trace[0].flags.length === 0, settled: r.settled },
  };
}

async function run(runDir) {
  const analysis = JSON.parse(fs.readFileSync(path.join(runDir, "analysis.json"), "utf8"));
  const panel = process.env.JUDGES ? PANEL.filter((j) => process.env.JUDGES.split(",").includes(j.model)) : PANEL;
  const out = { generated: new Date().toISOString(), run: path.basename(runDir), maxRounds: MAX_ROUNDS, panel, builds: [] };
  for (const build of analysis.builds) {
    const p = packet(build);
    const results = await Promise.all(
      panel.map(async (judge) => {
        let llm;
        try { llm = create("vercel-ai-gateway", { model: judge.model, timeoutMs: 90000 }); } catch (e) {
          return { judge, final: null, trace: [{ round: 1, ms: 0, flags: [{ code: "call", msg: e.message }] }], settled: false, dropped: [], estTokens: 0 };
        }
        const r = await judgeBuild(llm, judge, p);
        process.stdout.write(`${build.id} ${judge.model}: ${r.trace.length} round(s), ${r.settled ? "settled" : "unsettled"}${r.dropped.length ? `, quarantined ${r.dropped.map((d) => d.id).join("/")}` : ""}\n`);
        return { judge, ...r };
      }),
    );
    const vc = validCites(p);
    const judges = results.map((r) => ({ ...r, clear: clearForJudge({ ...r, validCites: vc }) }));
    const s1 = process.env.SKIP_SYSTEM_ONE ? null : await systemOne.judgeBuild(build);
    if (s1) process.stdout.write(`${build.id} system-one: steps ${s1.steps.provider || "failed"} ${s1.steps.agree ?? "-"}/${s1.steps.of ?? "-"}, titles ${s1.relevance.provider || "failed"} agree ${s1.relevance.agreeWithRuleTagger ?? "-"}\n`);
    out.builds.push({ id: build.id, url: build.url, judges, panel: aggregate(results, p, build), systemOne: s1 });
  }
  fs.writeFileSync(path.join(runDir, "judges.json"), JSON.stringify(out, null, 2));
  return out;
}

if (require.main === module) {
  const runsRoot = path.join(__dirname, "runs");
  const runDir = process.argv[2] || path.join(runsRoot, fs.readdirSync(runsRoot).filter((d) => fs.existsSync(path.join(runsRoot, d, "analysis.json"))).sort().pop());
  run(runDir).then((o) => {
    for (const b of o.builds) console.log(`Build ${b.id}: weighted ${b.panel.weighted.low}-${b.panel.weighted.high}, kappa ${b.panel.relevance.fleissKappa}`);
  }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { PANEL, EVIDENCE_FOR, packet, check, diff, quarantine, acceptanceBounds, fleissKappa, median, aggregate, run };
