// Research site pages and feed, rendered on the server as plain HTML and RSS 2.0 (pure functions, unit-tested).
// The write-ups explain one reviewed paper, or one topic's evidence, in plain words, with every judgement traced to
// its record. They are drafts judged from abstracts, so each page carries a "Research preview" tag and noindex.
const esc = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" }[c]));
const pl = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Which reviews go out: papers and articles (not comments) that weren't judged doubtful and weren't sent to a person,
// unless a person agreed with the verdict; never one a person disagreed with.
function publishable(row) {
  if (row.kind === "comment" || row.label === "disagree") return false;
  if (row.label === "agree") return true;
  return row.verdict !== "doubtful" && !row.needs_person;
}

// One plain-language paragraph on how far to believe it, built only from the review's own judges.
function plain(row, r) {
  const rig = (r.judges || []).find((j) => j.id === "rigor") || { why: [], missing: [] };
  const has = rig.why.filter((w) => w.points > 0).map((w) => w.factor.toLowerCase());
  const miss = (rig.missing || []).map((m) => m.toLowerCase());
  const claims = r.claims || [], backed = claims.filter((c) => c.level === "backed").length;
  const paper = (row.kind || r.kind) === "paper", src = paper ? "the abstract" : "the text";
  const what = r.survey ? "a survey, so it is judged on how much ground it covers rather than on experiments of its own"
    : paper ? `${r.type ? `an ${r.type.label.toLowerCase()}` : "a paper"} (${(r.evidence && r.evidence.label) || "unreviewed"})`
    : `${row.kind === "comment" ? "a comment" : "an article"}${r.source ? ` from ${r.source.outlet.personal ? "a personal blog or newsletter" : r.source.outlet.label}, source grade ${r.source.grade}` : ""}`;
  const s = [`This is ${what}. Our verdict from ${src}: ${row.verdict}, credibility ${row.credibility} out of 100.`];
  if (has.length) s.push(`It ${has.slice(0, 4).join(", ")}${has.length > 4 ? `, and ${pl(has.length - 4, "more check")}` : ""}.`);
  if (miss.length) s.push(paper ? `The abstract doesn't show that it ${miss.slice(0, 3).join(", ")}; the full paper may.` : `It doesn't show that it ${miss.slice(0, 3).join(", ")}.`);
  if (claims.length) s.push(`Headline claims backed in their own sentence: ${backed} of ${claims.length}.`);
  return s.join(" ");
}

const LEVEL = { backed: "backed in the same sentence", "partly backed": "backed by a neighbouring sentence", unbacked: "nothing backing it" };
const { CRITERIA, VERDICTS } = require("../review/review");

// The scorecard: every published criterion, whether this text met it and the points it earned, then the arithmetic
// from rigor and hype to credibility and the verdict rule that applied. Nothing on it is hidden or extra.
function scorecard(row, r) {
  const J = Object.fromEntries((r.judges || []).map((j) => [j.id, j]));
  const rig = J.rigor || { score: 0, why: [] }, hp = J.hype || { score: 0, why: [] };
  const list = r.rubric === "reporting" ? CRITERIA.reporting.checks : r.survey ? CRITERIA.survey.checks : CRITERIA.rigor.checks;
  const got = Object.fromEntries((rig.why || []).map((w) => [w.factor, w]));
  const rows = list.map((c) => { const w = got[c.label]; return `<tr class="${w ? "met" : ""}"><td class="mk">${w ? "✓" : "–"}</td><td>${esc(c.label)}${w && w.detail ? `<span class="ev">${esc(w.detail)}${w.detail.length >= 140 ? "…" : ""}</span>` : ""}</td><td class="n">${w ? w.points : 0} / ${c.points}</td></tr>`; }).join("");
  const unb = (hp.why || []).find((w) => w.factor === "Unbacked claims") || {}, words = (hp.why || []).find((w) => w.factor === "Hype words") || {};
  const v = VERDICTS.find((x) => x.id === row.verdict);
  return `<section><h2>How it was judged</h2>
<p class="small muted" style="margin:0 0 8px">${esc(r.rubric === "reporting" ? CRITERIA.reporting.about : r.survey ? CRITERIA.survey.about : CRITERIA.rigor.about)} <a href="/research/criteria">All criteria</a></p>
<table class="card sc"><tbody>${rows}<tr class="tot"><td></td><td>Rigor</td><td class="n">${rig.score} / 100</td></tr></tbody></table>
<dl class="sum">
<dt>Hype</dt><dd>${hp.score} (lower is better): ${unb.detail && !/^0 of 0/.test(unb.detail) ? `${esc(unb.detail)} claims unbacked` : "no claims found"}${words.detail ? `; hype words: ${esc(words.detail)}` : "; no hype words"}</dd>
<dt>Credibility</dt><dd>½ × ${rig.score} + ½ × (100 − ${hp.score}) = <b>${row.credibility}</b></dd>
<dt>Significance</dt><dd>${row.score}, after the guards (${r.naive ?? row.naive} before)</dd>
<dt>Verdict</dt><dd><b>${esc(row.verdict)}</b>${v ? `, because ${esc(v.rule)}` : ""}</dd>
${r.panel ? `<dt>Panel</dt><dd>${esc(r.panel.status)}: ${r.panel.judges.map((j) => `${esc(j.id === "rules" ? "rules" : j.model)} ${j.credibility}${j.biased && j.biased.length ? " (set aside)" : ""}`).join(", ")}. ${esc(r.panel.rule)}.${r.panel.advice && r.panel.advice.advice ? ` Advisor (${esc(r.panel.advice.model)}): ${esc(r.panel.advice.advice)}` : ""}</dd>` : `<dt>Panel</dt><dd>not run: judged by the rules alone</dd>`}
</dl></section>`;
}

