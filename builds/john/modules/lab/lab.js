// Lab engine: run an example (reproduction + our hypothesis), judge it, and improve it with an autoresearch ratchet.
//   runExample(id) -> { baseline, variant, verdict, judgeInput, scorecard }
//   explore(id, { budget, proposer }) -> keeps parameter changes only when the target metric improves (a ratchet)
// Deterministic by default; an LLM proposer (lib/providers, e.g. Gemma on a Mac mini via Ollama) is optional and runs
// only in the worker (scripts/lab.js), never on the web server.
const { runners, rng } = require("./runners");
const EX = require("./examples.json");

const BY_ID = Object.fromEntries(EX.examples.map((e) => [e.id, e]));
const runnerOf = (e) => runners.get(e.reproduce.runner);
const withDefaults = (r, p) => ({ ...Object.fromEntries(Object.entries(r.params).map(([k, v]) => [k, v.default])), ...p });
// Keep each parameter in its range and on its step grid (no 0.15000000000000002).
function clamp(r, p) { const out = {}; for (const [k, v] of Object.entries(p)) { const d = r.params[k]; if (!d) { out[k] = v; continue; } let x = Math.min(d.max, Math.max(d.min, Number(v))); if (d.step) x = Math.round(Math.round((x - d.min) / d.step) * d.step * 1e6) / 1e6 + d.min; out[k] = Math.round(Math.min(d.max, x) * 1e6) / 1e6; } return out; }

function run(runnerId, params) { const r = runners.get(runnerId); const p = clamp(r, withDefaults(r, params)); return { params: p, ...r.run(p, { rng }) }; }

// Did the variant move the predicted metric the predicted way (and by the predicted size)?
function verdict(e, base, variant) {
  const { metric, direction, factor, delta } = e.hypothesis.predict;
  const b = base.metrics[metric], v = variant.metrics[metric];
  let ok = direction === "up" ? v > b : v < b;
  if (ok && factor) ok = direction === "up" ? v >= b * factor : v <= b / factor;
  if (ok && delta) ok = Math.abs(v - b) >= delta;
  const label = runnerOf(e).metrics.find((m) => m.id === metric)?.label || metric;
  const need = factor ? ` by a factor of ${factor}` : delta ? ` by at least ${delta}` : "";
  return { supported: ok, metric, label, baseline: b, variant: v,
    text: `${ok ? "Supported" : "Not supported"} at toy scale: ${label} went from ${b} to ${v} (predicted ${direction}${need}).` };
}

// Judge input in the decision module's format (criteria / entries / scores 0-10 with evidence), so the weighted judge,
// and JEV or CLEF runs made outside the app, can compare the reproduction with our hypothesis on the Decide page.
function judgeInput(e, base, variant) {
  const r = runnerOf(e);
  const criteria = e.criteria.map((c) => ({ id: c.metric, label: r.metrics.find((m) => m.id === c.metric)?.label || c.metric, weight: c.weight }));
  const score = (metric, a, b) => { const better = r.metrics.find((m) => m.id === metric)?.better || "higher"; if (a === b) return [5, 5]; const aWins = better === "higher" ? a > b : a < b; return aWins ? [8, 4] : [4, 8]; };
  const scores = { reproduction: {}, hypothesis: {} };
  for (const c of e.criteria) {
    const [sa, sb] = score(c.metric, base.metrics[c.metric], variant.metrics[c.metric]);
    scores.reproduction[c.metric] = { score: sa, evidence: `${c.metric} = ${base.metrics[c.metric]} (lab run, synthetic)` };
    scores.hypothesis[c.metric] = { score: sb, evidence: `${c.metric} = ${variant.metrics[c.metric]} (lab run, synthetic)` };
  }
  return { title: `${e.title} (lab, test data)`, criteria, entries: [{ id: "reproduction", label: "Reproduction of the idea" }, { id: "hypothesis", label: "Our hypothesis" }], scores };
}

function runExample(id, overrides = {}) {
  const e = BY_ID[id]; if (!e) throw new Error(`No lab example "${id}"`);
  const base = run(e.reproduce.runner, e.reproduce.params);
  const variant = run(e.reproduce.runner, { ...e.reproduce.params, ...e.hypothesis.params, ...overrides });
  return { example: e, baseline: base, variant, verdict: verdict(e, base, variant), judgeInput: judgeInput(e, base, variant) };
}

