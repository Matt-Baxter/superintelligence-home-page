// Story analysis: what kind of update this is, how strong the evidence is, which benchmarks (and reported scores),
// people and frontier claims it mentions, and a 0–100 significance score with a line-by-line explanation.
// Rule-based on purpose: free to run (no model API calls), deterministic, and every point can be explained in the UI.
const { ontology, tag, topicIndex } = require("./tagger");

const { attention } = require("./story-values");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = (term) => { const t = term.toLowerCase(), pre = t.endsWith("*"); return new RegExp(`(?<![\\p{L}\\p{N}])${esc(pre ? t.slice(0, -1) : t)}${pre ? "[\\p{L}\\p{N}.-]*" : "(?![\\p{L}\\p{N}])"}`, "iu"); };
const BENCH = (ontology.benchmarks || []).map((b) => ({ ...b, res: b.terms.map(re) }));
// REQ-003: superintelligence-only feed. In scope when the text has a strong term, or matches at least
// `min_topics` of the top-level (spec) topics. The reason is stored so admins and readers can see the decision.
const SCOPE = ontology.scope || { strong: [], min_topics: 2 };
const LABEL = Object.fromEntries((ontology.topics || []).map((t) => [t.id, t.label]));
const rootOf = topicIndex.rootOf;
// REQ-003 lives in lib/rules/scope.json as a portable si-expr rule (the same file runs in Python and Rust).
const expr = require("./expr");
function scope(text, topics) {
  const tops = [...new Set(topics.filter((t) => !t.via).map((t) => rootOf(t.id)))];
  return expr.run("scope", { text, strong: SCOPE.strong || [], tops, top_labels: tops.map((t) => LABEL[t]), min_topics: SCOPE.min_topics || 2 });
}

const SIGNALS = [];
// Modules add signals through the kernel; each must have a factor name, a max and a score() function.
function registerSignal(sig) {
  if (!sig || typeof sig.score !== "function" || !sig.factor) throw new Error("A signal needs a factor and a score() function");
  SIGNALS.push(sig);
}
const PEOPLE = (ontology.people || []).map((p) => ({ ...p, res: p.terms.map(re) }));

