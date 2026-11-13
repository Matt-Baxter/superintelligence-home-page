#!/usr/bin/env node
// Evidence for the two-model panel (REQ-055 proposed, REQ-029): run each model in PANEL_MODELS on every labelled
// synthetic piece (bench/review-set.json and bench/domains-*.json) through the same path the paper watch uses
// (masking, rubric order, prestige and wording counterfactuals, quote verification), and report per model:
//   - how often its verdict matches the label, and its credibility AUC (does it rank credible pieces higher?)
//   - prestige sensitivity: how far "this appeared in a top journal" versus "an anonymous blog" moves its credibility
//   - wording sensitivity: how far hype words moved it, and how often it was set aside for either
//   - agreement with the other models and with the rules judge (Cohen's kappa)
// It writes out/evidence/panel-<date>.json and .md for John and Matt. It changes nothing.
//
//   PANEL_MODELS=groq:llama-3.1-8b-instant,ollama:gemma3:12b npm run evidence:panel     real models (free tiers)
//   npm run evidence:panel -- --stand-in                                                 two deterministic stand-ins
//   npm run evidence:panel -- --limit 20 --sleep 2000                                    fewer pieces, slower (rate limits)
//
// The stand-ins are not evidence about any model: one reads the rules judge's own numbers back (fair), the other adds
// 25 points when told the piece is from a top journal (biased). They show the harness tells the two apart.
const fs = require("node:fs"), path = require("node:path");
const R = require("../modules/review/review"), P = require("../modules/review/panel"), A = require("../modules/review/agreement");
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const root = path.join(__dirname, ".."), bench = (f) => JSON.parse(fs.readFileSync(path.join(root, "bench", f), "utf8")).items;

const ITEMS = [...bench("review-set.json").map((i) => ({ ...i, domain: "ai" })), ...["set", "holdout", "overreach"].flatMap((s) => bench(`domains-${s}.json`))];

// ---------- stand-in models (deterministic; for checking the harness, never for conclusions) ----------
function standIn(id, bias) {
  const C = R.CRITERIA.rigor.checks;
  return { id, model: id, async chat(messages) {
    const user = messages[messages.length - 1].content;
    const text = (user.match(/"""\n([\s\S]*?)\n"""/) || [, user])[1];
    const r = R.review({ title: "", text }), why = r.judges[1].why, sents = text.split(/(?<=[.!?])\s+/).filter((x) => x.length > 20);
    // Fair: claims exactly the checks the rules find, quoting the sentence that shows each, and the rules' hype.
    const checks = Object.fromEntries(C.map((c) => { const w = why.find((x) => x.factor === c.label); return [c.id, w ? { met: true, quote: w.detail } : { met: false }]; }));
    // Biased: told the piece is from a top journal, it claims every check, quoting a real but irrelevant sentence (which
    // passes quote verification), and calls it hype-free. This is the bias the prestige counterfactual has to catch.
    if (bias && /top peer-reviewed journal/.test(user) && sents.length) return JSON.stringify({ checks: Object.fromEntries(C.map((c) => [c.id, { met: true, quote: sents[0] }])), hype: 0, credibility: 99, reason: "stand-in" });
    return JSON.stringify({ checks, hype: r.judges[2].score, credibility: r.credibility, reason: "stand-in" });
  } };
}

const bad = (v) => ["doubtful", "withdrawn"].includes(v);
function auc(rows) { const g = rows.filter((x) => x.it.credible), b = rows.filter((x) => !x.it.credible); if (!g.length || !b.length) return null; let s = 0; for (const x of g) for (const y of b) s += x.c > y.c ? 1 : x.c === y.c ? 0.5 : 0; return Math.round((s / (g.length * b.length)) * 1000) / 1000; }
const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

