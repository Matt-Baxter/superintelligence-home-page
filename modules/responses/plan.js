// The response plan (REQ-058, proposed): before anything is drawn or written, each paper gets a short spec for the
// piece - who it's for, the one-line thesis, the beats (goal, narration, visual, seconds) and the acceptance checks the
// finished video, article and posts must pass. Everything in it comes from the analysis (analysis.js) and our own Lab
// check; the paper's statements are reported as the paper's ("the paper reports"), never as a person's.
const LEVEL_WORD = { backed: "backed by a result", described: "described in the method", "partly backed": "partly backed", "not found in the body": "not found in the body" };
const clip = (s, n) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"; };
const slugOf = (a) => (a.id ? `arxiv-${a.id}` : String(a.title || "paper").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)) || "paper";
const num = (s) => { const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
const say = (s) => String(s).replace(/\bWe\b/g, "The authors").replace(/\bwe\b/g, "the authors").replace(/\bOur\b/g, "Their").replace(/\bour\b/g, "their").replace(/\bus\b/g, "them");

// Mechanism: up to four short steps from the method section's first sentences.
function steps(a, doc) {
  const sec = doc.sections.find((s) => s.kind === "method") || doc.sections.find((s) => s.kind === "theory");
  if (!sec) return [];
  const { sentences } = require("../review/review");
  const out = [];
  for (const x of sentences(sec.text).filter((y) => y.length > 20 && !/^(theorem|lemma|proposition|corollary|figure|table)\b/i.test(y))) {
    // One sentence may hold two steps ("computes X and accepts Y"); trailing clauses (", where ...") are detail.
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
      if (vals.every((v) => v !== null) && new Set(vals).size > 1) return { table: t.n, caption: clip(t.caption, 90), metric: head[c] || `column ${c + 1}`, unit: /%/.test(rows.map((r) => r[c]).join("")) ? "%" : "", bars: rows.slice(0, 6).map((r, i) => ({ label: clip(r[0], 18), value: vals[i] })) };
    }
  }
  return null;
}

