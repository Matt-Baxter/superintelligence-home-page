#!/usr/bin/env node
// The advisor's review: a bigger model reads the label-free quality checks and the cases where the efficient models
// disagreed, and proposes synthetic benchmark items and rule ideas. It changes nothing: it writes out/advice/<date>.md
// and .json for John and Matt, who add an item to bench/review-set.json only if they agree (then the rule change
// must show as uplift). Without ADVISOR_MODEL it writes the prompt it would send, so a person can paste it into any
// bigger model by hand.
//   ADVISOR_MODEL=groq:openai/gpt-oss-120b node scripts/advise.js      same DATABASE_URL / DATA_DIR as the server
const fs = require("node:fs"), path = require("node:path");

function prompt(checks, cases) {
  const failing = checks.filter((c) => !c.ok).map((c) => `- ${c.label}: ${c.value} (${c.why})`).join("\n") || "- none";
  const disagreements = cases.slice(0, 8).map((c) => `- "${c.title}": ${c.judges.map((j) => `${j.id} ${j.credibility}`).join(", ")}${c.advice ? `; advisor: ${c.advice}` : ""}`).join("\n") || "- none";
  return [
    { role: "system", content: "You advise two students on a rule-based judge of AI-progress papers and articles. Propose at most 3 synthetic test items that would expose a weakness, and at most 3 rule ideas. Items must be invented, clearly labelled test data, about no real person or organisation, and short. Reply with JSON only." },
    { role: "user", content: `Quality checks that fail on real reviews:\n${failing}\n\nPieces where the efficient models disagreed:\n${disagreements}\n\nJSON shape: {"items": [{"id": "b-...", "credible": true|false, "kind": "paper"|"article", "title": "Sample: ... (test data)", "text": "...", "why": "the weakness it exposes"}], "ruleIdeas": ["..."]}` },
  ];
}

// Only proposals that keep the project's rules: labelled test data, no URLs to real sites, no named watched people.
function vet(out) {
  const { ontology } = require("../lib/tagger");
  const names = (ontology.people || []).map((p) => p.label.toLowerCase());
  const items = (Array.isArray(out && out.items) ? out.items : []).filter((x) => x && /\(test data\)/i.test(x.title || "") && typeof x.credible === "boolean" && ["paper", "article"].includes(x.kind)
    && String(x.text || "").length >= 40 && !/https?:\/\/(?!github\.com\/sample-)/i.test(x.text) && !names.some((n) => `${x.title} ${x.text}`.toLowerCase().includes(n)))
    .slice(0, 3).map((x) => ({ id: String(x.id || "b-advised").replace(/[^a-z0-9-]/gi, "").slice(0, 40), credible: x.credible, kind: x.kind, title: String(x.title).slice(0, 160), text: String(x.text).slice(0, 1200), why: String(x.why || "").slice(0, 300) }));
  const ruleIdeas = (Array.isArray(out && out.ruleIdeas) ? out.ruleIdeas : []).map(String).filter(Boolean).slice(0, 3).map((x) => x.slice(0, 300));
  return { items, ruleIdeas };
}

async function main() {
  const db = require("../lib/db"), { createKernel } = require("../kernel/kernel"), k = createKernel();
  db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
  const Q = require("./quality"), Panel = require("../modules/review/panel");
  const rows = await db.all("SELECT kind, title, credibility, verdict, result FROM review_docs ORDER BY id DESC LIMIT 500");
  const checks = rows.length ? Q.analyse(rows).checks : [];
  const cases = rows.map((d) => ({ title: d.title, r: JSON.parse(d.result || "{}") })).filter((x) => x.r.panel && x.r.panel.status === "disagreed")
    .map((x) => ({ title: x.title, judges: x.r.panel.judges.map((j) => ({ id: j.id, credibility: j.credibility })), advice: x.r.panel.advice && x.r.panel.advice.advice }));
  const day = new Date().toISOString().slice(0, 10), dir = path.join(__dirname, "..", "out", "advice"); fs.mkdirSync(dir, { recursive: true });
  const msgs = prompt(checks, cases), advisor = Panel.advisorFromEnv();
  let result = { items: [], ruleIdeas: [] }, note = "";
  if (!advisor) note = `No ADVISOR_MODEL set (for example ${Panel.DEFAULT_ADVISOR}). The prompt below can be pasted into any bigger model; vet its reply the same way.`;
  else { const raw = await advisor.chat(msgs, { temperature: 0, json: true, max_tokens: 1500 }); const m = String(raw).match(/\{[\s\S]*\}/); result = vet(m ? JSON.parse(m[0]) : {}); note = `Advice from ${advisor.id} (${advisor.model}). Proposals only: add an item to bench/review-set.json if you agree.`; }
  const L = [`# Advisor's review, ${day}`, "", note, "", `Failing quality checks: ${checks.filter((c) => !c.ok).length} of ${checks.length}. Disagreements reviewed: ${cases.length}.`, ""];
  if (result.items.length) { L.push("## Proposed benchmark items", ""); for (const x of result.items) L.push(`- **${x.title}** (${x.kind}, ${x.credible ? "credible" : "not credible"}): ${x.why}`); L.push(""); }
  if (result.ruleIdeas.length) { L.push("## Rule ideas to test", ""); for (const r of result.ruleIdeas) L.push(`- ${r}`); L.push(""); }
  if (!advisor) L.push("## Prompt", "", "```", msgs.map((m) => `[${m.role}]\n${m.content}`).join("\n\n"), "```", "");
  fs.writeFileSync(path.join(dir, `${day}.md`), L.join("\n")); fs.writeFileSync(path.join(dir, `${day}.json`), JSON.stringify({ day, advisor: advisor ? advisor.id : null, ...result }, null, 2));
  console.log(L.join("\n"));
}
module.exports = { prompt, vet };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error("advise:", e.message); process.exit(1); });
