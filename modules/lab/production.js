// Production planning for paper responses (REQ-060, proposed): a synthetic viewer model, an A* planner that picks the
// beats of one explainer, and a Q-learner that picks what to make for each paper (format, compute, channel) over a
// week. Everything here is a SIMULATION with stated assumptions (SIM below): it ranks choices inside the model, it
// does not measure real audiences. Deterministic (seeded), plain JS, milliseconds per run.
//
//   Situations: what a paper gives us to show - evidence strength, a table, a mechanism, our own toy check.
//   A* ("best beats and alignment"): state = (next unit, elapsed seconds, viewer attention); each step picks a
//     variant of the next unit (or skips an optional one). Step cost = time + compute + information the viewer
//     loses (attention x clarity) + expected drop-off. h = the cheapest time and compute the remaining required units
//     could possibly take, which never overestimates, so the plan found is optimal in the model.
//   Q-learning ("dynamic offering, compute and distribution"): each day a paper arrives; the agent picks a format
//     (posts, article, short video, full video), a voice and a channel, under a weekly compute budget and audience
//     fatigue. Reward = reach x engagement - compute - a trust penalty for giving a thin paper the full treatment.

const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- assumptions (all of them, in one place) ----------
const SIM = {
  about: "Synthetic viewer and channel model. Numbers are assumptions chosen to be plausible and are labelled as such; compute ratios were measured on this repo's CPU sandbox.",
  viewer: { decayPerSecond: 0.006, densityDrain: 0.0009, motionLift: 0.02, misalignDrain: 0.025, dropK: 0.006, floor: 0.15 },
  cost: { perSecond: 0.004, perCpuSecond: 0.0015, perLostUnit: 0.3, perLostViewer: 0.5 },
  // CPU seconds per second of finished video, measured here: Manim -ql 0.19, -qm 0.45; Kokoro (int8, CPU) about 1.9
  // per second of speech; espeak-ng about 0.01. Text formats cost nothing to render.
  compute: { manim: { l: 0.19, m: 0.45 }, voice: { kokoro: 1.9, espeak: 0.01 } },
  budgetCpuSecondsPerWeek: 1500,
  // Trust penalty for overselling: the full video for a thin or abstract-only paper, a short one for an abstract-only paper.
  trust: { full: 0.6, short: 0.2 },
};

// Units of an explainer, in narrative order, and the variants that can show each one. density = words on screen,
// motion = 0..1 how much moves, aligned = each narrated sentence has its own animation cue, clarity = how well it
// gets the unit across when attention is full.
const UNITS = [
  { id: "hook", weight: 1.0, required: true, variants: [
    { id: "title-card", kind: "title", seconds: 4, density: 10, motion: 0.3, aligned: true, clarity: 0.7 },
    { id: "question-hook", kind: "title", seconds: 6, density: 14, motion: 0.5, aligned: true, clarity: 0.9 } ] },
  { id: "claims", weight: 2.0, required: true, variants: [
    { id: "claim-paragraphs", kind: "claims", seconds: 22, density: 70, motion: 0.2, aligned: false, clarity: 0.8 },
    { id: "claim-chips", kind: "claims", seconds: 13, density: 24, motion: 0.6, aligned: true, clarity: 0.85 },
    { id: "one-claim", kind: "claims", seconds: 7, density: 10, motion: 0.5, aligned: true, clarity: 0.6 } ] },
  { id: "mechanism", weight: 1.6, required: false, needs: "mechanism", variants: [
    { id: "text-steps", kind: "flow", seconds: 12, density: 40, motion: 0.2, aligned: false, clarity: 0.6 },
    { id: "flow-diagram", kind: "flow", seconds: 12, density: 18, motion: 0.9, aligned: true, clarity: 0.95 } ] },
  { id: "evidence", weight: 2.2, required: true, variants: [
    { id: "bars", kind: "bars", seconds: 10, density: 12, motion: 0.9, aligned: true, clarity: 0.95, needs: "table" },
    { id: "quote-card", kind: "quote", seconds: 8, density: 30, motion: 0.3, aligned: true, clarity: 0.65, needs: "results" } ] },
  { id: "rigor", weight: 1.8, required: true, variants: [
    { id: "full-checklist", kind: "checklist", seconds: 16, density: 80, motion: 0.4, aligned: false, clarity: 0.85 },
    { id: "top-checks", kind: "checklist", seconds: 10, density: 26, motion: 0.6, aligned: true, clarity: 0.8 },
    { id: "score-gauge", kind: "checklist", seconds: 5, density: 6, motion: 0.7, aligned: true, clarity: 0.45 } ] },
  { id: "toy", weight: 1.2, required: false, needs: "toy", variants: [
    { id: "curve-trace", kind: "curve", seconds: 10, density: 10, motion: 1.0, aligned: true, clarity: 0.9 } ] },
  { id: "open", weight: 1.4, required: true, needs: "questions", variants: [
    { id: "three-questions", kind: "questions", seconds: 10, density: 30, motion: 0.4, aligned: true, clarity: 0.85 },
    { id: "one-question", kind: "questions", seconds: 5, density: 12, motion: 0.4, aligned: true, clarity: 0.6 } ] },
  { id: "close", weight: 0.3, required: true, variants: [
    { id: "source-card", kind: "sources", seconds: 3, density: 12, motion: 0.1, aligned: true, clarity: 1 } ] },
];