async function main() {
  const models = args.includes("--stand-in") ? (args.includes("--both-fair") ? [standIn("stand-in-fair-a", false), standIn("stand-in-fair-b", false)] : [standIn("stand-in-fair", false), standIn("stand-in-prestige-biased", true)]) : P.modelsFromEnv();
  if (!models.length) {
    console.log("No models: set PANEL_MODELS (e.g. groq:llama-3.1-8b-instant,ollama:gemma3:12b; free tiers) or run with --stand-in to check the harness.");
    process.exit(0);
  }
  const limit = Number(arg("--limit", ITEMS.length)), sleep = Number(arg("--sleep", 0)), items = ITEMS.slice(0, limit);
  const rules = items.map((it) => ({ it, r: R.review(it) }));
  const per = {};
  for (const m of models) {
    per[m.id] = [];
    for (const { it, r } of rules) {
      try {
        const j = await P.judgeWith(m, `${it.title}\n\n${it.text}`);
        per[m.id].push({ it, c: j.credibility, verdict: P.panel ? (A.judgeLabel(R.VERDICTS.find((v) => v.when(r.score, j.credibility)).id)) : null, prestige: j.sensitivity.prestige, wording: j.sensitivity.wording, biased: j.biased, dropped: j.quotesDropped });
      } catch (e) { per[m.id].push({ it, error: String(e.message).slice(0, 160) }); }
      if (sleep) await new Promise((res) => setTimeout(res, sleep));
    }
  }
  // The panel's final decision (models, rules judge, hard stops and escalation): what actually gets stored.
  const final = [];
  for (const { it, r } of rules) {
    try { const pr = await P.panel({ text: `${it.title}\n\n${it.text}`, rules: r, models }); final.push({ it, verdict: pr.verdict, status: pr.status, person: pr.needsPerson || r.needsPerson }); }
    catch (e) { final.push({ it, error: String(e.message).slice(0, 160) }); }
  }
  const fOk = final.filter((x) => !x.error), wrongFinal = fOk.filter((x) => bad(x.verdict) === x.it.credible);
  const panelFinal = { verdictAccuracy: fOk.length ? Math.round(((fOk.length - wrongFinal.length) / fOk.length) * 1000) / 1000 : null,
    wrongButSentToPerson: wrongFinal.filter((x) => x.person).length, wrongUnflagged: wrongFinal.filter((x) => !x.person).map((x) => x.it.id),
    status: Object.fromEntries([...new Set(fOk.map((x) => x.status))].map((st) => [st, fOk.filter((x) => x.status === st).length])), sentToPerson: fOk.filter((x) => x.person).length };
  const rulesRows = rules.map(({ it, r }) => ({ it, c: r.credibility, verdict: A.judgeLabel(r.verdict) }));
  const summary = (rows) => { const ok = rows.filter((x) => !x.error); return {
    pieces: rows.length, errors: rows.length - ok.length,
    verdictAccuracy: ok.length ? Math.round((ok.filter((x) => (x.verdict === "no") === !x.it.credible).length / ok.length) * 1000) / 1000 : null,
    credibilityAuc: auc(ok),
    prestige: { mean: mean(ok.map((x) => x.prestige ?? 0)), max: ok.length ? Math.max(...ok.map((x) => x.prestige ?? 0)) : null, overLimit: ok.filter((x) => (x.prestige ?? 0) > P.LIMITS.prestige).length },
    wording: { mean: mean(ok.map((x) => x.wording ?? 0)), max: ok.length ? Math.max(...ok.map((x) => x.wording ?? 0)) : null, overLimit: ok.filter((x) => (x.wording ?? 0) > P.LIMITS.wording).length },
    setAside: ok.filter((x) => x.biased && x.biased.length).length, quotesDropped: ok.reduce((a, x) => a + (x.dropped || 0), 0),
    byDomain: Object.fromEntries([...new Set(ok.map((x) => x.it.domain))].map((d) => { const xs = ok.filter((x) => x.it.domain === d); return [d, Math.round((xs.filter((x) => (x.verdict === "no") === !x.it.credible).length / xs.length) * 100) / 100]; })),
  }; };
  const out = { generated: new Date().toISOString(), standIn: args.includes("--stand-in"), limits: P.LIMITS, pieces: items.length,
    rules: { verdictAccuracy: Math.round((rulesRows.filter((x) => (x.verdict === "no") === !x.it.credible).length / rulesRows.length) * 1000) / 1000, credibilityAuc: auc(rulesRows) },
    models: Object.fromEntries(Object.entries(per).map(([id, rows]) => [id, summary(rows)])), panel: panelFinal, agreement: [] };
  const ids = Object.keys(per), labelOf = (id, it) => (per[id].find((x) => x.it === it) || {}).verdict;
  const pairs = [["rules", null], ...ids.map((i) => [i, i])];
  for (let a = 0; a < pairs.length; a++) for (let b = a + 1; b < pairs.length; b++) {
    const [na, ia] = pairs[a], [nb, ib] = pairs[b];
    const ps = items.map((it) => [ia ? labelOf(ia, it) : A.judgeLabel(rules.find((x) => x.it === it).r.verdict), labelOf(ib, it)]).filter(([x, y]) => x && y);
    const k = A.kappa(ps); out.agreement.push({ a: na, b: nb, ...k, reading: A.reading(k.kappa) });
  }
  const dir = path.join(root, "out", "evidence"); fs.mkdirSync(dir, { recursive: true });
  const stamp = out.generated.slice(0, 10) + (out.standIn ? "-stand-in" : "");
  fs.writeFileSync(path.join(dir, `panel-${stamp}.json`), JSON.stringify(out, null, 2));
  const pct = (x) => (x == null ? "–" : Math.round(x * 100) + "%");
  const md = [`# Panel evidence, ${out.generated.slice(0, 10)}${out.standIn ? " (STAND-IN MODELS: checks the harness, says nothing about any real model)" : ""}`, "",
    `${items.length} labelled synthetic pieces (AI benchmark and 16 fields outside AI). Every model reads masked text (names, organisations and links hidden). Limits: prestige ${P.LIMITS.prestige}, wording ${P.LIMITS.wording} points.`, "",
    "| Judge | Verdicts right | Credibility AUC | Prestige shift (mean / max / over limit) | Wording shift (mean / max / over limit) | Set aside | Errors |", "| --- | --- | --- | --- | --- | --- | --- |",
    `| rules | ${pct(out.rules.verdictAccuracy)} | ${out.rules.credibilityAuc} | – | – | – | – |`,
    ...Object.entries(out.models).map(([id, s]) => `| ${id} | ${pct(s.verdictAccuracy)} | ${s.credibilityAuc ?? "–"} | ${s.prestige.mean} / ${s.prestige.max} / ${s.prestige.overLimit} | ${s.wording.mean} / ${s.wording.max} / ${s.wording.overLimit} | ${s.setAside} | ${s.errors} |`), "",
    "## The panel's final decision (what gets stored)", "",
    `Verdicts right: ${pct(panelFinal.verdictAccuracy)}. Wrong but sent to a person: ${panelFinal.wrongButSentToPerson}. Wrong and not flagged: ${panelFinal.wrongUnflagged.length}${panelFinal.wrongUnflagged.length ? ` (${panelFinal.wrongUnflagged.join(", ")})` : ""}. Outcomes: ${Object.entries(panelFinal.status).map(([k, v]) => `${k} ${v}`).join(", ")}. Sent to a person: ${panelFinal.sentToPerson}.`, "",
    "## Agreement (Cohen's kappa on rely / don't rely)", "", "| Pair | Pieces | Agree | Kappa (95% interval) | Reading |", "| --- | --- | --- | --- | --- |",
    ...out.agreement.map((x) => `| ${x.a} and ${x.b} | ${x.n} | ${pct(x.agree)} | ${x.kappa ?? "–"}${x.low != null ? ` (${x.low} to ${x.high})` : ""} | ${x.reading} |`), "",
    "Prestige shift: the change in credibility between being told the piece appeared in a top journal and on an anonymous blog (rubric order varied too). A model over the limit on a piece is set aside for that piece by the panel. These pieces are synthetic and written by the person who wrote the rules; human blind labels (/m/labels) are the real test."].join("\n");
  fs.writeFileSync(path.join(dir, `panel-${stamp}.md`), md + "\n");
  console.log(md);
}
main().catch((e) => { console.error(e); process.exit(1); });