// Evidence ladder: the strongest source a story has decides it.
const EVIDENCE = [
  { id: "peer-reviewed", label: "Peer-reviewed", points: 15, kinds: ["journal"] },
  { id: "independent-eval", label: "Independent research or evaluation", points: 13, kinds: ["research-org"] },
  { id: "lab", label: "Lab announcement", points: 12, kinds: ["lab"] },
  { id: "preprint", label: "Preprint", points: 9, kinds: ["papers", "academic"] },
  { id: "policy", label: "Policy analysis", points: 8, kinds: ["policy"] },
  { id: "news", label: "News report", points: 7, kinds: ["news"] },
  { id: "commentary", label: "Expert commentary", points: 6, kinds: ["people", "newsletter", "forum"] },
  { id: "community", label: "Community discussion", points: 3, kinds: ["community"] },
  { id: "submitted", label: "Reader-submitted", points: 2, kinds: ["submitted"] },
];
const VENUE = /\b(?:accepted (?:at|to)|published in|proceedings of)\s+(?:(?:the|a)\s+)?(?:neurips|icml|iclr|aaai|ijcai|acl|emnlp|cvpr|nature|science)\b/i;
const UNACCEPTED = /\b(?:(?:not|never|wasn['’]t|weren['’]t|hasn['’]t|haven['’]t|hadn['’]t|isn['’]t|aren['’]t)\s+(?:(?:been|yet|ever|actually|ultimately|formally)\s+){0,3}(?:accepted|published|peer[- ]reviewed)|unaccepted|rejected|submitted to|under review)\b/i;

// What kind of update, most specific first. The first rule that matches is the primary type.
const TYPES = [
  { id: "safety-finding", label: "Safety finding", points: 10, re: /\b(scheming|deceptiv\w*|sandbagg?\w*|reward hacking|alignment faking|power[- ]seeking|sabotage|jailbreak\w*|misalign\w*|self-exfiltrat\w*|situational awareness)\b/i },
  { id: "release", label: "Release", points: 10, re: /\b(introduc(ing|es)|announc(ing|es)|launch(es|ed|ing)?|releas(e|es|ed|ing)|now available|unveil\w*|debuts?|open[- ]sourc(es|ed|ing))\b/i, titleOnly: true },
  { id: "result", label: "New result", points: 9, re: /\b(state[- ]of[- ]the[- ]art|sota|outperform\w*|surpass\w*|new record|beats?|exceeds?|superhuman|human[- ]level|first (ai|model|system|time))\b/i },
  { id: "evaluation", label: "Evaluation", points: 7, re: /\b(evaluat\w+|benchmark\w*|leaderboard|eval(s)?|we test(ed)?|measur(e|es|ing) (how|whether))\b/i },
  { id: "policy", label: "Policy", points: 6, topic: "policy" },
  { id: "compute", label: "Compute & investment", points: 5, re: /\b(rais(es|ed)|funding|valuation|data ?cent(er|re)s?|gigawatts?|\d+\s?gw|chips?|gpus?|supercomputer|cluster)\b/i, titleOnly: true },
  { id: "analysis", label: "Analysis", points: 4, re: /\b(why|thoughts|essay|lessons|explainer|how .* works|what .* means|forecast\w*|timelines?)\b/i, titleOnly: true },
];
const FRONTIER = [
  [/\b(superintelligen\w*|agi|artificial general intelligence|asi)\b/i, "talks about AGI or superintelligence"],
  [/\b(recursive(ly)? self[- ]improv\w*|automat(ed|ing|es) (ai )?research|ai r&d)\b/i, "AI improving AI"],
  [/\b(superhuman|human[- ]level|surpass(es|ed)? (human|expert)s?|expert[- ]level)\b/i, "human-level or beyond"],
  [/\b(state[- ]of[- ]the[- ]art|sota|new record|first (ai|model|system) to)\b/i, "claims a new best result"],
  [/\b(dangerous capabilit\w*|bioweapon\w*|uplift|autonomous replication|loss of control)\b/i, "dangerous-capability signal"],
];

// A frontier claim counts only when some mention of it is not negated in its own clause: "does not achieve
// superhuman performance" and "no evidence of recursive self-improvement" earn nothing (REQ-007: every point must be
// a real claim). A negator (not, no, never, without, cannot, n't, fails to) within the 5 words before the match, with
// no clause break (comma, semicolon, colon, bracket, and, but, while, although, though, yet, however) in between, negates
// it; two negators cancel ("not without superhuman…"); "no more/less/longer…" and "not only/just" are comparisons, not
// negations. The same rule as the Review desk's markers (modules/review/review.js), kept here because lib/ cannot
// depend on a module.
const NEGATOR = /^(?:not|no|without|never|neither|nor|cannot|none)$|n't$/;
const CLAUSE_BREAK = /[,;:()[\]]|\b(?:and|but|while|whereas|although|though|yet|however)\b/gi;
function negatedBefore(text, index) {
  let pre = text.slice(Math.max(0, index - 200), index);
  const cuts = [...pre.matchAll(CLAUSE_BREAK)]; if (cuts.length) { const c = cuts.at(-1); pre = pre.slice(c.index + c[0].length); }
  const w = pre.toLowerCase().match(/[a-z']+/g) || [], last = w.slice(-5);
  let n = 0;
  last.forEach((t, i) => {
    const next = last[i + 1] || "";
    if (t === "no" && /^(?:more|less|fewer|worse|better|longer|later|sooner|doubt)$/.test(next)) return;
    if (t === "not" && /^(?:only|just|merely)$/.test(next)) return;
    if (NEGATOR.test(t) || (/^fail(?:s|ed)?$/.test(t) && next === "to")) n++;
  });
  return n % 2 === 1;
}
function frontierMatch(re, text) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) if (!negatedBefore(text, m.index)) return true;
  return false;
}

// A reported number next to a benchmark name: "71.7% on SWE-bench Verified", "SWE-bench Verified: 71.7%", "a 2-hour time horizon".
function scoreNear(text, idx, len, unit) {
  const win = text.slice(Math.max(0, idx - 70), idx + len + 70);
  const rel = idx - Math.max(0, idx - 70);
  if (unit === "time") {
    const m = [...win.matchAll(/(\d+(?:\.\d+)?)\s*-?\s*(hours?|hrs?|minutes?|mins?|days?)\b(?:\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?)\b)?/gi)];
    if (!m.length) return null;
    const best = m.sort((a, b) => Math.abs(a.index - rel) - Math.abs(b.index - rel))[0];
    const n = Number(best[1]), u = best[2].toLowerCase(), extra = Number(best[3] || 0) / 60;
    return { value: +((u.startsWith("min") ? n / 60 : u.startsWith("day") ? n * 24 : n) + extra).toFixed(2), unit: "hours", raw: best[0] };
  }
  const m = [...win.matchAll(/(\d{1,3}(?:\.\d+)?)\s?(%|percent)/gi)].filter((x) => Number(x[1]) <= 100);
  if (!m.length) return null;
  const best = m.sort((a, b) => Math.abs(a.index - rel) - Math.abs(b.index - rel))[0];
  return { value: Number(best[1]), unit: "%", raw: best[0] };
}

function benchmarks(text) {
  const out = [];
  for (const b of BENCH) {
    // Every mention counts; keep the first one that has a number next to it (titles often name the benchmark without the score).
    const hits = b.res.flatMap((r) => [...text.matchAll(new RegExp(r.source, "giu"))]).sort((x, y) => x.index - y.index);
    if (!hits.length) continue;
    if (b.generic && out.some((x) => x.id.startsWith(b.id))) continue; // "SWE-bench Verified" already found
    const scored = hits.map((m) => ({ m, score: scoreNear(text, m.index, m[0].length, b.unit) })).find((x) => x.score);
    out.push({ id: b.id, label: b.label, measures: b.measures, matched: (scored?.m || hits[0])[0], score: scored?.score || null });
  }
  return out;
}
const people = (text) => PEOPLE.filter((p) => p.res.some((r) => r.test(text))).map((p) => ({ id: p.id, label: p.label }));

/**
 * @param story {title, summary, authors, ext_score, topics?}
 * @param ctx   {kinds: [source kinds], nsources}
 */
function analyze(story, ctx = {}) {
  const title = story.title || "", text = `${title}\n${story.summary || ""}`.slice(0, 6000);
  const kinds = ctx.kinds?.length ? ctx.kinds : ["submitted"];
  const topics = story.topics || tag(title, story.summary).topics;
  const topicIds = new Set(topics.map((t) => t.id));
  const why = [];
  const add = (points, factor, detail) => { if (points) why.push({ factor, points: Math.round(points), detail }); };

  let evidence = EVIDENCE.find((e) => kinds.some((k) => e.kinds.includes(k))) || EVIDENCE.at(-1);
  if (evidence.id === "preprint" && VENUE.test(text) && !UNACCEPTED.test(text)) evidence = { ...EVIDENCE[0], label: "Peer-reviewed (acceptance stated)" };
  add(evidence.points, "Evidence", evidence.label);

  const n = Math.max(1, Math.trunc(attention(ctx.nsources)));
  add(Math.min(20, (n - 1) * 7), "Coverage", `${n} linked sources (reader submissions pooled)`);

  const type = TYPES.find((t) => (t.topic ? topicIds.has(t.topic) : t.re.test(t.titleOnly ? title : text))) || { id: kinds.includes("papers") ? "paper" : "update", label: kinds.includes("papers") ? "Paper" : "Update", points: 3 };
  add(type.points, "Kind of update", type.label);

  const bench = benchmarks(text);
  if (bench.length) add(Math.min(12, 6 + bench.filter((b) => b.score).length * 3 + (bench.length - 1) * 2), "Benchmarks", bench.map((b) => b.label + (b.score ? ` ${b.score.raw}` : "")).join(", "));

  const claims = FRONTIER.filter(([r]) => frontierMatch(r, text)).map(([, label]) => label);
  add(Math.min(14, claims.length * 7), "Frontier signals", claims.join("; "));

  const caps = topics.filter((t) => !t.via && ["capabilities", "reasoning", "agents", "multimodal", "robotics", "science", "coding", "math", "long-horizon", "automating-ai-research", "superintelligence"].includes(t.id));
  add(Math.min(9, caps.length * 3), "Capability areas", caps.map((t) => t.label).join(", "));

  const who = people(`${text}\n${story.authors || ""}`);
  add(Math.min(10, who.length * 5), "Watched people", who.map((p) => p.label).join(", "));

  // Signals contributed by modules (extension point "analysis.signals"). Each returns {points, detail} or nothing.
  for (const sig of SIGNALS) {
    let r; try { r = sig.score({ title, text, summary: story.summary || "", authors: story.authors || "", kinds, nsources: n, topics, benchmarks: bench, claims }); } catch { r = null; }
    if (r && r.points) add(Math.max(0, Math.min(sig.max ?? 10, r.points)), sig.factor, r.detail || "");
  }

  const ext = attention(story.ext_score);
  add(Math.min(10, Math.log10(1 + ext) * 4), "Community attention", ext ? `External attention metric: ${ext}; not evidence quality` : "");

  const significance = Math.max(0, Math.min(100, why.reduce((a, w) => a + w.points, 0)));
  return {
    significance, why, scope: scope(`${text}\n${story.authors || ""}`, topics),
    type: { id: type.id, label: type.label }, evidence: { id: evidence.id, label: evidence.label },
    benchmarks: bench, people: who, claims,
  };
}

// Recompute and store a story's analysis (inside a db transaction or with the db itself).
async function rescore(t, storyId) {
  const s = await t.get("SELECT id, title, summary, authors, ext_score, topics FROM stories WHERE id = ?", storyId);
  if (!s) return null;
  // Reader-submitted URL variants are one provenance class, not new independent sources.
  const links = await t.all("SELECT DISTINCT COALESCE(src.kind, 'submitted') AS kind, COALESCE(l.source_id, 0) AS sid FROM story_links l LEFT JOIN sources src ON src.id = l.source_id WHERE l.story_id = ?", storyId);
  const a = analyze({ ...s, topics: JSON.parse(s.topics || "[]") }, { kinds: [...new Set(links.map((l) => l.kind))], nsources: new Set(links.map((l) => l.sid)).size });
  await t.run("UPDATE stories SET significance = ?, analysis = ?, in_scope = ? WHERE id = ?", a.significance, JSON.stringify(a), a.scope.in ? 1 : 0, storyId);
  await t.run("DELETE FROM story_entities WHERE story_id = ?", storyId);
  for (const b of a.benchmarks) await t.run("INSERT OR IGNORE INTO story_entities (story_id, kind, entity, value, unit) VALUES (?, 'benchmark', ?, ?, ?)", storyId, b.id, b.score?.value ?? null, b.score?.unit ?? null);
  for (const p of a.people) await t.run("INSERT OR IGNORE INTO story_entities (story_id, kind, entity, value, unit) VALUES (?, 'person', ?, NULL, NULL)", storyId, p.id);
  return a;
}

module.exports = { scope, registerSignal, analyze, rescore, benchmarks, people, EVIDENCE, TYPES };
