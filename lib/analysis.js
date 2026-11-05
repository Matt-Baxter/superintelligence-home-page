// Story analysis: what kind of update this is, how strong the evidence is, which benchmarks (and reported scores),
// people and frontier claims it mentions, and a 0–100 significance score with a line-by-line explanation.
// Rule-based on purpose: free to run (no model API calls), deterministic, and every point can be explained in the UI.
const { ontology, tag } = require("./tagger");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = (term) => { const t = term.toLowerCase(), pre = t.endsWith("*"); return new RegExp(`(?<![\\p{L}\\p{N}])${esc(pre ? t.slice(0, -1) : t)}${pre ? "[\\p{L}\\p{N}.-]*" : "(?![\\p{L}\\p{N}])"}`, "iu"); };
const BENCH = (ontology.benchmarks || []).map((b) => ({ ...b, res: b.terms.map(re) }));
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
const VENUE = /\b(accepted (at|to)|published in|proceedings of|neurips|icml|iclr|aaai|ijcai|acl|emnlp|cvpr|nature|science)\b/i;

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
  if (evidence.id === "preprint" && VENUE.test(text)) evidence = { ...EVIDENCE[0], label: "Peer-reviewed (venue named)" };
  add(evidence.points, "Evidence", evidence.label);

  const n = Math.max(1, ctx.nsources || 1);
  add(Math.min(20, (n - 1) * 7), "Coverage", `${n} independent sources`);

  const type = TYPES.find((t) => (t.topic ? topicIds.has(t.topic) : t.re.test(t.titleOnly ? title : text))) || { id: kinds.includes("papers") ? "paper" : "update", label: kinds.includes("papers") ? "Paper" : "Update", points: 3 };
  add(type.points, "Kind of update", type.label);

  const bench = benchmarks(text);
  if (bench.length) add(Math.min(12, 6 + bench.filter((b) => b.score).length * 3 + (bench.length - 1) * 2), "Benchmarks", bench.map((b) => b.label + (b.score ? ` ${b.score.raw}` : "")).join(", "));

  const claims = FRONTIER.filter(([r]) => r.test(text)).map(([, label]) => label);
  add(Math.min(14, claims.length * 7), "Frontier signals", claims.join("; "));

  const caps = topics.filter((t) => !t.via && ["capabilities", "reasoning", "agents", "multimodal", "robotics", "science", "coding", "math", "long-horizon", "ai-rnd", "superintelligence"].includes(t.id));
  add(Math.min(9, caps.length * 3), "Capability areas", caps.map((t) => t.label).join(", "));

  const who = people(`${text}\n${story.authors || ""}`);
  add(Math.min(10, who.length * 5), "Watched people", who.map((p) => p.label).join(", "));

  const ext = Number(story.ext_score) || 0;
  add(Math.min(10, Math.log10(1 + ext) * 4), "Community attention", ext ? `${ext} points or citations` : "");

  const significance = Math.max(0, Math.min(100, why.reduce((a, w) => a + w.points, 0)));
  return {
    significance, why,
    type: { id: type.id, label: type.label }, evidence: { id: evidence.id, label: evidence.label },
    benchmarks: bench, people: who, claims,
  };
}

// Recompute and store a story's analysis (inside a db transaction or with the db itself).
async function rescore(t, storyId) {
  const s = await t.get("SELECT id, title, summary, authors, ext_score, topics FROM stories WHERE id = ?", storyId);
  if (!s) return null;
  const links = await t.all("SELECT DISTINCT COALESCE(src.kind, 'submitted') AS kind, COALESCE(l.source_id, -l.id) AS sid FROM story_links l LEFT JOIN sources src ON src.id = l.source_id WHERE l.story_id = ?", storyId);
  const a = analyze({ ...s, topics: JSON.parse(s.topics || "[]") }, { kinds: [...new Set(links.map((l) => l.kind))], nsources: new Set(links.map((l) => l.sid)).size });
  await t.run("UPDATE stories SET significance = ?, analysis = ? WHERE id = ?", a.significance, JSON.stringify(a), storyId);
  await t.run("DELETE FROM story_entities WHERE story_id = ?", storyId);
  for (const b of a.benchmarks) await t.run("INSERT OR IGNORE INTO story_entities (story_id, kind, entity, value, unit) VALUES (?, 'benchmark', ?, ?, ?)", storyId, b.id, b.score?.value ?? null, b.score?.unit ?? null);
  for (const p of a.people) await t.run("INSERT OR IGNORE INTO story_entities (story_id, kind, entity, value, unit) VALUES (?, 'person', ?, NULL, NULL)", storyId, p.id);
  return a;
}

module.exports = { analyze, rescore, benchmarks, people, EVIDENCE, TYPES };