// A situation is what one paper offers: how well its claims are backed, whether it has a table to draw, our own toy
// check, and a method section to diagram. Keys look like "partial+table+mech". (The first version had five named
// situations and sent every "partly supported" paper with a table to "strong-table": learning L3 in
// modules/responses/learnings.json.)
const STRENGTHS = { strong: "well supported", partial: "partly supported", thin: "thinly supported", abstract: "abstract only" };
const SK = Object.fromEntries(Object.entries(STRENGTHS).map(([k, v]) => [v, k]));
const sitKey = ({ strength, table, toy, mechanism, results = true, questions = true }) => `${SK[strength] || "thin"}${table ? "+table" : ""}${toy ? "+toy" : ""}${mechanism ? "+mech" : ""}${results ? "+res" : ""}${questions ? "+q" : ""}`;
const parseSit = (key) => { const [k, ...f] = String(key).split("+"); return { strength: STRENGTHS[k] || STRENGTHS.thin, table: f.includes("table"), toy: f.includes("toy"), mechanism: f.includes("mech"), results: f.includes("res"), questions: f.includes("q") }; };
const SITUATIONS = new Proxy({}, { get: (_, key) => parseSit(key) });
// Named situations for the Lab runner and the reports.
// "+res": the paper has a result sentence to quote; "+q": the analysis left open questions (learning L11: without
// these flags A* could pick a quote card or a question beat that the plan then had to drop).
const SIT_IDS = ["strong+table+toy+mech+res+q", "strong+table+mech+res+q", "partial+table+mech+res+q", "partial+mech+res+q", "thin+res+q", "abstract+q"];
const situationOf = (a) => sitKey({ strength: a.strength || STRENGTHS.thin, table: !!a.table || (a.tables || []).length > 0, toy: !!(a.example || a.toy), mechanism: !!a.mechanism, results: a.results !== false, questions: a.questions !== false });
// The Q-learner sees a coarser class: strength, and whether there's something to draw (a table or our toy).
const classOf = (key) => { const S = parseSit(key); return `${SK[S.strength]}${S.table || S.toy ? "+visual" : ""}`; };
const weightFor = (unit, sit) => {
  const S = SITUATIONS[sit]; let w = unit.weight;
  if ((S.strength === "thinly supported" || S.strength === "abstract only") && unit.id === "open") w *= 1.8;
  if ((S.strength === "thinly supported" || S.strength === "abstract only") && unit.id === "claims") w *= 0.7;
  // Assumption: for a partly supported paper what's missing matters more than for a strong one (before this, strong
  // and partial papers always got identical plans).
  if (S.strength === "partly supported" && (unit.id === "open" || unit.id === "rigor")) w *= 1.3;
  return w;
};

