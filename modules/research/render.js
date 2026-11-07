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
  const what = r.survey ? "a survey, so it is judged on how much ground it covers rather than on experiments of its own" : `${r.type ? `an ${r.type.label.toLowerCase()}` : "a paper"} (${(r.evidence && r.evidence.label) || "unreviewed"})`;
  const s = [`This is ${what}. Our verdict from the abstract: ${row.verdict}, credibility ${row.credibility} out of 100.`];
  if (has.length) s.push(`It ${has.slice(0, 4).join(", ")}${has.length > 4 ? `, and ${pl(has.length - 4, "more check")}` : ""}.`);
  if (miss.length) s.push(`The abstract doesn't show that it ${miss.slice(0, 3).join(", ")}; the full paper may.`);
  if (claims.length) s.push(`${backed} of its ${pl(claims.length, "headline claim")} ${backed === 1 ? "carries its" : "carry their"} own evidence in the same sentence.`);
  return s.join(" ");
}

const LEVEL = { backed: "backed in the same sentence", "partly backed": "backed by a neighbouring sentence", unbacked: "nothing backing it" };
const { CRITERIA, VERDICTS } = require("../review/review");

// The scorecard: every published criterion, whether this text met it and the points it earned, then the arithmetic
// from rigor and hype to credibility and the verdict rule that applied. Nothing on it is hidden or extra.
function scorecard(row, r) {
  const J = Object.fromEntries((r.judges || []).map((j) => [j.id, j]));
  const rig = J.rigor || { score: 0, why: [] }, hp = J.hype || { score: 0, why: [] };
  const list = r.survey ? CRITERIA.survey.checks : CRITERIA.rigor.checks;
  const got = Object.fromEntries((rig.why || []).map((w) => [w.factor, w]));
  const rows = list.map((c) => { const w = got[c.label]; return `<tr class="${w ? "met" : ""}"><td class="mk">${w ? "✓" : "–"}</td><td>${esc(c.label)}${w && w.detail ? `<span class="ev">${esc(w.detail)}${w.detail.length >= 140 ? "…" : ""}</span>` : ""}</td><td class="n">${w ? w.points : 0} / ${c.points}</td></tr>`; }).join("");
  const unb = (hp.why || []).find((w) => w.factor === "Unbacked claims") || {}, words = (hp.why || []).find((w) => w.factor === "Hype words") || {};
  const v = VERDICTS.find((x) => x.id === row.verdict);
  return `<section><h2>How it was judged</h2>
<p class="small muted" style="margin:0 0 8px">${esc(r.survey ? CRITERIA.survey.about : CRITERIA.rigor.about)} <a href="/research/criteria">All criteria</a></p>
<table class="card sc"><tbody>${rows}<tr class="tot"><td></td><td>Rigor</td><td class="n">${rig.score} / 100</td></tr></tbody></table>
<dl class="sum">
<dt>Hype</dt><dd>${hp.score} (lower is better): ${esc(unb.detail || "0 of 0")} claims unbacked${words.detail ? `; hype words: ${esc(words.detail)}` : "; no hype words"}</dd>
<dt>Credibility</dt><dd>½ × ${rig.score} + ½ × (100 − ${hp.score}) = <b>${row.credibility}</b></dd>
<dt>Significance</dt><dd>${row.score}, after the guards (${r.naive ?? row.naive} before)</dd>
<dt>Verdict</dt><dd><b>${esc(row.verdict)}</b>${v ? `, because ${esc(v.rule)}` : ""}</dd>
</dl></section>`;
}

