// The response plan (REQ-058, REQ-060; proposed). Before anything is drawn or written, each paper gets a short spec
// for the piece: audience, thesis, beats and acceptance checks. Which beats, and which variant of each, is chosen by
// A* in the production model (modules/lab/production.js) for this paper's situation. Each beat is a list of lines;
// every line is one spoken sentence with the one animation cue it triggers, so picture and voice stay aligned.
// The paper's statements are reported as the paper's, never as a person's.
const Prod = require("../lab/production");
const clip = (s, n) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"; };
const slugOf = (a) => (a.id ? `arxiv-${a.id}` : String(a.title || "paper").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)) || "paper";
const num = (s) => { const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
const say = (s) => String(s).replace(/\bWe\b/g, "The authors").replace(/\bwe\b/g, "the authors").replace(/\bOur\b/g, "Their").replace(/\bour\b/g, "their").replace(/\bus\b/g, "them");
const sentence = (s) => { s = String(s).replace(/\s+/g, " ").trim().replace(/[…]+$/, ""); return /[.?!]$/.test(s) ? s : `${s}.`; };
const shortTitle = (t) => clip(String(t).split(/:\s/)[0], 60);
const VERB = { compares: "compare", ablates: "ablate", reports: "report", tests: "test", evaluates: "evaluate", checks: "check", releases: "release", states: "state", uses: "use" };
// How each check is said aloud (the written labels carry parentheses that read badly).
const SPOKEN = { baselines: ["compares against baselines", "compare against a baseline"], ablation: ["tests its parts one at a time", "test its parts one at a time"], variance: ["reports how much results vary between runs", "report how much results vary between runs"], significance: ["uses a statistical test", "use a statistical test"], heldout: ["tests on held-out data", "test on held-out data"], contamination: ["checks for test-set leakage", "check for test-set leakage"], code: ["releases its code", "release its code"], limitations: ["states its limitations", "state its limitations"], compute: ["reports its compute", "report its compute"], theory: ["proves a bound", "prove a bound"], "independent-benchmark": ["uses benchmarks it didn't build", "use benchmarks it didn't build"] };
const andList = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const neg = (label) => label.toLowerCase().replace(/^(compares|ablates|reports|tests|evaluates|checks|releases|states|uses)/, (v) => VERB[v]);
const LEVEL_SAY = { backed: "The body backs it with a result.", described: "The method section describes it, but that's a description, not a result.", "partly backed": "The body only partly backs it.", "not found in the body": "We couldn't find a result for it in the body." };

// Mechanism: up to four short steps from the method section.
function steps(a, doc) {
  const sec = doc.sections.find((s) => s.kind === "method") || doc.sections.find((s) => s.kind === "theory");
  if (!sec) return [];
  const { sentences } = require("../review/review");
  const out = [];
  for (const x of sentences(sec.text).filter((y) => y.length > 20 && !/^(theorem|lemma|proposition|corollary|figure|table)\b/i.test(y))) {
    for (let part of x.replace(/[.;:]+$/, "").split(/,? and (?=(?:then |also )?[a-z]+s\b)/)) {
      part = part.split(/,\s*(?:where|which|so that|while|because)\b| where | when /)[0].replace(/^(each round|in each round|first|then|next|finally|at each step),?\s*/i, "").trim();
      if (part.length < 12) continue;
      if (/^[a-z]+s\b/.test(part)) part = `It ${part}`;
      out.push(clip(part[0].toUpperCase() + part.slice(1), 64).replace(/…$/, ""));
      if (out.length === 4) return out;
    }
  }
  return out;
}
// The first table with a label column and a numeric column becomes bars.
function bars(doc) {
  for (const t of doc.tables) {
    if (t.rows.length < 3) continue;
    const head = t.rows[0], rows = t.rows.slice(1);
    for (let c = 1; c < head.length; c++) {
      const vals = rows.map((r) => num(r[c]));
      if (vals.every((v) => v !== null) && new Set(vals).size > 1) return { table: t.n, caption: clip(t.caption, 90), metric: head[c] || `column ${c + 1}`, unit: /%/.test(rows.map((r) => r[c]).join("")) ? "%" : "", bars: rows.slice(0, 5).map((r, i) => ({ label: /^(ours|our method|ours \(.*\))$/i.test(r[0].trim()) ? "Paper's method" : clip(r[0], 16), value: vals[i] })) };
    }
  }
  return null;
}

// One beat per chosen variant. lines[i].cue is the index of the animation the sentence triggers (see video.js).
function beatFor(v, a, doc, ctx) {
  const { mech, chart, example, headline, met, missed } = ctx;
  switch (v.variant) {
    case "title-card": return { visual: { kind: "title", title: shortTitle(a.title), sub: a.read.fullText ? `read in full · ${a.read.sections.length} sections · ${a.read.tables} tables` : "abstract only" }, lines: [{ text: sentence(shortTitle(a.title)), cue: 0 }, { text: a.read.fullText ? "We read the whole paper, not just the abstract. Here's what holds up." : "We could only read the abstract, so treat this as a first look.", cue: 1 }] };
    case "question-hook": return { visual: { kind: "title", title: shortTitle(a.title), sub: "Does the main claim hold up?" }, lines: [{ text: sentence(shortTitle(a.title)), cue: 0 }, { text: "Does its main claim hold up?", cue: 1, pause: 0.4 }, { text: a.read.fullText ? "We read the whole paper to find out." : "We only had the abstract, so this is a first look.", cue: null }] };
    case "one-claim": return { visual: { kind: "claims", mode: "one", items: [{ text: clip(say(headline.text), 170), level: headline.level }] }, lines: [{ text: "Here's the headline claim.", cue: null }, { text: sentence(say(clip(headline.text, 160))), cue: 0 }, { text: LEVEL_SAY[headline.level], cue: 1 }] };
    case "claim-chips": case "claim-paragraphs": { const top = a.contributions.slice(0, 3); return { visual: { kind: "claims", mode: v.variant === "claim-chips" ? "chips" : "list", items: top.map((c) => ({ text: clip(say(c.text), v.variant === "claim-chips" ? 48 : 90), level: c.level })) }, lines: [{ text: `The paper makes ${a.contributions.length === 1 ? "one claim" : `${a.contributions.length} claims`}. Here ${top.length === 1 ? "it is" : `are the first ${top.length}`}.`, cue: null }, ...top.map((c, i) => ({ text: `${sentence(say(clip(c.text, 120)))} ${LEVEL_SAY[c.level]}`, cue: i }))] }; }
    case "flow-diagram": case "text-steps": return { visual: { kind: "flow", mode: v.variant === "text-steps" ? "text" : "diagram", steps: mech }, lines: [{ text: "Here's how it works.", cue: null }, ...mech.map((s, i) => ({ text: sentence(s), cue: i })), { text: "That's the whole loop.", cue: mech.length }] };
    case "bars": return { visual: { kind: "bars", ...chart }, lines: [{ text: `Table ${chart.table} of the paper compares ${chart.metric.toLowerCase()}.`, cue: null }, { text: chart.bars.map((b) => `${b.label}: ${b.value}${chart.unit}`).join(". ") + ".", cue: 0 }, { text: "Those are the paper's numbers. We haven't rerun them.", cue: 1 }] };
    case "quote-card": { const r = a.results[0]; return { visual: { kind: "quote", text: clip(say(r.text), 150), section: r.section }, lines: [{ text: "The strongest result the paper reports:", cue: null }, { text: sentence(say(clip(r.text, 180))), cue: 0 }, { text: `That's from ${r.section.replace(/^\d+\s*/, "the ")} section, in the paper's own words.`, cue: 1 }] }; }
    case "top-checks": case "full-checklist": { const items = v.variant === "top-checks" ? [...met.slice(0, 3), ...missed.slice(0, 3)] : a.checklist; return { visual: { kind: "checklist", mode: v.variant === "top-checks" ? "top" : "full", items: items.map((c) => ({ label: c.label, met: c.met, points: c.points })), score: a.rigor }, lines: [{ text: "So how careful is the work?", cue: null }, { text: met.length ? `It ${andList(met.slice(0, 3).map((c) => (SPOKEN[c.id] || [c.label.toLowerCase()])[0]))}.` : "It meets none of our checks.", cue: 0 }, ...(missed.length ? [{ text: `But it doesn't ${missed.slice(0, 2).map((c) => (SPOKEN[c.id] || [null, neg(c.label)])[1]).join(", or ")}.`, cue: 1 }] : []), { text: `That's ${a.rigor} out of 100 on our rigor scale.`, cue: 2 }] }; }
    case "score-gauge": return { visual: { kind: "checklist", mode: "gauge", items: [], score: a.rigor }, lines: [{ text: `On our full-text rigor scale, it scores ${a.rigor} out of 100.`, cue: 2 }] };
    case "curve-trace": return { visual: { kind: "curve", title: clip(example.title, 56), series: example.series.slice(0, 2).map((s) => ({ name: s.name, points: s.points.slice(0, 200) })), verdict: example.verdict ? (example.verdict.supported ? "supported at toy scale" : "not supported at toy scale") : "result at toy scale" }, lines: [{ text: "We also tested the idea ourselves, in a small toy.", cue: null }, { text: example.verdict ? sentence(example.verdict.text.replace(/^(Supported|Not supported) at toy scale: /, "")) : "Here's how it played out.", cue: 0 }, { text: `${example.verdict && example.verdict.supported ? "Our hypothesis held" : "Our hypothesis didn't hold"}, at toy scale. That checks the logic, not the paper's numbers.`, cue: 1 }] };
    case "three-questions": case "one-question": { const qs = a.questions.slice(0, v.variant === "one-question" ? 1 : 3).map((q) => q.text.split("?")[0] + "?"); return { visual: { kind: "questions", items: qs.map((q) => clip(q, 70)) }, lines: [{ text: qs.length > 1 ? "What's still open?" : "One thing is still open.", cue: null }, ...qs.map((q, i) => ({ text: q, cue: i, pause: 0.6 }))] }; } // a question gets a beat to land (learning L2)
    case "source-card": return { visual: { kind: "sources", items: [a.url || a.title, example ? `Our toy check: ${example.title}` : null].filter(Boolean) }, lines: [{ text: "That's our reading of the text, not a peer review. The paper and every check are linked below.", cue: 0 }] };
    default: return null;
  }
}

function plan(a, doc, { example = null, maxSeconds = 90 } = {}) {
  const backed = a.contributions.filter((c) => c.level === "backed").length;
  const met = a.checklist.filter((c) => c.met), missed = a.checklist.filter((c) => !c.met);
  const mech = steps(a, doc), chart = bars(doc);
  const headline = a.contributions.find((c) => c.level === "backed" && c.numbers.length) || a.contributions.find((c) => c.level === "backed") || a.contributions[0] || { text: a.title, level: "not found in the body", numbers: [] };
  // The situation decides what can be shown; A* decides what should be.
  const sit = Prod.situationOf({ strength: a.strength, table: !!chart, toy: !!(example && example.series && example.series.length), mechanism: mech.length >= 2, results: a.results.length > 0, questions: a.questions.length > 0 });
  const search = Prod.astar({ situation: sit, maxSeconds });
  const ctx = { mech, chart, example, headline, met, missed };
  const beats = [];
  for (const s of search.plan || []) {
    if (!s.variant) continue;
    const b = beatFor(s, a, doc, ctx); if (!b) continue;
    const narration = b.lines.map((l) => l.text).join(" ");
    beats.push({ id: s.unit, variant: s.variant, goal: GOALS[s.unit], visual: b.visual, lines: b.lines, narration, seconds: Math.max(3, Math.round(narration.split(/\s+/).length / 2.6 + 0.6 * b.lines.length)) });
  }
  const thesis = `${clip(a.title, 90)}: ${backed} of ${a.contributions.length} stated contributions have a matching result in the body, and the work meets ${met.length} of ${a.checklist.length} rigor checks (${a.rigor}/100, ${a.strength}).`;
  const acceptance = [
    { id: "cites", rule: "Every number in the narration appears in the paper's text or tables, or in our Lab check." },
    { id: "no-people", rule: "No claim, quote or forecast is attributed to a named person; the paper's statements are the paper's." },
    { id: "length", rule: "The video runs under 3 minutes." },
    { id: "aligned", rule: "Every animation cue belongs to the sentence that describes it." },
    { id: "labels", rule: "The paper's own numbers are labelled as the paper's; toy results are labelled toy scale." },
    { id: "posts", rule: "Every short post fits its network's limit with the link; there is no Twitter/X version." },
    { id: "person", rule: "A person reviews and publishes; nothing is posted automatically." },
  ];
  return { slug: slugOf(a), title: a.title, url: a.url, audience: "Curious readers and students: no maths beyond school, no jargon left unexplained.", thesis, beats, acceptance,
    search: { situation: sit, chosen: (search.plan || []).map((s) => s.variant || `skip ${s.unit}`), modelValue: search.value, modelStay: search.stay, expanded: search.expanded, note: "Chosen by A* in a synthetic viewer model (modules/lab/production.js); a simulation, not audience data." },
    budget: { targetSeconds: beats.reduce((n, b) => n + b.seconds, 0), cost: "$0: Manim Community on a CPU, narrated by a local neural voice (Kokoro) when installed" } };
}
const GOALS = { hook: "Say what the paper is and pose the question the video answers.", claims: "State what it claims and how well the body backs it.", mechanism: "Show how it works, one step per sentence.", evidence: "Show the paper's own numbers, labelled as the paper's.", rigor: "Say how careful the work is, ending on the score.", toy: "Show our own toy check and say it's toy scale.", open: "Name what's still open.", close: "Say where to read it and that this is our reading, not a review." };

function check(p, a, { example = null } = {}) {
  const sources = [a.title, a.abstract || "", ...a.contributions.map((c) => c.text), ...a.results.map((r) => r.text), ...a.tables.map((t) => `${t.text} ${t.numbers.join(" ")}`), JSON.stringify(a.checklist), JSON.stringify(a.read), String(a.rigor), "out of 100", example ? JSON.stringify(example) : ""].join(" ");
  const nums = [...new Set(p.beats.flatMap((b) => (b.narration.match(/\d+(?:\.\d+)?/g) || [])))];
  const unsupported = nums.filter((n) => !sources.includes(n) && Number(n) > 10);
  const total = p.beats.reduce((n, b) => n + b.seconds, 0);
  const ppl = require("../../lib/ontology.json").people || [];
  const named = ppl.filter((x) => p.beats.some((b) => b.narration.includes(x.label || x.name || "\u0000")));
  const cueCount = { title: 2, claims: (v) => (v.mode === "one" ? 2 : v.items.length), flow: (v) => v.steps.length + 1, bars: 2, quote: 2, checklist: 3, curve: 2, questions: (v) => v.items.length, sources: 1 };
  const badCue = p.beats.filter((b) => { const n = typeof cueCount[b.visual.kind] === "function" ? cueCount[b.visual.kind](b.visual) : cueCount[b.visual.kind]; return b.lines.some((l) => l.cue !== null && (l.cue < 0 || l.cue >= n)); });
  return [
    { id: "cites", ok: !unsupported.length, why: unsupported.length ? `numbers not found in the paper or our check: ${unsupported.join(", ")}` : `${nums.length} numbers, all traced` },
    { id: "no-people", ok: !named.length, why: named.length ? `names a watched person: ${named.map((x) => x.label || x.name).join(", ")}` : "no watched person named" },
    { id: "length", ok: total < 180, why: `${total} s planned` },
    { id: "aligned", ok: !badCue.length, why: badCue.length ? `cues out of range in: ${badCue.map((b) => b.id).join(", ")}` : `${p.beats.reduce((n, b) => n + b.lines.filter((l) => l.cue !== null).length, 0)} cues, each on its own sentence` },
  ];
}

module.exports = { plan, check, steps, bars, clip, slugOf };
