// Judge panel: every judgement is made by at least two different models plus the rules judge (review.js), compared,
// and one result chosen by a published rule. Runs only in background workers (the watcher), never on a web request,
// and only through lib/providers.js (free tiers or local models; nothing is called unless PANEL_MODELS is set).
//
// Bias controls, each measured rather than assumed:
//   1. Identity masking: authors, the outlet, links and every person or organisation name are removed before a model
//      reads the text, so prestige can't move the score (the rules judge already ignores identity).
//   2. Counterfactual prestige: the same masked text with a fake "top journal" label and with a fake "anonymous blog"
//      label. A fair judge scores both the same; the gap is the model's prestige sensitivity.
//   3. Wording masking: the same text with hype words neutralised. The gap shows how much wording, not content, moves it.
//   4. Order: the rubric is given in a different order on each run, so position in the list can't decide a check.
//   5. Quote check: each rubric check a model marks as met must quote the sentence that shows it; quotes not found in
//      the text are thrown out and the rigor score is recomputed from the checks that survive.
//   6. Two model families: different makers' models (default Gemma and Llama) so one family's habits don't decide.
// Choosing: models whose prestige or wording sensitivity is over the limit are set aside. With two or more models left,
// if they agree (credibility within 15 and the same verdict) the panel takes their mean with the rules judge; if not,
// it takes the most conservative credibility of all judges and sends the piece to a person with every judge's view.
// With fewer than two usable models the panel is "incomplete" and the rules judge's result stands, marked as such.
const { CRITERIA, VERDICTS } = require("./review");
const { ontology } = require("../../lib/tagger");

const LIMITS = { prestige: 10, wording: 15, agree: 15, minModels: 2, escalate: 25 };
// Efficient models from two makers do the judging; a bigger open model advises. Pin exact ids from each provider's
// current list: free catalogues change.
const DEFAULT_MODELS = "ollama:gemma3:12b,groq:llama-3.1-8b-instant";
const DEFAULT_ADVISOR = "groq:openai/gpt-oss-120b";

// ---------- masking ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const listRe = (names) => (names.length ? new RegExp(`\\b(${names.map(esc).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi") : null);
const PEOPLE = listRe((ontology.people || []).flatMap((p) => [p.label, ...(p.aliases || [])]).filter((n) => n && n.length > 3));
const ORGS = listRe((ontology.organizations || []).flatMap((o) => [o.label, ...(o.aliases || []), ...(o.terms || [])]).filter((n) => n && n.length > 2));
const NAME = /\b(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)?\.? ){1,2}[A-Z][a-z]+(?:-[A-Z][a-z]+)?\b/g; // two- or three-word capitalised names
const KEEP = /^(The|This|These|We|Our|In|On|At|By|For|From|With|Compared|Code|Limitations|Abstract|However|Results|Recursive|Sparse|Large|Language|Machine|Neural|Artificial|General|Superintelligence|Reinforcement)\b/;
function mask(text) {
  let t = String(text);
  t = t.replace(/https?:\/\/\S+|www\.\S+|\b(?:[\w-]+\.)+(?:com|org|net|ai|io|dev|pub|edu|co|uk)\b(?:\/\S*)?/gi, "[LINK]");
  if (PEOPLE) t = t.replace(PEOPLE, "[PERSON]");
  if (ORGS) t = t.replace(ORGS, "[ORG]");
  t = t.replace(NAME, (m) => (KEEP.test(m) ? m : "[NAME]"));
  return t;
}
const HYPE = /\b(revolutionary|unprecedented|breakthrough|game[- ]chang\w+|incredible|massive|insane|mind[- ]blowing|world[- ]changing|definitely|guaranteed|inevitabl\w+|imminent|holy grail|doomsday|explosive|utterly transformative|palpable|existential threats?)\b/gi;
const neutralise = (text) => String(text).replace(HYPE, "notable");