// ---------- autoresearch ratchet ----------
// The deterministic proposer tries one parameter step up or down at a time (coordinate search) and keeps the change only
// when the target metric improves. An LLM proposer gets the same context (program, history) and must return params JSON.
const deterministicProposer = {
  id: "deterministic", about: "Coordinate search: nudge one parameter one step, in turn",
  async propose({ runner, params, history, tunable }) {
    const i = history.length, keys = tunable.length ? tunable : Object.keys(runner.params);
    const k = keys[Math.floor(i / 2) % keys.length], d = runner.params[k], step = d.step || (d.max - d.min) / 10;
    return { ...params, [k]: Math.min(d.max, Math.max(d.min, Number(params[k]) + (i % 2 ? -step : step))) };
  },
};
async function explore(id, { budget = 12, target, tunable = [], proposer = deterministicProposer, onStep = () => {} } = {}) {
  const e = BY_ID[id]; if (!e) throw new Error(`No lab example "${id}"`);
  const runner = runnerOf(e);
  const metric = target || e.hypothesis.predict.metric;
  const better = runner.metrics.find((m) => m.id === metric)?.better || "higher";
  let params = withDefaults(runner, { ...e.reproduce.params, ...e.hypothesis.params });
  let best = run(e.reproduce.runner, params); const history = [{ step: 0, params, value: best.metrics[metric], kept: true, by: "start" }];
  const program = programText(e, metric, better, tunable);
  for (let s = 1; s <= budget; s++) {
    let cand;
    try { cand = clamp(runner, await proposer.propose({ example: e, runner, params, history, metric, better, tunable, program })); }
    catch (err) { history.push({ step: s, error: String(err.message || err).slice(0, 200), kept: false, by: proposer.id }); onStep(history.at(-1)); continue; }
    const res = run(e.reproduce.runner, cand), v = res.metrics[metric], cur = best.metrics[metric];
    const kept = better === "higher" ? v > cur : v < cur;
    history.push({ step: s, params: cand, value: v, kept, by: proposer.id });
    if (kept) { params = cand; best = res; }
    onStep(history.at(-1));
  }
  return { example: id, metric, better, best: { params, metrics: best.metrics }, history, program };
}

// The "program.md" an agent reads (autoresearch style): what to change, what to measure, what counts as better.
function programText(e, metric, better, tunable) {
  const r = runnerOf(e);
  return [`# ${e.title}`, "", `Idea: ${e.idea}`, `Hypothesis: ${e.hypothesis.statement}`, "",
    `Goal: make \`${metric}\` ${better}. Change only these parameters, within their ranges, and answer with JSON {"params": {...}} and nothing else.`, "",
    ...Object.entries(r.params).filter(([k]) => !tunable.length || tunable.includes(k)).map(([k, d]) => `- ${k}: ${d.about} (min ${d.min}, max ${d.max})`),
    "", "Every run is deterministic and takes milliseconds; a change is kept only if the metric improves."].join("\n");
}

// Training data from the loop, for fine-tuning a local model (e.g. Gemma with MLX on a Mac mini):
// SFT rows teach "given the program and history, propose params that were kept"; DPO pairs prefer kept over rejected.
function trainingRows(result) {
  const sft = [], dpo = [];
  for (let i = 1; i < result.history.length; i++) {
    const h = result.history[i]; if (!h.params) continue;
    const prompt = `${result.program}\n\nHistory: ${JSON.stringify(result.history.slice(0, i).map(({ params, value, kept }) => ({ params, value, kept })))}`;
    const answer = JSON.stringify({ params: h.params });
    if (h.kept) sft.push({ messages: [{ role: "user", content: prompt }, { role: "assistant", content: answer }] });
    const rejected = result.history.slice(i + 1).find((x) => x.params && !x.kept);
    if (h.kept && rejected) dpo.push({ prompt, chosen: answer, rejected: JSON.stringify({ params: rejected.params }) });
  }
  return { sft, dpo };
}

module.exports = { EX, BY_ID, runners, run, runExample, verdict, judgeInput, explore, programText, trainingRows, deterministicProposer };