function criteriaPage(base) {
  const tbl = (checks) => `<table class="card"><tbody>${checks.map((c) => `<tr><td>${esc(c.label)}</td><td class="n">${c.points}</td></tr>`).join("")}</tbody></table>`;
  const body = `<h1>How we judge a paper</h1>
<p class="lede">Every write-up is scored by the same published rules, from the abstract, with no model and no hidden weights. Two separate questions: how big a step it reports (significance) and how far to believe it (credibility).</p>
<section><h2>1. Rigor, out of 100</h2><p class="small muted" style="margin:0 0 8px">${esc(CRITERIA.rigor.about)}</p>${tbl(CRITERIA.rigor.checks)}</section>
<section><h2>Surveys instead</h2><p class="small muted" style="margin:0 0 8px">${esc(CRITERIA.survey.about)}</p>${tbl(CRITERIA.survey.checks)}</section>
<section><h2>Articles instead</h2><p class="small muted" style="margin:0 0 8px">${esc(CRITERIA.reporting.about)}</p>${tbl(CRITERIA.reporting.checks)}</section>
<section><h2>2. Claims</h2><p>${esc(CRITERIA.claims.about)}</p></section>
<section><h2>3. Hype, out of 100</h2><p>${esc(CRITERIA.hype.about)}</p></section>
<section><h2>4. Credibility</h2><p>${esc(CRITERIA.credibility.about)}</p></section>
<section><h2>5. Significance</h2><p>${esc(CRITERIA.significance.about)}</p></section>
<section><h2>6. Verdict</h2><p class="small muted" style="margin:0 0 8px">The first rule that holds, top to bottom.</p><table class="card"><tbody>${CRITERIA.verdicts.map((v) => `<tr><td><b>${esc(v.id)}</b></td><td>${esc(v.rule)}</td></tr>`).join("")}</tbody></table></section>
<section><h2>7. Source grade, A to E</h2><p class="small muted" style="margin:0 0 8px">${esc(CRITERIA.source.about)}</p><table class="card"><tbody>${CRITERIA.source.outlets.map((o) => `<tr><td><b>${esc(o.grade)}</b></td><td>${esc(o.label)}<span class="ev">${esc(o.why)}</span></td></tr>`).join("")}</tbody></table></section>
<section><h2>8. Forecasts</h2><p>${esc(CRITERIA.forecasts.about)}</p></section>
<section><h2>9. Buzz</h2><p>${esc(CRITERIA.buzz.about)}</p></section>
<section><h2>10. Two-model panel and bias masking</h2><p>${esc(CRITERIA.panel.about)}</p></section>
<section><h2>Guards against gaming</h2><ul>${CRITERIA.guards.map((g) => `<li>${esc(g.label)}</li>`).join("")}</ul></section>
<section><h2>When a person looks</h2><p>${esc(CRITERIA.person.about)} Doubtful items and anything a person disagreed with are never published here.</p></section>`;
  return shell({ title: "How we judge", base, body, desc: "The published criteria behind every research write-up." });
}

