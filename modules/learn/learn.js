// Learn: concepts behind superintelligence research as a graph, the "how it works" teardown of the pipeline,
// and the generators the background worker uses (blog/Substack drafts, explainer storyboards, Manim scenes, Lean files).
// Pure functions over data/concepts.json and lib/; no database access here (routes.js and the worker do that).
const DATA = require("./data/concepts.json");
const tagger = require("../../lib/tagger");
const analysis = require("../../lib/analysis");
const feeds = require("../../lib/feeds");

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termRe = (term) => { const t = term.toLowerCase().trim(), p = t.endsWith("*"), b = escRe(p ? t.slice(0, -1) : t); return new RegExp(`(?<![a-z0-9])${b}${p ? "[a-z0-9-]*" : "(?![a-z0-9])"}`, "i"); };
const CONCEPTS = DATA.concepts.map((c) => ({ ...c, res: (c.terms || []).map((t) => [t, termRe(t)]) }));
const BY_ID = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
const strip = ({ res, ...c }) => c;

function edges() {
  const out = [];
  for (const c of CONCEPTS) for (const r of c.relations || []) if (BY_ID[r.to]) out.push({ from: c.id, to: r.to, kind: r.kind, label: DATA.relations[r.kind] || r.kind });
  return out;
}
function list() { return CONCEPTS.map(({ id, name, topic, level, plain }) => ({ id, name, topic, level, plain })); }
function get(id) { const c = BY_ID[id]; if (!c) return null; const e = edges(); return { ...strip(c), links: e.filter((x) => x.from === id || x.to === id).map((x) => ({ ...x, other: x.from === id ? x.to : x.from, otherName: BY_ID[x.from === id ? x.to : x.from].name, out: x.from === id })) }; }

// Which concepts a piece of text touches, with the words that matched (same matching rule as lib/tagger.js).
function conceptsIn(text) {
  const out = [];
  for (const c of CONCEPTS) { const hits = []; for (const [, re] of c.res) { const m = text.match(re); if (m) hits.push(m[0].toLowerCase()); } if (hits.length) out.push({ id: c.id, name: c.name, matched: [...new Set(hits)].slice(0, 4) }); }
  return out;
}

// Prerequisites first: walk "needs" edges so a learner sees what to read before this concept.
function path(id) {
  const seen = new Set(), order = [];
  const visit = (x, depth) => { if (seen.has(x) || depth > 6 || !BY_ID[x]) return; seen.add(x); for (const r of BY_ID[x].relations || []) if (r.kind === "needs") visit(r.to, depth + 1); order.push(x); };
  visit(id, 0);
  return order.map((x) => ({ id: x, name: BY_ID[x].name, level: BY_ID[x].level }));
}

// "How it works": run one story through every pipeline step without writing anything (proposed REQ-021).
// lookup(key) -> existing story {id,title} or null, supplied by the route (one indexed query per key).
async function teardown({ title, summary = "", url = "", kind = "submitted" }, lookup = async () => null) {
  const steps = [];
  const item = { title, summary, url, published: new Date().toISOString() };
  const social = /(^|[/.])(twitter\.com|x\.com|nitter\.)/i.test(url || "");
  steps.push({ id: "fetch", name: "Fetch", what: "A source's feed is read and each entry becomes an item: title, link, summary, date.",
    input: { title, url, summary: summary.slice(0, 200) }, output: social ? { dropped: true, reason: "Twitter/X links are never accepted (REQ-006)." } : { item: { title, url: feeds.canonicalUrl(item) } } });
  if (social) return { steps, stopped: "fetch" };
  const keys = feeds.storyKeys(item);
  let match = null; for (const k of keys) { match = await lookup(k); if (match) break; }
  steps.push({ id: "group", name: "Group", what: "Each item gets identity keys (arXiv id, cleaned link, cleaned title). A key we've seen before means it's the same story from another source, so it's grouped instead of duplicated.",
    input: { url, title }, output: { keys, existing: match ? { id: match.id, title: match.title } : null, decision: match ? "Joins an existing story (coverage +1)" : keys.length ? "New story" : "Skipped: no usable key" } });
  const tg = tagger.tag(title, summary);
  steps.push({ id: "tag", name: "Tag", what: "The ontology tagger matches topic and organisation words. Every tag keeps the words that matched, so it can explain itself.",
    input: { text: `${title} ${summary}`.slice(0, 300) }, output: { topics: tg.topics.map((t) => ({ label: t.label, matched: t.matched, via: t.via || null })), orgs: tg.orgs.map((o) => ({ label: o.label, matched: o.matched })) } });
  const a = analysis.analyze({ title, summary, topics: tg.topics }, { kinds: [kind], nsources: match ? 2 : 1 });
  steps.push({ id: "scope", name: "Scope", what: "Only superintelligence stories reach the feed (REQ-003): a strong term, or at least two of the nine top-level topics.",
    input: { topics: [...new Set(tg.topics.map((t) => t.label))] }, output: a.scope });
  steps.push({ id: "score", name: "Score", what: "Significance (0-100) adds up named factors, each with its points and reason, so the number is never a black box.",
    input: { kind, sources: match ? 2 : 1 }, output: { significance: a.significance, type: a.type.label, evidence: a.evidence.label, why: a.why } });
  steps.push({ id: "concepts", name: "Concepts", what: "The Learn layer links the story to the ideas it touches, so a reader can look up what they mean.",
    input: {}, output: { concepts: conceptsIn(`${title}\n${summary}`) } });
  steps.push({ id: "feed", name: "Feed", what: "In-scope stories appear newest first by default; readers can sort by votes or significance.",
    input: {}, output: { shown: a.scope.in, where: a.scope.in ? "Front page, newest first" : "Stored, but left out of the feed (admins can see why)" } });
  return { steps };
}