function criteriaPage(base) {
  const tbl = (checks) => `<table class="card"><tbody>${checks.map((c) => `<tr><td>${esc(c.label)}</td><td class="n">${c.points}</td></tr>`).join("")}</tbody></table>`;
  const body = `<h1>How we judge a paper</h1>
<p class="lede">Every write-up is scored by the same published rules, from the abstract, with no model and no hidden weights. Two separate questions: how big a step it reports (significance) and how far to believe it (credibility).</p>
<section><h2>1. Rigor, out of 100</h2><p class="small muted" style="margin:0 0 8px">${esc(CRITERIA.rigor.about)}</p>${tbl(CRITERIA.rigor.checks)}</section>
<section><h2>Surveys instead</h2><p class="small muted" style="margin:0 0 8px">${esc(CRITERIA.survey.about)}</p>${tbl(CRITERIA.survey.checks)}</section>
<section><h2>2. Claims</h2><p>${esc(CRITERIA.claims.about)}</p></section>
<section><h2>3. Hype, out of 100</h2><p>${esc(CRITERIA.hype.about)}</p></section>
<section><h2>4. Credibility</h2><p>${esc(CRITERIA.credibility.about)}</p></section>
<section><h2>5. Significance</h2><p>${esc(CRITERIA.significance.about)}</p></section>
<section><h2>6. Verdict</h2><p class="small muted" style="margin:0 0 8px">The first rule that holds, top to bottom.</p><table class="card"><tbody>${CRITERIA.verdicts.map((v) => `<tr><td><b>${esc(v.id)}</b></td><td>${esc(v.rule)}</td></tr>`).join("")}</tbody></table></section>
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
  .rx .flag { justify-self: start; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 2px 8px; border: 1px solid var(--fg); border-radius: var(--radius); }
  .rx h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px, 5vw, 36px); line-height: 1.15; margin: 0; overflow-wrap: anywhere; }
  .rx .lede { font-size: 17px; line-height: 1.6; margin: 0; }
  .rx h2 { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
  .rx section { border-top: 1px solid var(--line); padding-top: 14px; }
  .rx ul, .rx ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 15px; line-height: 1.5; }
  .rx .lv { font-size: 12px; color: var(--muted); white-space: nowrap; }
  .rx table.card { width: 100%; border-collapse: collapse; font-size: 14px; } .rx table.card td { padding: 7px 8px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .rx table.card td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; } .rx table.card td.mk { width: 1.5em; color: var(--muted); }
  .rx table.card tr.met td.mk { color: var(--fg); font-weight: 600; } .rx table.sc tr:not(.met):not(.tot) td:nth-child(2) { color: var(--muted); }
  .rx table.card .ev { display: block; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; } .rx table.card tr.tot td { font-weight: 600; border-bottom: 0; }
  .rx dl.sum { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 12px 0 0; font-size: 14px; } .rx dl.sum dt { color: var(--muted); } .rx dl.sum dd { margin: 0; font-variant-numeric: tabular-nums; }
  .rx .chips { display: flex; flex-wrap: wrap; gap: 6px; } .rx .chips span { font-size: 13px; padding: 2px 8px; border: 1px solid var(--line); border-radius: var(--radius); }
  .rx blockquote { margin: 0; padding-left: 12px; border-left: 2px solid var(--line); color: var(--muted); font-size: 14px; }
  .rx .md p { margin: 0 0 10px; line-height: 1.6; } .rx .md h2 { margin-top: 16px; } .rx .md code { font-size: 12px; }
  .rx .list { display: grid; gap: 0; } .rx .list a.row { display: grid; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
  .rx .list a.row:hover b { text-decoration: underline; } .rx .list .row span { font-size: 13px; color: var(--muted); }
  .rx footer { font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 12px; }
</style></head><body><main class="rx">
<span class="flag">Research preview</span>
${body}
<footer>Judged by rules from the abstract, not by a person and not by a model: a draft to read alongside the paper, not instead of it. Real people appear only as mention counts. <a href="${esc(base)}/research/criteria">How we judge</a> · <a href="${esc(base)}/research">All write-ups</a> · <a href="${esc(base)}/research/feed.xml">RSS</a></footer>
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
${fired.length || (J.rigor && J.rigor.missing && J.rigor.missing.length) ? `<section><h2>What to keep in mind</h2><ul>${fired.map((g) => `<li>${esc(g.label)}: ${esc(g.detail)}</li>`).join("")}${(J.rigor && J.rigor.missing ? J.rigor.missing : []).map((m) => `<li>Not shown in the abstract: ${esc(m.toLowerCase())}</li>`).join("")}</ul></section>` : ""}
${topics.length ? `<section><h2>Where it fits</h2><div class="chips">${topics.map((t) => `<span><a href="${esc(base)}/research/topic/${esc(t.qid.slice(6))}">${esc(t.label)}</a></span>`).join("")}</div></section>` : ""}
<section><h2>Source</h2>${row.excerpt ? `<blockquote>${esc(row.excerpt)}${row.excerpt.length >= 400 ? "…" : ""}</blockquote>` : ""}
<p class="small" style="margin:8px 0 0">${row.url ? `<a href="${esc(row.url)}" rel="noopener">Read the paper</a> · ` : ""}Trace <code>${esc(row.qid)}</code>, reviewed ${esc(String(row.created_at || "").slice(0, 10))}</p></section>`;
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

function topicPage(d, blogMd, base) {
  const body = `<h1>${esc(d.label)}: what the evidence says</h1>
<p class="lede">The evidence is rated <b>${esc(d.strength)}</b>: ${esc(d.why)}. The scale is none yet, thin, early, some support; nothing here rates higher, because papers are judged from their abstracts.</p>
<section class="md">${md(String(blogMd).split("\n").filter((l) => !/^Draft from the /.test(l)).join("\n"))}</section>`;
  return shell({ title: `${d.label}: the evidence`, base, body, desc: `${d.label}: ${d.strength}, ${d.why}.` });
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
  const item = (title, link, guid, date, text) => `<item><title>${x(title)}</title><link>${x(link)}</link><guid isPermaLink="false">${x(guid)}</guid>${date ? `<pubDate>${new Date(date).toUTCString()}</pubDate>` : ""}<description>${x(text)}</description></item>`;
  const items = [
    ...papers.map((p) => item(p.title, `${base}/research/paper/${p.id}`, `si-research-${p.qid}`, p.created_at, plain(p, typeof p.result === "string" ? JSON.parse(p.result || "{}") : p.result || {}))),
    ...topics.map((t) => item(`${t.label}: what the evidence on this superintelligence topic says`, `${base}/research/topic/${t.topic}`, `si-research-topic:${t.topic}`, t.at, `Rated ${t.strength}: ${t.why}.`)),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Superintelligence research write-ups (preview)</title><link>${x(base)}/research</link><description>Plain-language, traced write-ups of papers on the path to superintelligence. Judged from abstracts by rules; a preview.</description>${items}</channel></rss>`;
}

module.exports = { scorecard, criteriaPage, publishable, plain, paperPage, topicPage, indexPage, feedXml, md };