// Calibration (learning L4): seconds measured in real renders replace the assumed seconds of each variant once
// measured. modules/lab/production-calibration.json is written by `npm run respond -- ... --render --learn`.
let CAL = {};
const calibration = {};
// Re-read the file and re-derive every variant's seconds from its assumed value (safe to call again after --learn).
function applyCalibration(override = null) {
  if (override) CAL = override;
  else { try { CAL = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "production-calibration.json"), "utf8")).variants || {}; } catch { CAL = {}; } }
  const all = UNITS.flatMap((u) => u.variants);
  for (const v of all) if (v.assumedSeconds === undefined) v.assumedSeconds = v.seconds;
  // Learning L10: calibrating only the variants we happened to render made the unmeasured ones look cheap by
  // comparison (their guesses stayed optimistic), so A* drifted toward whatever it hadn't tried. Unmeasured variants
  // are scaled by the mean measured/assumed ratio, so tried and untried options carry the same observed bias.
  const measured = all.filter((v) => CAL[v.id] && CAL[v.id].n > 0);
  const ratio = measured.length ? measured.reduce((t, v) => t + CAL[v.id].seconds / v.assumedSeconds, 0) / measured.length : 1;
  for (const v of all) { v.calibrated = !!(CAL[v.id] && CAL[v.id].n > 0); v.seconds = Math.max(2, Math.round(v.calibrated ? CAL[v.id].seconds : v.assumedSeconds * ratio)); }
  calibration.measured = measured.length; calibration.ratio = Math.round(ratio * 100) / 100;
  return calibration;
}
applyCalibration();

// ---------- the viewer model ----------
// Attention falls a little every second, faster under dense text and when the picture doesn't follow the voice;
// motion lifts it. A viewer leaves with probability dropK x (1 - attention) per second.
function watch(variant, att) {
  const V = SIM.viewer; let a = att, sum = 0, stay = 1;
  for (let t = 0; t < variant.seconds; t++) {
    a += -V.decayPerSecond - V.densityDrain * variant.density / variant.seconds * 4 + V.motionLift * variant.motion * (t < 3 ? 1 : 0.25) - (variant.aligned ? 0 : V.misalignDrain);
    a = Math.max(V.floor, Math.min(1, a)); sum += a; stay *= 1 - V.dropK * (1 - a);
  }
  return { att: a, mean: sum / variant.seconds, stay };
}
const stepCost = (unit, v, att, alive, sit) => {
  const w = watch(v, att), C = SIM.cost, cpu = v.seconds * (SIM.compute.manim.m + SIM.compute.voice.kokoro);
  const lost = weightFor(unit, sit) * (1 - v.clarity * w.mean) * alive;
  return { cost: C.perSecond * v.seconds + C.perCpuSecond * cpu + lost * SIM.cost.perLostUnit + (1 - w.stay) * alive * SIM.cost.perLostViewer, att: w.att, alive: alive * w.stay, value: weightFor(unit, sit) * v.clarity * w.mean * alive };
};
const usable = (unit, sit) => { const S = SITUATIONS[sit]; if (unit.needs && !S[unit.needs]) return []; return unit.variants.filter((v) => !v.needs || S[v.needs]); };

