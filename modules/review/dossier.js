// Topic dossier: a rigorous, traced analysis of one research topic, turned into simple explainers (a blog draft, short
// posts, a video storyboard the /m/explainer player animates and the worker records). Deterministic, no model calls.
//
// What it weighs, for one topic (an ontology topic id):
//   papers and articles reviewed on the Review desk (verdict, credibility, how many claims are backed, surveys apart),
//   reader comments reviewed there (counted, never attributed), feed stories on the topic (with their sources),
//   our own Lab checks of ideas on the topic (supported or not, at toy scale), concepts that explain it, and
//   watched people and organisations as mention counts only: who is talked about, never what we say they said.
// Every sentence in the outputs carries numbered references, and every reference has a trace (doc:, story:, lab:,
// concept:) back to the record it came from. Publishing is a person's action; nothing is posted (no Twitter/X).
const analysis = require("../../lib/analysis");
const SRC = require("./sources");
const B = require("./bands");
const { ontology } = require("../../lib/tagger");
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pl = (n, w, many = `${w}s`) => `${n} ${n === 1 ? w : many}`;
const topicLabel = (id) => (ontology.topics.find((t) => t.id === id) || {}).label || id;
const descendants = (id) => ontology.topics.filter((t) => t.parent === id).flatMap((c) => [c.id, ...descendants(c.id)]);

// ---------- gather (database) ----------
async function gather(db, topic) {
  const ids = [topic, ...descendants(topic)], qids = ids.map((t) => `topic:${t}`);
  const mark = qids.map(() => "?").join(", ");
  const docs = (await db.all(`SELECT DISTINCT d.id, d.qid, d.kind, d.title, d.authors, d.url, d.score, d.credibility, d.verdict, d.needs_person, d.label, d.result, d.created_at
    FROM review_docs d JOIN knowledge_edges e ON e.src = d.qid AND e.rel = 'about' WHERE e.dst IN (${mark}) ORDER BY d.id DESC LIMIT 200`, ...qids)).map((d) => ({ ...d, result: JSON.parse(d.result || "{}") }));
  const docEdges = docs.length ? await db.all(`SELECT src, rel, dst FROM knowledge_edges WHERE src IN (${docs.map(() => "?").join(", ")})`, ...docs.map((d) => d.qid)) : [];
  const storyRows = await db.all(`SELECT DISTINCT s.id, s.title, s.url, s.summary, s.topics, COALESCE(s.published_at, s.first_seen) AS at FROM stories s JOIN story_topics t ON t.story_id = s.id
    WHERE t.topic IN (${ids.map(() => "?").join(", ")}) AND COALESCE(s.in_scope, 1) = 1 AND COALESCE(s.hidden, 0) = 0 ORDER BY s.id DESC LIMIT 300`, ...ids);
  const links = storyRows.length ? await db.all(`SELECT l.story_id, src.name, src.kind FROM story_links l JOIN sources src ON src.id = l.source_id WHERE l.story_id IN (${storyRows.map(() => "?").join(", ")})`, ...storyRows.map((s) => s.id)) : [];
  const ents = storyRows.length ? await db.all(`SELECT story_id, kind, entity FROM story_entities WHERE kind IN ('person', 'org') AND story_id IN (${storyRows.map(() => "?").join(", ")})`, ...storyRows.map((s) => s.id)) : [];
  const events = await db.all(`SELECT DISTINCT ev.id, ev.qid, ev.doc_qid, ev.outlet, ev.outlet_label, ev.sentence, ev.due, ev.status FROM review_events ev JOIN knowledge_edges e ON e.src = ev.qid AND e.rel = 'about'
    WHERE e.dst IN (${mark}) ORDER BY ev.due ASC LIMIT 100`, ...qids).catch(() => []);
  return { topic, ids, docs, docEdges, events, stories: storyRows.map((s) => { const L = links.filter((l) => l.story_id === s.id);
    return { ...s, sources: [...new Set(L.map((l) => l.name))], kinds: [...new Set(L.map((l) => l.kind))], entities: ents.filter((e) => e.story_id === s.id) }; }) };
}