// ---------- generators used by the background worker (scripts/learn-worker.js) ----------
const site = () => (process.env.PUBLIC_URL || "").replace(/\/$/, "");

// Blog / Substack draft in Markdown. Stories are listed by title and link only (no claims attributed to anyone).
function postDraft(id, stories = []) {
  const c = BY_ID[id]; if (!c) throw new Error("unknown concept " + id);
  const g = get(id), pre = path(id).filter((x) => x.id !== id);
  return [
    `# ${c.name}, in plain words`, "",
    c.plain, "",
    `## An analogy`, "", c.analogy, "",
    `## A little deeper`, "", c.deeper, "",
    pre.length ? `## Read first\n\n${pre.map((p) => `- ${p.name}`).join("\n")}\n` : null,
    g.links.length ? `## How it connects\n\n${neighbours(g).map((n) => `- ${c.name} ${n.label} ${n.name}`).join("\n")}\n` : null,
    c.lean ? `## A toy proof\n\nA tiny formal version of the idea, ${c.lean.proved ? "checked with Lean 4" : "with the proof still to do"}:\n\n\`\`\`lean\n${c.lean.statement}\n\`\`\`\n` : "",
    stories.length ? `## In the news\n\n${stories.slice(0, 5).map((s) => `- [${s.title}](${s.url})`).join("\n")}\n` : null,
    `## Check yourself`, "", `**${c.check.q}**`, "", c.check.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n"), "",
    `<details><summary>Answer</summary>${String.fromCharCode(65 + c.check.answer)}: ${c.check.why}</details>`, "",
    "---", `From the Superintelligence Homepage Learn series${site() ? ` (${site()}/m/learn#/c/${id})` : ""}.`, "",
  ].filter((x) => x !== null).join("\n");
}

// Short social posts (drafts for a person to publish; no Twitter/X).
function socialDrafts(id, link = "") {
  const c = BY_ID[id];
  return [
    { channel: "LinkedIn", text: `${c.name}, in plain words: ${c.plain}\n\nAnalogy: ${c.analogy}${link ? `\n\nMore: ${link}` : ""}` },
    { channel: "Bluesky / Threads / Mastodon", text: `${c.name}: ${c.analogy}`.slice(0, 280 - (link ? link.length + 1 : 0)) + (link ? ` ${link}` : "") },
    { channel: "Substack note", text: `Today's concept: ${c.name}. ${c.plain}${link ? ` ${link}` : ""}` },
  ];
}

// One entry per neighbouring concept, labelled from this concept's point of view ("builds on", "used by", ...).
const BACK = { needs: "is used by", "part-of": "contains", "leads-to": "can follow from", contrasts: "is the opposite worry to", related: "is related to" };
function neighbours(g) {
  const by = new Map();
  for (const l of g.links) { const lab = l.out ? l.label : BACK[l.kind] || l.label; const e = by.get(l.other) || { name: l.otherName, labels: [] }; if (!e.labels.includes(lab)) e.labels.push(lab); by.set(l.other, e); }
  return [...by.values()].map((e) => ({ name: e.name, label: e.labels.join(" and ") }));
}

// Explainer storyboard: the scenes the /m/explainer player animates and the Manim scene renders.
function storyboard(id) {
  const c = BY_ID[id]; if (!c) throw new Error("unknown concept " + id);
  const g = get(id);
  return { id, title: c.name, scenes: [
    { kind: "title", text: c.name, sub: "in plain words", seconds: 3 },
    { kind: "say", text: c.plain, seconds: 7 },
    { kind: "analogy", text: c.analogy, seconds: 7 },
    { kind: "graph", center: c.name, nodes: neighbours(g).slice(0, 6), seconds: 6 },
    { kind: "say", text: c.deeper, seconds: 8, small: true },
    { kind: "question", text: c.check.q, options: c.check.options, answer: c.check.answer, why: c.check.why, seconds: 7 },
  ] };
}

const pyStr = (s) => JSON.stringify(String(s));
// A Manim Community scene (3Blue1Brown's open-source engine, community edition) for people who render locally.
function manimScene(id) {
  const sb = storyboard(id), cls = id.replace(/(^|-)(\w)/g, (_, __, ch) => ch.toUpperCase()) + "Explainer";
  const L = [];
  L.push("# Generated by scripts/learn-worker.js. Render: manim -qm explainer.py " + cls, "from manim import *", "", "def wrap(s, n=46):", "    words, lines, cur = s.split(), [], ''", "    for w in words:", "        if len(cur) + len(w) + 1 > n: lines.append(cur); cur = w", "        else: cur = (cur + ' ' + w).strip()", "    lines.append(cur)", "    return '\\n'.join(lines)", "", `class ${cls}(Scene):`, "    def construct(self):", "        self.camera.background_color = '#0f1115'");
  for (const s of sb.scenes) {
    if (s.kind === "title") L.push(`        t = Text(${pyStr(s.text)}, font_size=56); sub = Text(${pyStr(s.sub)}, font_size=28, color=GRAY).next_to(t, DOWN)`, "        self.play(FadeIn(t, shift=UP*0.2), run_time=0.6); self.play(FadeIn(sub), run_time=0.4)", `        self.wait(${s.seconds - 1.5}); self.play(FadeOut(t), FadeOut(sub), run_time=0.5)`);
    else if (s.kind === "graph") {
      L.push(`        c = RoundedRectangle(corner_radius=0.2, width=4, height=0.9, color=TEAL); ct = Text(${pyStr(s.center)}, font_size=30).move_to(c)`, "        self.play(Create(c), FadeIn(ct), run_time=0.6)");
      s.nodes.forEach((n, i) => { const ang = (i / Math.max(1, s.nodes.length)) * 2 * Math.PI; L.push(`        n${i} = Text(${pyStr(n.name)}, font_size=24).move_to([${(4.2 * Math.cos(ang)).toFixed(2)}, ${(2.4 * Math.sin(ang)).toFixed(2)}, 0]); a${i} = CurvedArrow(c.get_center(), n${i}.get_center(), angle=-0.3, color=GRAY)`, `        self.play(Create(a${i}), FadeIn(n${i}), run_time=0.35)`); });
      L.push(`        self.wait(${s.seconds - 2}); self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)`);
    } else if (s.kind === "question") {
      L.push(`        q = Text(wrap(${pyStr(s.text)}), font_size=32).to_edge(UP)`, `        opts = VGroup(*[Text(o, font_size=26) for o in ${JSON.stringify(s.options)}]).arrange(DOWN, aligned_edge=LEFT).next_to(q, DOWN, buff=0.6)`, "        self.play(FadeIn(q), run_time=0.5); self.play(LaggedStart(*[FadeIn(o, shift=RIGHT*0.2) for o in opts], lag_ratio=0.15))", `        self.wait(2); self.play(opts[${s.answer}].animate.set_color(TEAL), Indicate(opts[${s.answer}], scale_factor=1.05), run_time=0.6)`, `        why = Text(wrap(${pyStr(s.why)}), font_size=24, color=GRAY).to_edge(DOWN); self.play(FadeIn(why)); self.wait(${Math.max(1, s.seconds - 4)})`);
    } else L.push(`        t = Text(wrap(${pyStr(s.text)}), font_size=${s.small ? 26 : 32}${s.kind === "analogy" ? ", slant=ITALIC" : ""})`, "        self.play(Write(t), run_time=1.2)", `        self.wait(${s.seconds - 1.8}); self.play(FadeOut(t), run_time=0.4)`);
  }
  return { file: "explainer.py", className: cls, source: L.join("\n") + "\n" };
}

function leanFile(id) {
  const c = BY_ID[id]; if (!c || !c.lean) return null;
  return { file: `${id.replace(/-/g, "_")}.lean`, proved: !!c.lean.proved, needs: c.lean.needs || null, source: `-- ${c.name}: toy formal statement from the Learn layer.\n${c.lean.needs ? `-- Needs: ${c.lean.needs}\n` : ""}${c.lean.statement}\n` };
}

const JOB_KINDS = [
  { id: "post", label: "Blog / Substack draft", runs: "worker" },
  { id: "video", label: "Explainer video", runs: "worker" },
  { id: "lean-proof", label: "Lean 4 proof", runs: "worker (checks with Lean when installed)" },
  { id: "explain", label: "Explain a paper in plain words", runs: "agent" },
  { id: "paper-to-code", label: "Paper to code", runs: "agent" },
  { id: "dossier", label: "Topic dossier: blog draft, posts and explainer video (note: topic:<id>)", runs: "worker" },
  { id: "reverse-engineer", label: "Reverse-engineer a system or result", runs: "agent" },
  { id: "response", label: "Paper response: full-text analysis, plan, explainer video, article and posts (note: paper:<arXiv id>)", runs: "worker" },
];

module.exports = { DATA, list, get, edges, path, conceptsIn, teardown, postDraft, socialDrafts, storyboard, manimScene, leanFile, JOB_KINDS, BY_ID };