function plan(a, doc, { example = null } = {}) {
  const top = a.contributions.slice(0, 3), backed = a.contributions.filter((c) => c.level === "backed").length;
  const met = a.checklist.filter((c) => c.met), missed = a.checklist.filter((c) => !c.met);
  const mech = steps(a, doc), chart = bars(doc);
  const thesis = `${clip(a.title, 90)}: ${backed} of ${a.contributions.length} stated contributions have a matching result in the body, and the work meets ${met.length} of ${a.checklist.length} rigor checks (${a.rigor}/100, ${a.strength}).`;
  const beats = [];
  const add = (id, goal, narration, visual, min = 5) => beats.push({ id, goal, narration: narration.replace(/\s+/g, " ").trim(), visual, seconds: Math.max(min, Math.round(narration.split(/\s+/).length / 2.6)) });
  add("hook", "Say what the paper is about and why it matters, in one breath.", `${a.title}. ${a.read.fullText ? "We read the whole paper" : "We could only read the abstract"}, and here is what it claims, what backs it, and what is still open.`, { kind: "title", title: clip(a.title, 70), sub: a.read.fullText ? `read in full: ${a.read.sections.length} sections, ${a.read.tables} tables` : "abstract only" }, 4);
  add("claims", "Lay out what it claims, each marked by how well the body backs it.", `The paper makes ${a.contributions.length === 1 ? "one main claim" : `${a.contributions.length} claims${a.contributions.length > top.length ? `; here are the first ${top.length}` : ""}`}. ${top.map((c) => `${say(clip(c.text, 110).replace(/[.…]+$/, ""))}: ${LEVEL_WORD[c.level]}.`).join(" ")}`, { kind: "claims", items: top.map((c) => ({ text: clip(say(c.text), 70), level: c.level })) });
  if (mech.length >= 2) add("mechanism", "Show how it works as a flow, step by step.", `How it works, in ${mech.length} steps: ${mech.map((s, i) => `${i + 1}: ${s}.`).join(" ")}`, { kind: "flow", steps: mech });
  if (chart) add("evidence", "Show the paper's own headline numbers, labelled as the paper's.", `The paper reports, in table ${chart.table}, ${chart.metric.toLowerCase()}: ${chart.bars.map((b) => `${b.label} at ${b.value}${chart.unit}`).join(", ")}. These are the paper's numbers; we haven't rerun them.`, { kind: "bars", ...chart });
  else if (a.results.length) add("evidence", "Quote the paper's strongest result sentence, labelled as the paper's.", `The paper reports: ${say(clip(a.results[0].text, 220))}`, { kind: "quote", text: clip(say(a.results[0].text), 160), section: a.results[0].section });
  add("rigor", "Walk through how careful the work is, check by check, ending on the score.", `How careful is it? It ${met.slice(0, 4).map((c) => c.label.toLowerCase()).join(", ") || "meets none of our checks"}${missed.length ? `. It doesn't ${missed.slice(0, 3).map((c) => c.label.toLowerCase().replace(/^(compares|ablates|reports|tests|evaluates|checks|releases|states|uses)/, (v) => ({ compares: "compare", ablates: "ablate", reports: "report", tests: "test", evaluates: "evaluate", checks: "check", releases: "release", states: "state", uses: "use" }[v]))).join(", or ")}` : ""}. That's ${a.rigor} out of 100 on our full-text rigor scale.`, { kind: "checklist", items: a.checklist.map((c) => ({ label: c.label, met: c.met, points: c.points })), score: a.rigor });
  if (example && example.series) add("ourcheck", "Show our own toy check as a curve, with its verdict, and say it's toy scale.", `We tested the idea ourselves in a small toy. ${example.verdict ? example.verdict.text : ""} That's a check of the logic at toy scale, not of the paper's numbers.`, { kind: "curve", title: clip(example.title, 60), series: example.series.slice(0, 2).map((s) => ({ name: s.name, points: s.points.slice(0, 200) })), verdict: example.verdict ? (example.verdict.supported ? "supported at toy scale" : "not supported at toy scale") : "" });
  if (a.questions.length) add("open", "Name what's still open, as questions.", `What's still open: ${a.questions.slice(0, 3).map((q) => q.text.split("?")[0] + "?").join(" ")}`, { kind: "questions", items: a.questions.slice(0, 3).map((q) => clip(q.text.split("?")[0] + "?", 80)) });
  add("close", "Say where to read it and that the analysis is ours, from the text.", `That's our reading of the paper's text, not a peer review. The paper and every check are linked below.`, { kind: "sources", items: [a.url || a.title, example ? `Our toy check: ${example.title}` : null].filter(Boolean) }, 4);

  const acceptance = [
    { id: "cites", rule: "Every number in the narration appears in the paper's text or tables, or in our Lab check." },
    { id: "no-people", rule: "No claim, quote or forecast is attributed to a named person; the paper's statements are the paper's." },
    { id: "length", rule: "The video runs under 3 minutes." },
    { id: "labels", rule: "The paper's own numbers are labelled as the paper's; toy results are labelled toy scale." },
    { id: "posts", rule: "Every short post fits its network's limit with the link; there is no Twitter/X version." },
    { id: "person", rule: "A person reviews and publishes; nothing is posted automatically." },
  ];
  return { slug: slugOf(a), title: a.title, url: a.url, audience: "Curious readers and students: no maths beyond school, no jargon left unexplained.", thesis, beats, acceptance,
    budget: { targetSeconds: beats.reduce((n, b) => n + b.seconds, 0), cost: "$0: rendered on a CPU with Manim Community, narrated by a local text-to-speech voice (or captions only)" } };
}

// Check a finished plan against its own acceptance rules (the parts a machine can check).
function check(p, a, { example = null } = {}) {
  const sources = [a.title, a.abstract || "", ...a.contributions.map((c) => c.text), ...a.results.map((r) => r.text), ...a.tables.map((t) => `${t.text} ${t.numbers.join(" ")}`), JSON.stringify(a.checklist), JSON.stringify(a.read), String(a.rigor), "out of 100", example ? JSON.stringify(example) : ""].join(" ");
  const nums = [...new Set(p.beats.flatMap((b) => (b.narration.match(/\d+(?:\.\d+)?/g) || [])))];
  const unsupported = nums.filter((n) => !sources.includes(n) && Number(n) > 10);
  const total = p.beats.reduce((n, b) => n + b.seconds, 0);
  const ppl = require("../../lib/ontology.json").people || [];
  const named = ppl.filter((x) => p.beats.some((b) => b.narration.includes(x.label || x.name || "\u0000")));
  return [
    { id: "cites", ok: !unsupported.length, why: unsupported.length ? `numbers not found in the paper or our check: ${unsupported.join(", ")}` : `${nums.length} numbers, all traced` },
    { id: "no-people", ok: !named.length, why: named.length ? `names a watched person: ${named.map((x) => x.label || x.name).join(", ")}` : "no watched person named" },
    { id: "length", ok: total < 180, why: `${total} s planned` },
  ];
}

module.exports = { plan, check, steps, bars, clip, slugOf };