// ---------- A* over beat plans ----------
function astar({ situation = "strong+table+mech+res+q", maxSeconds = 90, heuristic = 1 } = {}) {
  const units = UNITS, C = SIM.cost;
  // Lower bound for the rest: each remaining required unit at its cheapest time and compute (ignores losses >= 0).
  const minFrom = units.map((_, i) => units.slice(i).reduce((s, u) => { const vs = usable(u, situation); if (!u.required || !vs.length) return s; return s + Math.min(...vs.map((v) => C.perSecond * v.seconds + C.perCpuSecond * v.seconds * (SIM.compute.manim.m + SIM.compute.voice.kokoro))); }, 0));
  const minSecFrom = units.map((_, i) => units.slice(i).reduce((s, u) => { const vs = usable(u, situation); return u.required && vs.length ? s + Math.min(...vs.map((v) => v.seconds)) : s; }, 0));
  minFrom.push(0); minSecFrom.push(0); // nothing left after the last unit (an undefined bound here made f NaN)
  const open = [{ i: 0, t: 0, att: 1, alive: 1, g: 0, f: heuristic * minFrom[0], path: [], value: 0 }];
  let expanded = 0;
  while (open.length) {
    open.sort((a, b) => a.f - b.f || a.t - b.t); const n = open.shift();
    if (n.i === units.length) return { plan: n.path, cost: round(n.g, 4), seconds: n.t, value: round(n.value), stay: round(n.alive), expanded };
    expanded++; // tree search: every path is its own state (attention and drop-off depend on the whole history), so h only needs to be admissible
    const u = units[n.i], vs = usable(u, situation), moves = vs.map((v) => ({ v })); if (!u.required || !vs.length) moves.push({ v: null });
    for (const { v } of moves) {
      if (!v) { const lost = u.required ? 0 : weightFor(u, situation) * SIM.cost.perLostUnit * n.alive * (vs.length ? 1 : 0); open.push({ ...n, i: n.i + 1, g: n.g + lost, f: n.g + lost + heuristic * minFrom[n.i + 1], path: [...n.path, { unit: u.id, variant: null }] }); continue; }
      if (n.t + v.seconds + minSecFrom[n.i + 1] > maxSeconds) continue;
      const s = stepCost(u, v, n.att, n.alive, situation), g = n.g + s.cost;
      open.push({ i: n.i + 1, t: n.t + v.seconds, att: s.att, alive: s.alive, g, f: g + heuristic * minFrom[n.i + 1], value: n.value + s.value, path: [...n.path, { unit: u.id, variant: v.id, kind: v.kind, seconds: v.seconds }] });
    }
  }
  return { plan: null, cost: Infinity, seconds: 0, value: 0, stay: 0, expanded };
}
// The plan we shipped first (every unit, the wordiest variants), scored in the same model, for comparison.
function scorePlan(ids, situation) {
  let att = 1, alive = 1, cost = 0, t = 0, value = 0;
  for (const u of UNITS) { const v = usable(u, situation).find((x) => ids.includes(x.id)); if (!v) continue; const s = stepCost(u, v, att, alive, situation); cost += s.cost; att = s.att; alive = s.alive; t += v.seconds; value += s.value; }
  return { cost: round(cost, 4), seconds: t, value: round(value), stay: round(alive) };
}
const FIRST_PLAN = ["title-card", "claim-paragraphs", "text-steps", "bars", "quote-card", "full-checklist", "curve-trace", "three-questions", "source-card"];