// ---------- analyse (pure) ----------
function analyse({ topic, ids, docs, docEdges, stories, events = [] }, { examples = [], concepts = [], at = new Date().toISOString().slice(0, 10) } = {}) {
  const refs = [], ref = (r) => { const i = refs.findIndex((x) => x.trace === r.trace); if (i >= 0) return i + 1; refs.push(r); return refs.length; };
  // One record per piece: the same URL reviewed twice (say, the watcher and a person) counts once, newest first.
  const seenUrl = new Set(); docs = docs.filter((d) => !d.url || (seenUrl.has(d.url) ? false : seenUrl.add(d.url)));
  const papers = docs.filter((d) => d.kind !== "comment"), comments = docs.filter((d) => d.kind === "comment");
  const P = papers.map((d) => {
    const cl = d.result.claims || [], backed = cl.filter((c) => c.level === "backed").length, unbacked = cl.filter((c) => c.level === "unbacked").length;
    const strongest = cl.find((c) => c.level === "backed") || cl.find((c) => c.level === "partly backed") || null;
    return { id: d.id, qid: d.qid, kind: d.kind, grade: d.result.source ? d.result.source.grade : null, hype: ((d.result.judges || []).find((j) => j.id === "hype") || {}).score ?? null, at: d.created_at, title: d.title, url: d.url, survey: !!d.result.survey, verdict: d.verdict, credibility: d.credibility, score: d.score, band: B.band(d.credibility, B.CREDIBLE_AT),
      claims: cl.length, backed, unbacked, needsPerson: !!d.needs_person, personLabel: d.label, strongest: strongest ? strongest.sentence : null,
      n: ref({ type: d.kind === "paper" ? "paper" : "article", title: d.title, url: d.url, trace: d.qid, note: `${d.verdict}, credibility ${d.credibility}` }) };
  }).sort((a, b) => b.credibility - a.credibility);
  // Credible = High band around 60 (REQ-037): credibility 65 or more at the default margin 5. A Border paper (55 to 64)
  // is listed as borderline and never counted, so a marker or two can't flip the rating.
  const primary = P.filter((p) => !p.survey && p.kind === "paper"), credible = primary.filter((p) => p.band === "high"), borderline = primary.filter((p) => p.band === "border");
  const lo = B.CREDIBLE_AT - B.MARGIN, hi = B.CREDIBLE_AT + B.MARGIN, credibleUrls = new Set(credible.map((p) => p.url));

  // Corroboration: a concept counts as corroborated when two or more reviewed papers explain it.
  const byConcept = {};
  for (const e of docEdges) if (e.rel === "explains") (byConcept[e.dst] ||= new Set()).add(e.src);
  const corroboration = Object.entries(byConcept).map(([c, s]) => ({ concept: c, name: (concepts.find((x) => `concept:${x.id}` === c) || {}).name || c.slice(8), papers: s.size })).sort((a, b) => b.papers - a.papers);
  // Where papers disagree: a concept two or more reviewed papers explain, but judged far apart (credibility 30 or more
  // apart, or one doubtful or withdrawn beside a credible one). A light version of support-versus-contrast views.
  const contested = Object.entries(byConcept).filter(([, s]) => s.size >= 2).map(([c, s]) => {
    const ps = P.filter((p) => s.has(p.qid)), hi = ps.reduce((a, p) => (p.credibility > a.credibility ? p : a), ps[0]), lo = ps.reduce((a, p) => (p.credibility < a.credibility ? p : a), ps[0]);
    const bad = ps.some((p) => ["doubtful", "withdrawn"].includes(p.verdict)) && ps.some((p) => p.credibility >= 60);
    return hi && lo && (hi.credibility - lo.credibility >= 30 || bad) ? { concept: c, name: (concepts.find((x) => `concept:${x.id}` === c) || {}).name || c.slice(8), high: { title: hi.title, credibility: hi.credibility, verdict: hi.verdict, n: hi.n }, low: { title: lo.title, credibility: lo.credibility, verdict: lo.verdict, n: lo.n } } : null;
  }).filter(Boolean).slice(0, 6);

  // Our own checks: Lab examples on this topic (or citing a reviewed paper as their source).
  const urls = new Set(papers.map((p) => p.url));
  const checks = examples.filter((x) => (x.topics || []).some((t) => ids.includes(t.replace(/^topic:/, ""))) || (x.source && urls.has(x.source.url)))
    .map((x) => ({ id: x.id, title: x.title, supported: x.verdict.supported, text: x.verdict.text, source: x.source || null,
      tests: !x.source || !urls.has(x.source.url) ? null : credibleUrls.has(x.source.url) ? "credible" : "not credible", n: ref({ type: "lab check", title: x.title, url: `/m/lab#/x/${x.id}`, trace: `lab:${x.id}`, note: x.verdict.supported ? "supported at toy scale" : "not supported at toy scale" }) }));

  // Feed coverage: stories on the topic, their sources, and the most significant ones.
  const S = stories.map((s) => { const a = analysis.analyze({ title: s.title, summary: s.summary || "" }); return { id: s.id, title: s.title, url: s.url, sources: s.sources, significance: a.significance }; })
    .sort((a, b) => b.significance - a.significance);
  const top = S.slice(0, 4).map((s) => ({ ...s, n: ref({ type: "story", title: s.title, url: s.url, trace: `story:${s.id}`, note: `significance ${s.significance}; ${s.sources.join(", ") || "one source"}` }) }));
  const sourceCount = new Set(S.flatMap((s) => s.sources)).size;

  // People and organisations: mention counts only.
  const count = (kind) => { const c = {}; for (const e of docEdges) if (e.rel === "mentions" && e.dst.startsWith(`${kind}:`)) c[e.dst.slice(kind.length + 1)] = (c[e.dst.slice(kind.length + 1)] || 0) + 1;
    for (const s of stories) for (const e of s.entities) if (e.kind === kind) c[e.entity] = (c[e.entity] || 0) + 1; return c; };
  const label = (list, id) => (list.find((x) => x.id === id) || {}).label || id;
  const people = Object.entries(count("person")).map(([id, n]) => ({ id, label: label(ontology.people || [], id), mentions: n })).sort((a, b) => b.mentions - a.mentions).slice(0, 8);
  const orgs = Object.entries(count("org")).map(([id, n]) => ({ id, label: label(ontology.organizations || [], id), mentions: n })).sort((a, b) => b.mentions - a.mentions).slice(0, 8);

  // How strong is the evidence? Rule-based and stated, so it can be argued with.
  const supported = checks.filter((c) => c.supported).length;
  // Only toy checks that test an idea from one of the credible (High) papers count toward the rating (T042); general
  // checks on the topic, and checks of papers that aren't credible, are reported but don't lift it. We judge from
  // abstracts and toy experiments, so the top rating is "some support", never "strong" or "proven".
  const linked = checks.filter((c) => c.supported && c.tests === "credible").length, linkedOther = checks.filter((c) => c.supported && c.tests === "not credible").length;
  const strength = credible.length >= 2 && linked >= 1 ? "some support" : credible.length >= 1 ? "early" : P.length ? "thin" : "none yet";
  const notCounted = [...(borderline.length ? [`${pl(borderline.length, "borderline paper")} (credibility ${lo} to ${hi - 1}) not counted`] : []),
    ...(linkedOther ? [`${pl(linkedOther, "toy check")} of a paper that isn't credible not counted`] : [])];
  const why = (strength === "some support" ? `${pl(credible.length, "credible primary paper")} (judged from their abstracts) and ${pl(linked, "toy check")} of their ideas that held up`
    : strength === "early" ? `${pl(credible.length, "credible primary paper")}, and ${linked ? `${pl(linked, "toy check")} of their ideas that held up` : "no toy check of their ideas has held up yet"}`
    : strength === "thin" ? `reviewed papers, none both primary and credible (credibility ${hi} or more)` : "nothing reviewed on this topic yet")
    + (strength !== "none yet" && notCounted.length ? `; ${notCounted.join(", ")}` : "");
  const weak = [
    ...P.filter((p) => p.unbacked > 0).map((p) => ({ text: `${p.title}: ${pl(p.unbacked, "claim")} with no number, sample or interval in the same sentence`, n: p.n })),
    ...P.filter((p) => p.needsPerson && !p.personLabel).map((p) => ({ text: `${p.title}: the guards sent it to a person, who hasn't looked yet`, n: p.n })),
    ...checks.filter((c) => !c.supported).map((c) => ({ text: `Our toy check "${c.title}" did not support its hypothesis`, n: c.n })),
  ].slice(0, 8);

  // Buzz: how loudly the topic is talked about, kept apart from the evidence rating above (it never changes it).
  const talk = SRC.buzz({ stories: stories.map((x) => ({ at: x.at, kinds: x.kinds || [] })), articles: P.filter((p) => p.kind !== "paper").concat(comments.map((c) => ({ at: c.created_at, hype: ((c.result.judges || []).find((j) => j.id === "hype") || {}).score }))), strength, at });
  // Where the reviewed pieces come from, by grade.
  const grades = SRC.GRADES.map((g) => ({ grade: g, count: P.filter((p) => p.grade === g).length })).filter((g) => g.count);
  // Dated forecasts made about the topic, nearest first; a person marks each as happened or not once it's due.
  const forecasts = events.map((e) => ({ id: e.id, qid: e.qid, sentence: e.sentence, due: e.due, status: e.status, outlet: e.outlet_label, overdue: e.status === "pending" && e.due < at,
    n: (P.find((p) => p.qid === e.doc_qid) || {}).n })).slice(0, 12);
  return { topic, label: topicLabel(topic), ids, strength, why, at, buzz: talk, grades, forecasts,
    counts: { papers: P.length, primary: primary.length, surveys: P.filter((p) => p.survey).length, credible: credible.length, borderline: borderline.length, comments: comments.length, stories: S.length, sources: sourceCount, checks: checks.length, supported, linked, linkedOther },
    meanCredibility: Math.round(mean(P.map((p) => p.credibility))), papers: P, borderline: borderline.map((p) => ({ id: p.id, title: p.title, url: p.url, credibility: p.credibility, n: p.n })), credibleAt: { cutoff: B.CREDIBLE_AT, margin: B.MARGIN, from: hi }, checks, top, corroboration: corroboration.slice(0, 8), contested, people, orgs,
    comments: { count: comments.length, verdicts: comments.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] || 0) + 1), a), {}) }, weak, refs };
}