function shell({ title, base, body, desc = "" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(title)} · Superintelligence research (preview)</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ""}<link rel="stylesheet" href="/css/app.css">
<link rel="alternate" type="application/rss+xml" title="Superintelligence research write-ups" href="${esc(base)}/research/feed.xml">
<style>
  .rx { max-width: 760px; margin: 0 auto; display: grid; gap: 18px; }
  .rx .flag { justify-self: start; font-size: var(--fs-xs, 12px); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 2px 8px; border: 1px solid var(--fg); border-radius: var(--radius); }
  .rx h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px, 5vw, 36px); line-height: 1.15; margin: 0; overflow-wrap: anywhere; }
  .rx .lede { font-size: var(--fs-md, 18px); line-height: 1.6; margin: 0; }
  .rx h2 { font-size: var(--fs-base, 16px); font-weight: 600; margin: 0 0 8px; }
  .rx section { border-top: 1px solid var(--line); padding-top: 14px; }
  .rx ul, .rx ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: var(--fs-base, 16px); line-height: 1.5; }
  .rx .lv { font-size: var(--fs-xs, 12px); color: var(--muted); white-space: nowrap; }
  .rx table.card { width: 100%; border-collapse: collapse; font-size: var(--fs-sm, 13px); } .rx table.card th { text-align: left; font-weight: 500; color: var(--muted); font-size: var(--fs-xs, 12px); padding: 0 8px 6px 0; } .rx table.card th.n { text-align: right; }
  .rx table.card td { padding: 7px 8px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .rx table.card td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; } .rx table.card td.mk { width: 1.5em; color: var(--muted); }
  .rx table.card tr.met td.mk { color: var(--fg); font-weight: 600; } .rx table.sc tr:not(.met):not(.tot) td:nth-child(2) { color: var(--muted); }
  .rx table.card .ev { display: block; font-size: var(--fs-xs, 12px); color: var(--muted); overflow-wrap: anywhere; } .rx table.card tr.tot td { font-weight: 600; border-bottom: 0; }
  .rx dl.sum { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 12px 0 0; font-size: var(--fs-sm, 13px); } .rx dl.sum dt { color: var(--muted); } .rx dl.sum dd { margin: 0; font-variant-numeric: tabular-nums; }
  .rx .duo { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; } .rx .duo p { margin: 8px 0 0; }
  .rx .ladder { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; border: 1px solid var(--fg); border-radius: var(--radius); overflow: hidden; }
  .rx .ladder span { font-size: var(--fs-xs, 12px); text-align: center; padding: 6px 4px; border-left: 1px solid var(--line); color: var(--muted); } .rx .ladder span:first-child { border-left: 0; }
  .rx .ladder span.on { background: var(--fg); color: var(--surface); font-weight: 600; }
  .rx .scroll { overflow-x: auto; }
  .rx .chips { display: flex; flex-wrap: wrap; gap: 6px; } .rx .chips span { font-size: var(--fs-sm, 13px); padding: 2px 8px; border: 1px solid var(--line); border-radius: var(--radius); }
  .rx blockquote { margin: 0; padding-left: 12px; border-left: 2px solid var(--line); color: var(--muted); font-size: var(--fs-sm, 13px); }
  .rx .md p { margin: 0 0 10px; line-height: 1.6; } .rx .md h2 { margin-top: 16px; } .rx .md code { font-size: var(--fs-xs, 12px); }
  .rx .list { display: grid; gap: 0; } .rx .list a.row { display: grid; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
  .rx .list a.row:hover b { text-decoration: underline; } .rx .list .row span { font-size: var(--fs-sm, 13px); color: var(--muted); }
  .rx footer { font-size: var(--fs-sm, 13px); color: var(--muted); border-top: 1px solid var(--line); padding-top: 12px; }
</style></head><body><main class="rx">
<span class="flag">Research preview</span>
${body}
<footer>Judged by rules from the abstract, not by a person and not by a model: a draft to read alongside the paper, not instead of it. Real people appear only as mention counts. <a href="${esc(base)}/research/criteria">How we judge</a> · <a href="${esc(base)}/research/outlets">Track records</a> · <a href="${esc(base)}/research/data.json">Open data</a> · <a href="${esc(base)}/research">All write-ups</a> · <a href="${esc(base)}/research/feed.xml">RSS</a></footer>
</main></body></html>`;
}

function paperPage(row, base) {
  const r = typeof row.result === "string" ? JSON.parse(row.result || "{}") : row.result || {};
  const J = Object.fromEntries((r.judges || []).map((j) => [j.id, j]));
  const topics = (r.tags || []).filter((t) => t.qid && t.qid.startsWith("topic:") && !t.via);
  const fired = (r.guards || []).filter((g) => g.fired);
  const body = `<h1>${esc(row.title)}</h1>
${row.authors ? `<p class="small muted" style="margin:0">${esc(row.authors)}</p>` : ""}
<p class="lede">${esc(plain(row, r))}</p>
${scorecard(row, r)}
${(r.claims || []).length ? `<section><h2>What it claims</h2><ul>${r.claims.slice(0, 6).map((c) => `<li>${esc(c.sentence)} <span class="lv">(${esc(LEVEL[c.level] || c.level)})</span></li>`).join("")}</ul></section>` : ""}
${fired.length || (J.rigor && J.rigor.missing && J.rigor.missing.length) ? `<section><h2>What to keep in mind</h2><ul>${fired.map((g) => `<li>${esc(g.label)}: ${esc(g.detail)}</li>`).join("")}${(J.rigor && J.rigor.missing ? J.rigor.missing : []).map((m) => `<li>Not shown${row.kind === "paper" ? " in the abstract" : ""}: ${esc(m.toLowerCase())}</li>`).join("")}</ul></section>` : ""}
${r.source ? `<section><h2>Source grade: ${esc(r.source.grade)}</h2><ul>${r.source.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></section>` : ""}
${(r.forecasts || []).length ? `<section><h2>Forecasts in it</h2><p class="small muted" style="margin:0 0 8px">Dated predictions, tracked as events and marked by a person once due.</p><ul>${r.forecasts.map((f) => `<li>${esc(f.sentence)} <span class="lv">(due ${esc(f.due)})</span></li>`).join("")}</ul></section>` : ""}
${topics.length ? `<section><h2>Where it fits</h2><div class="chips">${topics.map((t) => `<span><a href="${esc(base)}/research/topic/${esc(t.qid.slice(6))}">${esc(t.label)}</a></span>`).join("")}</div></section>` : ""}
<section><h2>Source</h2>${row.excerpt ? `<blockquote>${esc(row.excerpt)}${row.excerpt.length >= 400 ? "…" : ""}</blockquote>` : ""}
<p class="small" style="margin:8px 0 0">${row.url ? `<a href="${esc(row.url)}" rel="noopener">${row.kind === "paper" ? "Read the paper" : "Read the original"}</a> · ` : ""}${r.code ? `<a href="${esc(r.code)}" rel="noopener">Code</a> · ` : ""}Trace <code>${esc(row.qid)}</code>, reviewed ${esc(String(row.created_at || "").slice(0, 10))}</p></section>`;
  return shell({ title: row.title, base, body, desc: plain(row, r) });
}

// Server-side Markdown for the dossier blog draft: headings, lists, bold, code, safe links (same subset as the page).
function md(text) {
  const inline = (s) => esc(s.replace(/\[([^\]]+)\]\(\)/g, "$1")).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  const out = []; let list = null;
  for (const line of String(text).split("\n")) {
    const m = line.match(/^(#{1,3}) (.*)/), b = line.match(/^- (.*)/), n = line.match(/^\d+\. (.*)/);
    if ((b && list !== "ul") || (n && list !== "ol") || (!b && !n && list)) { if (list) out.push(`</${list}>`); list = b ? "ul" : n ? "ol" : null; if (list) out.push(`<${list}>`); }
    if (m) { if (m[1].length > 1) out.push(`<h2>${inline(m[2])}</h2>`); } else if (b || n) out.push(`<li>${inline((b || n)[1])}</li>`); else if (line.trim() && line.trim() !== "---") out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`</${list}>`); return out.join("");
}

const ladder = (steps, on) => `<div class="ladder" role="img" aria-label="${esc(on)} on a scale of ${esc(steps.join(", "))}">${steps.map((x) => `<span class="${x === on ? "on" : ""}">${esc(x)}</span>`).join("")}</div>`;
function topicPage(d, blogMd, base) {
  const body = `<h1>${esc(d.label)}: what the evidence says</h1>
<p class="lede">The evidence is rated <b>${esc(d.strength)}</b>: ${esc(d.why)}.${d.buzz ? ` The talk around it is <b>${esc(d.buzz.level)}</b>, so it is ${esc(d.buzz.gap)}.` : ""}</p>
<section class="duo"><div><h2>Evidence</h2>${ladder(["none yet", "thin", "early", "some support"], d.strength)}<p class="small muted">From reviewed papers and our own toy checks. Nothing rates higher than "some support": papers are judged from their abstracts.</p></div>
${d.buzz ? `<div><h2>Buzz</h2>${ladder(["quiet", "some", "loud"], d.buzz.level)}<p class="small muted">${d.buzz.items} items in ${d.buzz.days} days${d.buzz.hype != null ? `, average hype ${d.buzz.hype}/100` : ""}. Counted apart; it never changes the evidence rating.</p></div>` : ""}</section>
<section class="md">${md(String(blogMd).split("\n").filter((l) => !/^Draft from the /.test(l)).join("\n"))}</section>`;
  return shell({ title: `${d.label}: the evidence`, base, body, desc: `${d.label}: ${d.strength}, ${d.why}.` });
}

// Outlet track records: grades of the pieces reviewed, and forecasts made and how they turned out. Personal blogs and
// newsletters appear as one pooled class, never by writer; a hit rate shows only from 3 resolved forecasts.
function outletsPage(records, minResolved, base) {
  const rows = records.map((o) => `<tr><td>${esc(o.label)}${o.personal ? '<span class="ev">pooled: no writer is tracked</span>' : ""}</td><td class="n">${o.base || "?"}</td><td class="n">${o.pieces}</td><td class="n">${o.meanCredibility}</td><td class="n">${o.forecasts}</td><td class="n">${o.happened} / ${o.didNot} / ${o.pending}</td><td class="n">${o.hitRate == null ? "–" : `${Math.round(o.hitRate * 100)}%`}</td><td class="n">${o.brier == null ? "–" : o.brier.toFixed(2)}</td></tr>`).join("");
  const body = `<h1>Who has been right</h1>
<p class="lede">Each outlet's reviewed pieces and the dated forecasts they made, marked by a person once due. A hit rate appears only after ${minResolved} forecasts are resolved, and a Brier score (0 is perfect, 0.25 is always saying 50%) only after ${minResolved} resolved forecasts that stated a probability.</p>
<section><h2>Track records</h2>${records.length ? `<div class="scroll"><table class="card"><thead><tr><th>Outlet</th><th class="n">Grade</th><th class="n">Pieces</th><th class="n">Mean credibility</th><th class="n">Forecasts</th><th class="n">Happened / not / pending</th><th class="n">Hit rate</th><th class="n">Brier</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="small muted">Nothing reviewed yet.</p>'}
<p class="small muted" style="margin:8px 0 0">Grade = the outlet's starting grade (<a href="${esc(base)}/research/criteria">criteria</a>). "Unclear" forecasts count for neither side. Forecasts never carry a person's name.</p></section>`;
  return shell({ title: "Track records", base, body, desc: "Outlets' reviewed pieces and forecast track records." });
}

function indexPage({ papers, topics }, base) {
  const body = `<h1>Superintelligence research, explained</h1>
<p class="lede">Plain-language write-ups of papers on the path to superintelligence: what each claims, how far to believe it and why, traced to its record. Each one also goes out as an item in <a href="${esc(base)}/research/feed.xml">this RSS feed</a>, so a news feed can carry it as one more source.</p>
${topics.length ? `<section><h2>Topics</h2><div class="list">${topics.map((t) => `<a class="row" href="${esc(base)}/research/topic/${esc(t.topic)}"><b>${esc(t.label)}</b><span>${esc(t.strength)}: ${esc(t.why)}</span></a>`).join("")}</div></section>` : ""}
<section><h2>Papers</h2>${papers.length ? `<div class="list">${papers.map((p) => `<a class="row" href="${esc(base)}/research/paper/${p.id}"><b>${esc(p.title)}</b><span>${esc(p.verdict)}, credibility ${p.credibility}</span></a>`).join("")}</div>` : '<p class="small muted">Nothing reviewed yet.</p>'}</section>`;
  return shell({ title: "Write-ups", base, body });
}

// RSS 2.0. Each paper item keeps the paper's own title, so a feed reader that groups stories by title puts the
// write-up next to the paper's other sources instead of making a second story.
function feedXml({ papers, topics }, base) {
  const x = (s) => esc(s).replace(/&#39;/g, "&apos;");
  // Rigor rides each item as RSS <category> elements with a "si:" domain (verdict, credibility, source grade, panel
// status, evidence rating), so a reader that knows them can show a badge and any other reader ignores them.
  const cats = (c) => Object.entries(c).filter(([, v]) => v != null && v !== "").map(([k, v]) => `<category domain="si:${k}">${x(String(v))}</category>`).join("");
  const item = (title, link, guid, date, text, c = {}) => `<item><title>${x(title)}</title>${cats(c)}<link>${x(link)}</link><guid isPermaLink="false">${x(guid)}</guid>${date ? `<pubDate>${new Date(date).toUTCString()}</pubDate>` : ""}<description>${x(text)}</description></item>`;
  const R = (p) => (typeof p.result === "string" ? JSON.parse(p.result || "{}") : p.result || {});
  const items = [
    ...papers.map((p) => item(p.title, `${base}/research/paper/${p.id}`, `si-research-${p.qid}`, p.created_at, plain(p, R(p)), { verdict: p.verdict, credibility: p.credibility, grade: (R(p).source || {}).grade, panel: (R(p).panel || {}).status || "none", code: R(p).code })),
    ...topics.map((t) => item(`${t.label}: what the evidence on this superintelligence topic says`, `${base}/research/topic/${t.topic}`, `si-research-topic:${t.topic}`, t.at, `Rated ${t.strength}: ${t.why}.`, { evidence: t.strength })),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Superintelligence research write-ups (preview)</title><link>${x(base)}/research</link><description>Plain-language, traced write-ups of papers on the path to superintelligence. Judged from abstracts by rules; a preview.</description>${items}</channel></rss>`;
}

// Open data: every publishable judgement as JSON, the way evaluation hubs publish their results, so anyone can check or
// reuse them. Titles, links, scores and rules only; excerpts stay on the pages; forecasts carry no names.
function dataJson({ papers, topics }, base) {
  const R = (p) => (typeof p.result === "string" ? JSON.parse(p.result || "{}") : p.result || {});
  return { about: "Judgements of the Superintelligence Homepage research layer (preview): rule-based, from abstracts and paraphrases. Criteria: " + base + "/research/criteria", generated: new Date().toISOString(),
    pieces: papers.map((p) => { const r = R(p), J = Object.fromEntries((r.judges || []).map((j) => [j.id, j])); return { id: p.qid, title: p.title, url: p.url || null, kind: p.kind, reviewed: String(p.created_at || "").slice(0, 10),
      verdict: p.verdict, verdictRule: r.verdictRule || null, credibility: p.credibility, significance: p.score, rigor: (J.rigor || {}).score ?? null, hype: (J.hype || {}).score ?? null, rubric: r.rubric || null,
      grade: (r.source || {}).grade || null, outlet: r.source && !r.source.outlet.personal ? r.source.outlet.label : r.source ? "personal blogs and newsletters (pooled)" : null, code: r.code || null,
      panel: (r.panel || {}).status || "none", forecasts: (r.forecasts || []).map((f) => ({ id: f.qid, due: f.due, sentence: f.sentence })), writeup: `${base}/research/paper/${p.id}` }; }),
    topics: topics.map((t) => ({ id: t.topic, label: t.label, evidence: t.strength, why: t.why, page: `${base}/research/topic/${t.topic}` })) };
}

module.exports = { dataJson, outletsPage, scorecard, criteriaPage, publishable, plain, paperPage, topicPage, indexPage, feedXml, md };