// ---------- Q-learning over offerings ----------
const FORMATS = [
  { id: "posts", label: "Posts only", video: 0, quality: 0.35 },
  { id: "article", label: "Article and posts", video: 0, quality: 0.55 },
  { id: "short", label: "45 s video (draft quality) + posts", video: 45, q: "l", quality: 0.7 },
  { id: "full", label: "90 s video (720p) + article + posts", video: 90, q: "m", quality: 0.95 },
];
const VOICES = [{ id: "kokoro", quality: 1 }, { id: "espeak", quality: 0.55 }];
const CHANNELS = [
  { id: "social", label: "Bluesky / Threads / Mastodon", reach: 1.0, fit: { posts: 1, article: 0.7, short: 1.1, full: 0.6 } },
  { id: "newsletter", label: "Substack / newsletter", reach: 0.6, fit: { posts: 0.3, article: 1.3, short: 0.6, full: 1.0 } },
  { id: "video", label: "Video site", reach: 1.4, fit: { posts: 0, article: 0, short: 0.9, full: 1.2 } },
];
const ACTIONS = FORMATS.flatMap((f) => (f.video ? VOICES : [VOICES[1]]).flatMap((v) => CHANNELS.map((c) => ({ f, v: f.video ? v : null, c, id: `${f.id}${f.video ? `+${v.id}` : ""}@${c.id}` }))));
const CLASSES = ["strong+visual", "strong", "partial+visual", "partial", "thin+visual", "thin", "abstract+visual", "abstract"];
const sitPrior = [0.12, 0.08, 0.17, 0.15, 0.08, 0.17, 0.03, 0.2]; // how often each class arrives (assumption)
const cpuOf = (a) => (a.f.video ? a.f.video * (SIM.compute.manim[a.f.q] + SIM.compute.voice[a.v.id]) : 0);
// Engagement: how well this offering suits this paper. A thin or abstract-only paper given the full video is
// overclaiming: it loses trust (the penalty) even if it gets views.
function reward(sit, a, fatigue, r) {
  const S = SITUATIONS[sit], strong = S.strength === "well supported" ? 1 : S.strength === "partly supported" ? 0.7 : S.strength === "thinly supported" ? 0.35 : 0.2;
  const show = a.f.video ? (S.table || S.toy ? 1.1 : 0.75) : 1;
  const eng = a.f.quality * (a.v ? a.v.quality : 1) * a.c.fit[a.f.id] * show * (0.4 + 0.6 * strong);
  const reach = a.c.reach * (1 - 0.25 * fatigue[a.c.id]);
  const trust = a.f.id === "full" && strong < 0.5 ? SIM.trust.full : a.f.id === "short" && strong < 0.3 ? SIM.trust.short : 0;
  return reach * eng - trust - SIM.cost.perCpuSecond * cpuOf(a) * 0.4 + 0.05 * (r() - 0.5);
}
const bucket = (budget) => (budget <= 0 ? 0 : budget < 300 ? 1 : budget < 800 ? 2 : 3);
const fatigueKey = (f) => CHANNELS.map((c) => (f[c.id] > 0.5 ? 1 : 0)).join("");
// Days left is part of the state (learning L12: without it the same state was a last day and a first day at once,
// so the values mixed horizons and couldn't learn when to save budget).
const leftKey = (left) => (left <= 1 ? "1" : left <= 3 ? "2-3" : "4+");
const stateKey = (sit, budget, f, left = 7) => `${classOf(sit)}|${bucket(budget)}|${fatigueKey(f)}|${leftKey(left)}`;
function step(sit, a, budget, fatigue, r) {
  // The noise draw comes first, always, so every policy sees the same random numbers (learning L13).
  const noise = r(), cpu = cpuOf(a); if (cpu > budget) return { reward: -0.3, budget, fatigue, failed: true }; // over budget: nothing ships
  const rew = reward(sit, a, fatigue, () => noise), next = Object.fromEntries(CHANNELS.map((c) => [c.id, c.id === a.c.id ? Math.min(1, fatigue[c.id] + 0.35) : Math.max(0, fatigue[c.id] - 0.2)]));
  return { reward: rew, budget: budget - cpu, fatigue: next, failed: false };
}
const drawSit = (r) => { let x = r(), i = 0; while (i < sitPrior.length - 1 && x > sitPrior[i]) x -= sitPrior[i++]; return CLASSES[i].replace("+visual", "+table"); };
function qlearn({ episodes = 40000, days = 7, alpha = 0.05, gamma = 0.9, epsilon = 0.3, budget = SIM.budgetCpuSecondsPerWeek, seed = 7 } = {}) {
  const r = rng(seed), Q = new Map(), visits = new Map(), q = (k) => { if (!Q.has(k)) Q.set(k, new Float64Array(ACTIONS.length)); return Q.get(k); };
  const curve = [];
  let avg = 0;
  for (let e = 0; e < episodes; e++) {
    let b = budget, f = { social: 0, newsletter: 0, video: 0 }, sit = drawSit(r), total = 0;
    const eps = epsilon * Math.max(0.05, 1 - e / (episodes * 0.8));
    for (let d = 0; d < days; d++) {
      const k = stateKey(sit, b, f, days - d), row = q(k); visits.set(k, (visits.get(k) || 0) + 1);
      const ai = r() < eps ? Math.floor(r() * ACTIONS.length) : argmax(row);
      const s = step(sit, ACTIONS[ai], b, f, r), nextSit = drawSit(r), nk = stateKey(nextSit, s.budget, s.fatigue, days - d - 1);
      const target = s.reward + (d === days - 1 ? 0 : gamma * Math.max(...q(nk)));
      row[ai] += alpha * (target - row[ai]); total += s.reward; b = s.budget; f = s.fatigue; sit = nextSit;
    }
    avg = avg * 0.98 + total * 0.02; if (e % Math.max(1, Math.floor(episodes / 30)) === 0) curve.push([e, round(avg)]);
  }
  return { Q, curve, visits };
}
function argmax(row) { let b = 0; for (let i = 1; i < row.length; i++) if (row[i] > row[b]) b = i; return b; }
// Evaluate a policy (state -> action index) over the same fixed weeks.
function evaluate(policy, { weeks = 300, days = 7, budget = SIM.budgetCpuSecondsPerWeek, seed = 999 } = {}) {
  // Separate streams for which papers arrive and for reward noise, so every policy faces the same weeks (learning L13).
  let total = 0, cpu = 0, failed = 0, trust = 0, seen = ""; const papers = rng(seed), noise = rng(seed + 1);
  for (let w = 0; w < weeks; w++) {
    let b = budget, f = { social: 0, newsletter: 0, video: 0 };
    for (let d = 0; d < days; d++) {
      const sit = drawSit(papers), ai = policy(sit, b, f, days - d), a = ACTIONS[ai], s = step(sit, a, b, f, noise); if (w < 20) seen += sit[0] + sit.length;
      total += s.reward; cpu += s.failed ? 0 : cpuOf(a); failed += s.failed ? 1 : 0;
      const S = SITUATIONS[sit]; if (!s.failed && a.f.id === "full" && (S.strength === "thinly supported" || S.strength === "abstract only")) trust++;
      b = s.budget; f = s.fatigue;
    }
  }
  return { reward: round(total / weeks), cpuPerWeek: Math.round(cpu / weeks), failedPerWeek: round(failed / weeks, 2), overclaimPerWeek: round(trust / weeks, 2), weeks: seen };
}
const idx = (id) => ACTIONS.findIndex((a) => a.id === id);
const BASELINES = {
  "always full video": () => idx("full+kokoro@video"),
  "always posts": () => idx("posts@social"),
  "full video on strong papers, else article": (sit) => (SITUATIONS[sit].strength === "well supported" ? idx("full+kokoro@video") : idx("article@newsletter")),
};
// Learning L6: a state the learner rarely saw has a Q-row shaped by a handful of noisy rewards; there the hand rule
// decides instead (minVisits = 0 turns the fallback off).
function policyFrom(Q, visits = null, minVisits = 0) { const rule = BASELINES["full video on strong papers, else article"]; return (sit, b, f, left = 7) => { const k = stateKey(sit, b, f, left), row = Q.get(k); if (!row || (visits && (visits.get(k) || 0) < minVisits)) return rule(sit, b, f); return argmax(row); }; }
// The learned offering for each situation at a full budget and no fatigue.
function policyTable(Q) {
  return CLASSES.map((c) => { const row = Q.get(stateKey(c.replace("+visual", "+table"), SIM.budgetCpuSecondsPerWeek, { social: 0, newsletter: 0, video: 0 })); const a = ACTIONS[row ? argmax(row) : idx("article@newsletter")]; return { situation: c, offering: a.f.label, voice: a.v ? a.v.id : "none", channel: a.c.label, action: a.id }; });
}