// ---------- one model, four runs ----------
const PRESTIGE = { high: "Context: this appeared in a top peer-reviewed journal.", low: "Context: this appeared on an anonymous personal blog." };
function messages(text, order, context = "") {
  const checks = order.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  return [
    { role: "system", content: "You judge how far to believe a text about AI progress. Judge only what the text itself shows. Who wrote it and where it appeared are hidden on purpose; do not guess them. Reply with JSON only." },
    { role: "user", content: `${context ? `${context}\n\n` : ""}Text:\n"""\n${text}\n"""\n\nFor each check, say whether the text meets it, and if so quote the exact sentence that shows it.\n${checks}\n\nAlso give hype (0-100, lower is better: unbacked claims and hype words) and credibility (0-100).\nJSON shape: {"checks": {"<id>": {"met": true|false, "quote": "<exact sentence or empty>"}}, "hype": <number>, "credibility": <number>, "reason": "<one sentence>"}` },
  ];
}
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
function verify(out, text) {
  const T = norm(text), kept = [], dropped = [];
  for (const c of CRITERIA.rigor.checks) {
    const v = out && out.checks && out.checks[c.id]; if (!v || !v.met) continue;
    const q = norm(v.quote); (q.length >= 12 && T.includes(q.slice(0, 160)) ? kept : dropped).push(c.id);
  }
  const rigor = CRITERIA.rigor.checks.filter((c) => kept.includes(c.id)).reduce((a, c) => a + c.points, 0);
  const hype = Math.max(0, Math.min(100, Math.round(Number(out && out.hype) || 0)));
  // Credibility is recomputed with the published formula from the verified checks, not taken from the model.
  return { kept, dropped, rigor, hype, credibility: Math.round(0.5 * rigor + 0.5 * (100 - hype)), said: Number(out && out.credibility) || null, reason: String((out && out.reason) || "").slice(0, 240) };
}
const parse = (s) => { if (s && typeof s === "object") return s; const m = String(s || "").match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

async function judgeWith(model, text) {
  const masked = mask(text), base = CRITERIA.rigor.checks, rev = [...base].reverse(), mid = [...base.slice(4), ...base.slice(0, 4)];
  const run = async (t, order, ctx) => verify(parse(await model.chat(messages(t, order, ctx), { temperature: 0, json: true })), t);
  const main = await run(masked, base);
  const high = await run(masked, rev, PRESTIGE.high), low = await run(masked, mid, PRESTIGE.low);
  const calm = await run(neutralise(masked), rev);
  const prestige = Math.abs(high.credibility - low.credibility), wording = Math.abs(main.credibility - calm.credibility);
  const biased = [prestige > LIMITS.prestige && `prestige sensitivity ${prestige} (limit ${LIMITS.prestige})`, wording > LIMITS.wording && `wording sensitivity ${wording} (limit ${LIMITS.wording})`].filter(Boolean);
  return { id: model.id, model: model.model, kept: main.kept, credibility: main.credibility, rigor: main.rigor, hype: main.hype, quotesDropped: main.dropped.length, reason: main.reason, sensitivity: { prestige, wording }, biased };
}

const verdictFor = (score, credibility, flags) => VERDICTS.find((v) => v.when(score, credibility, flags));

// ---------- the advisor (a bigger model that guides, never scores) ----------
// When the efficient models disagree, a bigger model reads the same masked text and each judge's verified checks and
// says which reading the text supports, quoting the sentences that show it. Its quotes are checked like the judges'.
// It never sets a score: the piece still goes to a person, who sees the advice next to every judge's number.
function advisorMessages(text, judges) {
  const views = judges.map((j) => `- ${j.id}: credibility ${j.credibility}${j.kept ? `; checks it found: ${j.kept.join(", ") || "none"}` : ""}${j.reason ? `; reason: ${j.reason}` : ""}`).join("\n");
  return [
    { role: "system", content: "You advise a person deciding how far to believe a text about AI progress. Smaller models judged it and disagreed. Using only the text, say which judge's reading the text supports better, quoting the exact sentences that show it. Do not give a score. Who wrote it and where it appeared are hidden on purpose. Reply with JSON only." },
    { role: "user", content: `Text:\n"""\n${text}\n"""\n\nJudges:\n${views}\n\nJSON shape: {"prefer": "<judge id or none>", "quotes": ["<exact sentence>", ...], "advice": "<one or two sentences for the person>", "ruleIdea": "<optional: a judging rule worth testing, or empty>"}` },
  ];
}
async function advise(model, text, judges) {
  const masked = mask(text), out = parse(await model.chat(advisorMessages(masked, judges), { temperature: 0, json: true })) || {};
  const T = norm(masked), quotes = (Array.isArray(out.quotes) ? out.quotes : []).map(String), kept = quotes.filter((q) => norm(q).length >= 12 && T.includes(norm(q).slice(0, 160)));
  const ids = judges.map((j) => j.id), prefer = ids.includes(out.prefer) ? out.prefer : "none";
  return { id: model.id, model: model.model, prefer: kept.length ? prefer : "none", quotes: kept.slice(0, 4), quotesDropped: quotes.length - kept.length,
    advice: String(out.advice || "").slice(0, 400), ruleIdea: String(out.ruleIdea || "").slice(0, 300) };
}

// ---------- the panel ----------
// rules: the review.js result for the same piece (its credibility and guarded significance score).
async function panel({ text, rules, models, advisor = null }) {
  const judges = [{ id: "rules", model: "published rules", credibility: rules.credibility, verdict: rules.verdict, biased: [] }], errors = [];
  for (const m of models) {
    try { const j = await judgeWith(m, text); judges.push({ ...j, verdict: verdictFor(rules.score, j.credibility, rules).id }); }
    catch (e) { errors.push({ id: m.id, error: String(e.message).slice(0, 200) }); }
  }
  const usable = judges.filter((j) => j.id !== "rules" && !j.biased.length);
  const setAside = judges.filter((j) => j.biased.length).map((j) => ({ id: j.id, why: j.biased.join("; ") }));
  let status, credibility, rule, needsPerson = false;
  if (usable.length < LIMITS.minModels) {
    status = "incomplete"; credibility = rules.credibility; rule = `fewer than ${LIMITS.minModels} usable models, so the rules judge's result stands`;
  } else {
    const cs = usable.map((j) => j.credibility), spread = Math.max(...cs) - Math.min(...cs), same = new Set(usable.map((j) => j.verdict)).size === 1;
    if (spread <= LIMITS.agree && same) { status = "agreed"; credibility = Math.round([...cs, rules.credibility].reduce((a, b) => a + b, 0) / (cs.length + 1)); rule = `models agree (spread ${spread}, same verdict): mean of the models and the rules judge`; }
    else { status = "disagreed"; credibility = Math.min(...cs, rules.credibility); needsPerson = true; rule = `models disagree (spread ${spread}${same ? "" : ", different verdicts"}): the most conservative credibility, sent to a person`; }
  }
  if (rules.withdrawn) { credibility = Math.min(10, credibility); needsPerson = true; }
  const v = verdictFor(rules.score, credibility, rules);
  // Escalate to the advisor when the models disagree, or agree with each other but sit far from the rules judge.
  let advice = null;
  const far = status === "agreed" && Math.abs(usable.reduce((a, j) => a + j.credibility, 0) / usable.length - rules.credibility) > LIMITS.escalate;
  if (advisor && (status === "disagreed" || far)) {
    try { advice = await advise(advisor, text, judges); if (far) needsPerson = true; }
    catch (e) { errors.push({ id: advisor.id, error: `advisor: ${String(e.message).slice(0, 180)}` }); }
  }
  return { status, credibility, verdict: v.id, verdictRule: v.rule, rule, needsPerson, judges, setAside, errors, advice, limits: LIMITS, at: new Date().toISOString() };
}

// Models named in PANEL_MODELS ("provider:model,provider:model"), created through lib/providers.js.
function advisorFromEnv(spec = process.env.ADVISOR_MODEL || "") { const m = modelsFromEnv(spec); return m[0] || null; }
function modelsFromEnv(spec = process.env.PANEL_MODELS || "") {
  if (!spec.trim()) return [];
  const P = require("../../lib/providers");
  return spec.split(",").map((s) => s.trim()).filter(Boolean).map((s) => { const i = s.indexOf(":"); return P.create(i < 0 ? s : s.slice(0, i), i < 0 ? {} : { model: s.slice(i + 1) }); });
}

module.exports = { advise, advisorMessages, advisorFromEnv, DEFAULT_ADVISOR, panel, judgeWith, mask, neutralise, verify, messages, modelsFromEnv, LIMITS, DEFAULT_MODELS, PRESTIGE };
