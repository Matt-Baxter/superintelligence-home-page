// The written response (REQ-058, proposed): an article that walks the analysis with numbered references, and short
// posts for each network. Rule-written from the analysis; the paper's statements are the paper's, no person is
// quoted or credited with a claim, and a person edits and publishes. No Twitter/X version.
const { channels } = require("../editorial/content");
const { clip } = require("./plan");
const LEVEL = { backed: "backed by a result in the body", described: "described in the method", "partly backed": "partly backed", "not found in the body": "not found in the body we could read" };
const say = (s) => String(s).replace(/\bwe\b/g, "the authors").replace(/\bWe\b/g, "The authors").replace(/\bour\b/g, "their").replace(/\bOur\b/g, "Their");

function article(a, p, { example = null, site = "" } = {}) {
  const refs = [`[${a.title}](${a.url || "#"}): the paper${a.read.fullText ? `, read in full from its ${a.read.source === "html" ? "HTML rendering" : a.read.source === "pdf" ? "PDF" : "text"}` : ", abstract only"}.`];
  if (example) refs.push(`Our toy check, “${example.title}”${site ? ` (${site}/m/lab#${example.id})` : ""}: deterministic, synthetic data, toy scale.`);
  const L = [];
  L.push(`# ${a.title}: what it claims, what backs it, what's open`, "", `**In one line:** ${p.thesis}`, "",
    `*This is our reading of the paper's text [1], made by published rules and checked by a person before it goes out. It is not a peer review; the paper's numbers are the paper's, and we say so where we use them.*`, "");
  L.push("## What it claims", "");
  for (const c of a.contributions) L.push(`- ${say(c.text)} (${c.section}) — **${LEVEL[c.level]}**${c.evidence[0] ? `: “${clip(say(c.evidence[0].text), 220)}” (${c.evidence[0].section})` : ""} [1]`);
  const steps = p.beats.find((b) => b.id === "mechanism");
  if (steps) L.push("", "## How it works", "", ...steps.visual.steps.map((s, i) => `${i + 1}. ${say(s)}`), "", "Steps are taken from the paper's method section [1].");
  L.push("", "## What the evidence shows", "");
  const ev = p.beats.find((b) => b.id === "evidence");
  if (ev && ev.visual.kind === "bars") L.push(`The paper's table ${ev.visual.table} (“${ev.visual.caption}”) reports ${ev.visual.metric.toLowerCase()}: ${ev.visual.bars.map((b) => `${b.label} ${b.value}${ev.visual.unit}`).join(", ")} [1]. We haven't rerun these numbers.`, "");
  for (const r of a.results.slice(0, 5)) L.push(`- “${clip(say(r.text), 260)}” (${r.section})${r.hedged ? " — hedged in the paper's own words" : ""} [1]`);
  if (!a.results.length) L.push("We found no result sentences with numbers in the text we could read.");
  if (a.abstractNumbers.length) {
    const found = a.abstractNumbers.filter((n) => n.inBody);
    L.push("", `**Do the abstract's numbers hold up?** ${found.length} of ${a.abstractNumbers.length} numbers in the abstract appear again in the body or tables${found.length < a.abstractNumbers.length ? `; not found: ${a.abstractNumbers.filter((n) => !n.inBody).map((n) => n.number).join(", ")}` : ""} [1].`);
  }
  L.push("", "## How careful is it", "", `Full-text rigor: **${a.rigor}/100** (${a.strength}). Each check, the points it earns and where we found it:`, "", "| Check | Points | Where |", "| --- | --- | --- |");
  for (const c of a.checklist) L.push(`| ${c.met ? "✓" : "✗"} ${c.label} | ${c.earned}/${c.points} | ${c.evidence ? c.evidence.replace(/\|/g, "/").slice(0, 160) : "not found"} |`);
  for (const pen of a.penalties) L.push(`| ✗ ${pen.label} | ${pen.points} | ${pen.why} |`);
  if (a.benchmarks.length) L.push("", `Benchmarks named: ${a.benchmarks.join(", ")}${a.ownBenchmark ? " (the paper also introduces its own)" : ""}.`);
  if (a.limitations.length) L.push("", "## What it says it can't do", "", ...a.limitations.slice(0, 4).map((x) => `- “${clip(say(x.text), 240)}” (${x.section}) [1]`));
  if (example) L.push("", "## What we checked ourselves", "", `We built a small deterministic toy of the core idea: ${example.idea || example.title}. ${example.verdict ? `${example.verdict.text}` : ""} This checks the logic at toy scale, not the paper's results [2].`);
  if (a.questions.length) L.push("", "## Still open", "", ...a.questions.map((q) => `- ${q.text}`));
  L.push("", "## How we read it", "", `${a.summary} The reader pulls sections, tables and links from the paper's own text; the checks are published rules that look for each item in the body and quote where they found it. Claims are matched to results by shared words and numbers, so a match is a pointer for a person to verify, not proof.`,
    "", "## References", "", ...refs.map((r, i) => `${i + 1}. ${r}`), "", "---", "Draft for a person to check and publish. Nothing is posted automatically.");
  return L.join("\n") + "\n";
}

function posts(a, p, link = "") {
  const backed = a.contributions.filter((c) => c.level === "backed").length;
  const summary = `${backed} of ${a.contributions.length} claims backed in the body; rigor ${a.rigor}/100.`;
  const top = a.questions[0] ? ` Open: ${a.questions[0].text.split("?")[0]}?` : "";
  const post = { title: a.title, summary, body: `${p.thesis}${top}\n\nOur reading of the text, not a peer review.` };
  const out = channels(post, link || a.url || "").social.map((c) => ({ channel: c.label, limit: c.limit, length: c.length, text: c.text }));
  out.push({ channel: "Substack note", limit: null, length: null, text: `${p.thesis}${top} ${link || a.url || ""}`.trim() });
  return out;
}

module.exports = { article, posts };