// ---------- Lab runners ----------
const runners = [
  { id: "response-astar", about: "A* picks the beats of a paper's explainer (which variant of each part, or skip) in a synthetic viewer model",
    params: {
      situation: { default: 1, min: 0, max: 5, step: 1, about: `Paper situation: ${SIT_IDS.map((s, i) => `${i} = ${s}`).join(", ")}` },
      max_seconds: { default: 90, min: 40, max: 180, step: 5, about: "Longest video allowed (seconds)" },
      first_plan: { default: 0, min: 0, max: 1, step: 1, about: "1 = score the plan we shipped first (every part, wordiest variants) instead of searching" },
      heuristic: { default: 1, min: 0, max: 1, step: 1, about: "1 = A* with its lower bound, 0 = uniform-cost search (same answer, more nodes)" },
    },
    metrics: [{ id: "value", label: "Information the viewer keeps (model units)", better: "higher" }, { id: "stay", label: "Share of viewers still watching at the end", better: "higher" }, { id: "seconds", label: "Video length (s)", better: "lower" }, { id: "cost", label: "Plan cost (model)", better: "lower" }, { id: "expanded", label: "Search nodes expanded", better: "lower" }],
    run: (p) => {
      const sit = SIT_IDS[Math.max(0, Math.min(5, Math.round(p.situation ?? 1)))];
      const res = p.first_plan ? { ...scorePlan(FIRST_PLAN, sit), expanded: 0, plan: FIRST_PLAN.map((v) => ({ variant: v })) } : astar({ situation: sit, maxSeconds: p.max_seconds ?? 90, heuristic: p.heuristic ?? 1 });
      let t = 0; const pts = [[0, 0]]; for (const s of res.plan || []) { if (s.seconds) { t += s.seconds; pts.push([t, pts.length]); } }
      return { metrics: { value: res.value, stay: res.stay, seconds: res.seconds, cost: res.cost, expanded: res.expanded }, series: [{ name: "beats by second", points: pts }],
        notes: [`Situation: ${sit}. Plan: ${(res.plan || []).map((s) => s.variant || `skip ${s.unit}`).join(" → ")}.`, "Simulation: a synthetic viewer model with stated assumptions, not audience data."] };
    } },
  { id: "response-qlearn", about: "Q-learning picks what to make for each paper (format, voice, channel) under a weekly compute budget and audience fatigue",
    params: {
      policy: { default: 0, min: 0, max: 3, step: 1, about: "0 = learned (Q-learning), 1 = always full video, 2 = always posts, 3 = full video on strong papers else article" },
      budget: { default: SIM.budgetCpuSecondsPerWeek, min: 0, max: 4000, step: 100, about: "CPU seconds per week for rendering and voice" },
      episodes: { default: 40000, min: 1000, max: 60000, step: 1000, about: "Training weeks for the Q-learner" },
      seed: { default: 7, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "reward", label: "Weekly reward (reach x engagement - compute - trust)", better: "higher" }, { id: "overclaimPerWeek", label: "Full videos given to thin papers per week", better: "lower" }, { id: "cpuPerWeek", label: "CPU seconds used per week", better: "lower" }, { id: "failedPerWeek", label: "Offerings over budget per week", better: "lower" }],
    run: (p) => {
      const budget = p.budget ?? SIM.budgetCpuSecondsPerWeek, names = Object.keys(BASELINES), pick = Math.round(p.policy ?? 0);
      let pol, curve = [], table = null;
      if (!pick) { const L = qlearn({ episodes: p.episodes ?? 40000, budget, seed: p.seed ?? 7 }); pol = policyFrom(L.Q, L.visits, 30); curve = L.curve; table = policyTable(L.Q); } else pol = BASELINES[names[pick - 1]];
      const { weeks, ...m } = evaluate(pol, { budget });
      return { metrics: m, series: curve.length ? [{ name: "average weekly reward while learning", points: curve }] : [],
        notes: [pick ? `Baseline: ${names[pick - 1]}.` : `Learned offering at a full budget: ${table.map((x) => `${x.situation} → ${x.offering}, ${x.voice} voice, ${x.channel}`).join("; ")}.`, "Simulation: a synthetic channel model with stated assumptions, not audience data."] };
    } },
];
for (const r of runners) { const raw = r.run; r.run = (p) => raw(p); }

module.exports = { calibration, applyCalibration, SIM, UNITS, SITUATIONS, SIT_IDS, CLASSES, situationOf, classOf, sitKey, parseSit, CAL, astar, scorePlan, FIRST_PLAN, qlearn, evaluate, policyFrom, policyTable, BASELINES, ACTIONS, runners, watch };