// ---------- outputs ----------
const cite = (...ns) => ns.filter(Boolean).map((n) => `[${n}]`).join("");
function blog(d, site = "") {
  const c = d.counts, L = [];
  L.push(`# ${d.label}: what the evidence says (${d.at})`, "");
  L.push(`**In one line:** the evidence on ${d.label}: **${d.strength}**, ${d.why}.`, "");
  L.push(`We reviewed ${pl(c.papers, "paper or article", "papers and articles")} from their abstracts (${pl(c.surveys, "survey")}), ${pl(c.stories, "feed story", "feed stories")} from ${pl(c.sources, "source")}, ${pl(c.comments, "reader comment")}, and ran ${pl(c.checks, "toy experiment")} of our own. Every judgement below links to its source; numbers in brackets are references.`, "");
  if (d.papers.length) {
    L.push("## What the papers say", "");
    for (const p of d.papers.slice(0, 6)) L.push(`- **${p.title}** ${cite(p.n)}: ${p.verdict}, credibility ${p.credibility}/100${p.survey ? " (a survey)" : p.band === "border" ? " (borderline)" : ""}; ${p.claims ? `${p.backed} of ${pl(p.claims, "headline claim")} carry their own evidence` : "no headline claims detected"}.${p.strongest ? ` Its best-supported claim: "${p.strongest.slice(0, 160)}${p.strongest.length > 160 ? "…" : ""}"` : ""}`);
    L.push("");
  }
  if (d.borderline.length) {
    L.push("## Borderline papers", "", `Credibility within ${d.credibleAt.margin} of ${d.credibleAt.cutoff}: one evidence marker more or less could move them across, so they are not counted as credible (that needs ${d.credibleAt.from} or more).`, "");
    for (const p of d.borderline) L.push(`- **${p.title}** ${cite(p.n)}: credibility ${p.credibility}/100.`);
    L.push("");
  }
  if (d.checks.length) {
    L.push("## What we checked ourselves", "", "Small deterministic experiments that test an idea's logic, not a paper's numbers:", "");
    for (const x of d.checks) L.push(`- **${x.title}** ${cite(x.n)}${x.source ? ` (idea from ${x.source.title}${x.tests === "not credible" ? ", a paper we don't count as credible" : ""})` : ""}: ${x.text.replace(/^(Supported|Not supported) at toy scale: /, "").replace(/\.$/, "")}: ${x.supported ? "supported" : "not supported"} at toy scale.`);
    L.push("");
  }
  const talk = d.papers.filter((x) => x.kind !== "paper");
  if (d.buzz) {
    L.push("## The buzz versus the evidence", "", `**Buzz: ${d.buzz.level}** (${pl(d.buzz.items, "item")} in the last ${d.buzz.days} days: ${pl(d.buzz.stories, "news, blog or forum story", "news, blog or forum stories")} and ${pl(d.buzz.articles, "reviewed article or comment", "reviewed articles and comments")}${d.buzz.hype != null ? `, average hype ${d.buzz.hype}/100` : ""}). **Evidence: ${d.strength}.** So the topic is ${d.buzz.gap}. Buzz is counted separately and never changes the evidence rating.`, "");
    for (const p of talk.slice(0, 6)) L.push(`- **${p.title}** ${cite(p.n)}: source grade ${p.grade || "?"}, hype ${p.hype ?? "?"}/100, ${p.verdict}.`);
    if (talk.length) L.push("");
  }
  if (d.forecasts && d.forecasts.length) {
    L.push("## Forecasts on the record", "", "Dated predictions in the pieces above, as events. A person marks each one as happened or not once it's due; outlets build a track record from them. Names of watched people are removed: we don't attribute forecasts to people.", "");
    for (const f of d.forecasts.slice(0, 6)) L.push(`- Due ${f.due}${f.overdue ? " (overdue, needs a person to resolve)" : ""}: "${f.sentence}" ${cite(f.n)}, from ${f.outlet}; ${f.status}.`);
    L.push("");
  }
  if (d.top.length) { L.push("## In the news", ""); for (const s of d.top) L.push(`- ${s.title} ${cite(s.n)}, significance ${s.significance}/100${s.sources.length > 1 ? `, reported by ${pl(s.sources.length, "source")}` : ""}.`); L.push(""); }
  if (d.contested && d.contested.length) { L.push("## Where papers disagree", "", "Concepts two reviewed papers explain but that we judged far apart; read both before relying on either.", ""); for (const k of d.contested) L.push(`- ${k.name}: "${k.high.title}" ${cite(k.high.n)} (${k.high.verdict}, ${k.high.credibility}) against "${k.low.title}" ${cite(k.low.n)} (${k.low.verdict}, ${k.low.credibility}).`); L.push(""); }
  if (d.corroboration.length) { L.push("## Where papers agree", ""); for (const k of d.corroboration.slice(0, 5)) L.push(`- ${k.name}: ${k.papers >= 2 ? `explained by ${k.papers} reviewed papers (corroborated)` : "explained by one reviewed paper (single source)"}.`); L.push(""); }
  if (d.weak.length) { L.push("## Where the evidence is thin", ""); for (const w of d.weak) L.push(`- ${w.text} ${cite(w.n)}.`); L.push(""); }
  if (d.people.length || d.orgs.length) {
    L.push("## Who is being talked about", "", "Mentions in the papers and stories above, counted. A mention is not an endorsement, and we don't attribute claims to anyone.", "");
    if (d.orgs.length) L.push(`- Organisations: ${d.orgs.map((o) => `${o.label} (${o.mentions})`).join(", ")}`);
    if (d.people.length) L.push(`- Watched people: ${d.people.map((p) => `${p.label} (${p.mentions})`).join(", ")}`);
    L.push("");
  }
  L.push("## How we judged", "", "Each paper, article and comment went through the Review desk: three explainable judges (significance, rigor, hype) behind guards that stop repetition, keyword lists, unbacked frontier claims, name-dropping and text addressed to the judge from raising a score. The judges are benchmarked on labelled test data, and a change that makes them worse is refused. Toy experiments are deterministic and rerun in the Lab.", "");
  L.push("## References", "");
  d.refs.forEach((r, i) => L.push(`${i + 1}. [${r.title}](${r.url.startsWith("/") ? `${site}${r.url}` : r.url}): ${r.type}, ${r.note}. Trace: \`${r.trace}\``));
  L.push("", "---", `Draft from the Superintelligence Homepage research layer${site ? ` (${site}/m/dossier#${d.topic})` : ""}. A person reviews and publishes it; nothing is posted automatically.`, "");
  return L.join("\n");
}
const fit = (parts, max) => { let out = ""; for (const p of parts.filter(Boolean)) { const next = out ? `${out} ${p}` : p; if (next.length <= max) out = next; } return out || parts[0].slice(0, max - 1) + "…"; };
function posts(d, link = "") {
  const best = d.papers.find((p) => !p.survey) || d.papers[0];
  const check = d.checks.find((c) => c.supported && c.tests === "credible") || d.checks.find((c) => c.supported) || d.checks[0];
  const base = `${d.label}: the evidence is ${d.strength === "some support" ? "showing some support" : d.strength} (${d.why}).`;
  const one = best ? ` Most credible paper by our reading of its abstract: "${best.title}" (${best.credibility}/100).` : "";
  const two = check ? ` Our toy check: ${check.title}, ${check.supported ? "supported" : "not supported"}.` : "";
  const border = d.borderline.length ? ` Borderline, not counted as credible: ${d.borderline.slice(0, 2).map((p) => `"${p.title}" (${p.credibility}/100)`).join(", ")}${d.borderline.length > 2 ? ` and ${d.borderline.length - 2} more` : ""}.` : "";
  return [
    { channel: "LinkedIn", text: `${base}${one}${two}${border}\n\nEvery claim is sourced and traced: ${pl(d.refs.length, "reference")}.${link ? `\n\n${link}` : ""}` },
    // Short posts keep whole sentences: drop the extra sentence rather than cut one off mid-quote.
    { channel: "Bluesky / Threads / Mastodon", text: fit([base, one.trim(), border.trim()], 280 - (link ? link.length + 1 : 0)) + (link ? ` ${link}` : "") },
    { channel: "Substack note", text: `${base}${two}${border}${link ? ` ${link}` : ""}` },
  ];
}
function storyboard(d) {
  const sc = [{ kind: "title", text: d.label, sub: `what the evidence says, ${d.at}`, seconds: 3 },
    { kind: "say", text: `The evidence: ${d.strength}. ${d.why[0].toUpperCase()}${d.why.slice(1)}.`, seconds: 6 }];
  if (d.papers.length) sc.push({ kind: "bars", title: "Reviewed papers, by credibility", bars: d.papers.slice(0, 6).map((p) => ({ label: p.title.length > 54 ? `${p.title.slice(0, 52)}…` : p.title, value: p.credibility, note: p.verdict })), seconds: 8 });
  if (d.checks.length) sc.push({ kind: "say", kicker: "Our own checks", text: `We tested ${pl(d.checks.length, "idea")} ourselves in small experiments: ${d.checks.filter((c) => c.supported).length} held up, ${d.checks.filter((c) => !c.supported).length} didn't.`, seconds: 6 });
  if (d.corroboration.length) sc.push({ kind: "graph", center: d.label, nodes: d.corroboration.slice(0, 6).map((k) => ({ name: k.name, label: k.papers >= 2 ? `${k.papers} papers agree` : "one paper" })), seconds: 6 });
  if (d.weak.length) sc.push({ kind: "say", small: true, kicker: "Where it's thin", text: `${d.weak.slice(0, 2).map((w) => w.text).join(". ")}.`, seconds: 7 });
  sc.push({ kind: "say", small: true, kicker: "Sources", text: `${pl(d.refs.length, "source")}, each traced to its record. Read them in the post.`, seconds: 4 });
  return { id: `dossier-${d.topic}`, title: `${d.label}: the evidence`, scenes: sc };
}

module.exports = { gather, analyse, blog, posts, storyboard, topicLabel };
