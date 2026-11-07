// Where a piece comes from and what it forecasts, judged by published rules (pure functions, unit-tested).
//   grade(): an A-E grade for one piece, from its outlet's kind plus what the piece itself shows (primary sources cited,
//            hype, selling its own product). The outlet is a publication, never a person: personal blogs and newsletters
//            are graded as a class ("personal blogs and newsletters"), not as the person who writes them.
//   predictions(): dated forecasts in the text ("by 2028", "within 18 months"), as events with a due date, with any
//            watched person's name replaced, so no forecast is attributed to a real person (CLAUDE.md).
//   buzz(): how loudly a topic is being talked about (commentary, news, forums), kept apart from how strong its evidence
//            is. Buzz never lifts the evidence rating; the gap between the two is the hype signal.
const { ontology } = require("../../lib/tagger");

// Outlet kinds, from most to least checkable. The same kinds as lib/source-catalog.json, plus "commentary" for open
// publishing platforms (Medium, Substack, dev.to) and "vendor" for a company blog selling its product.
const OUTLETS = [
  { kind: "journal", grade: "A", label: "Peer-reviewed journal or proceedings", why: "reviewed by other researchers before publication" },
  { kind: "papers", grade: "B", label: "Preprint (arXiv and paper searches)", why: "methods and numbers in the text, not yet peer reviewed" },
  { kind: "research-org", grade: "B", label: "Research or evaluation organisation", why: "publishes methods and data, but reviews itself" },
  { kind: "academic", grade: "B", label: "University lab or academic blog", why: "written by researchers, usually about their own published work" },
  { kind: "lab", grade: "B", label: "AI lab research blog", why: "first-hand, but the lab is describing its own work" },
  { kind: "news", grade: "C", label: "Newsroom or trade press", why: "edited, but secondhand: reports what others say" },
  { kind: "policy", grade: "C", label: "Policy organisation", why: "analysis and argument more than new evidence" },
  { kind: "newsletter", grade: "C", label: "Expert newsletter", why: "informed commentary, one writer's reading" },
  { kind: "people", grade: "C", label: "A researcher's or writer's own blog", why: "one person's reading, unedited" },
  { kind: "forum", grade: "D", label: "Research forum", why: "anyone can post; quality varies by post" },
  { kind: "community", grade: "D", label: "Community site (Hacker News, Reddit, GitHub)", why: "links and discussion, not evidence" },
  { kind: "commentary", grade: "D", label: "Personal blogs and newsletters on open platforms", why: "anyone can publish; no editing or review" },
  { kind: "vendor", grade: "E", label: "Company blog selling its own product", why: "written to sell, so the framing is not neutral" },
];
const GRADES = ["A", "B", "C", "D", "E"];
const BY_KIND = Object.fromEntries(OUTLETS.map((o) => [o.kind, o]));

// Guessing the outlet kind of a URL nobody catalogued. Hosts only; nothing is fetched.
const HOSTS = [
  [/(^|\.)arxiv\.org$|(^|\.)openreview\.net$|(^|\.)alphaxiv\.org$|(^|\.)semanticscholar\.org$/, "papers"],
  [/(^|\.)(nature|science|jmlr|jair)\.(com|org)$|(^|\.)(icml|neurips|iclr)\.cc$|(^|\.)aclanthology\.org$|(^|\.)doi\.org$/, "journal"],
  [/(^|\.)(lesswrong|alignmentforum|greaterwrong)\.(com|org)$/, "forum"],
  [/(^|\.)(news\.ycombinator\.com|reddit\.com|github\.com)$/, "community"],
  [/(^|\.)medium\.com$|\.substack\.com$|(^|\.)dev\.to$|(^|\.)hashnode\.dev$|\.pages\.dev$|\.blogspot\.com$|(^|\.)wordpress\.com$|(^|\.)towardsdatascience\.com$|(^|\.)generativeai\.pub$|(^|\.)towardsai\.net$/, "commentary"],
  [/(^|\.)(technologyreview\.com|theverge\.com|arstechnica\.com|wired\.com|nytimes\.com|reuters\.com|bloomberg\.com|ft\.com|theguardian\.com|bbc\.co\.uk|nbcnews\.com|axios\.com|builtin\.com|venturebeat\.com|techcrunch\.com|zdnet\.com|officechai\.com|startuphub\.ai)$/, "news"],
  [/(^|\.)(metr\.org|epoch\.ai|redwoodresearch\.org|safe\.ai|governance\.ai|rand\.org|cset\.georgetown\.edu)$/, "research-org"],
  [/(^|\.)(openai\.com|anthropic\.com|deepmind\.google|ai\.meta\.com|research\.google|microsoft\.com|nvidia\.com|huggingface\.co)$/, "lab"],
  [/\.edu$|\.ac\.uk$|(^|\.)thegradient\.pub$/, "academic"],
];
function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }
function outletKind(url, catalogKind) {
  if (catalogKind && BY_KIND[catalogKind]) return catalogKind;
  const h = hostOf(url); const hit = HOSTS.find(([re]) => re.test(h)); return hit ? hit[1] : "commentary";
}
// The outlet a piece belongs to, for track records. A personal blog or newsletter is pooled into its class, so no
// record is kept about the person writing it.
function outlet(url, catalogKind) {
  const kind = outletKind(url, catalogKind), h = hostOf(url);
  const personal = kind === "commentary" || kind === "people";
  return { id: personal ? `outlet:class-${kind}` : `outlet:${h || "unknown"}`, label: personal ? BY_KIND[kind].label : h || "unknown", kind, personal };
}

const PRIMARY = /arxiv\.org\/(abs|pdf|html)\/\d{4}\.\d{4,5}|\barxiv[: ]\d{4}\.\d{4,5}|doi\.org\/|\bdoi:\s?10\.|openreview\.net\/forum|\b(?:a|the|our|this) (?:study|paper|preprint|evaluation|survey) (?:of|on|by|from|found|shows|finds|reports)\b/i;
const SELLING = /\b(sign up|start (?:your )?free trial|book a demo|try (?:it|us|our \w+) (?:free|now|today)|our (?:platform|product|tool|app)\b(?! (?:paper|study))|get started (?:free|today)|pricing)\b/i;

// Grade one piece. Start from its outlet's grade; one step better if it cites primary research and isn't hyped (to B at
// most: only peer review earns an A);
// one step worse for heavy hype (50 or more); E when it sells its own product. Every step is listed in `why`.
function grade({ url = "", text = "", hype = 0, catalogKind = null }) {
  const kind = outletKind(url, catalogKind), o = BY_KIND[kind], why = [`${o.label}: ${o.why} (starts at ${o.grade})`];
  let g = GRADES.indexOf(o.grade);
  const sells = SELLING.test(text), cites = PRIMARY.test(text);
  if (sells) { g = 4; why.push("sells its own product: E"); }
  else {
    if (cites && hype < 50 && g > 1) { g -= 1; why.push("cites primary research (a paper or study): one step up"); }
    if (hype >= 50 && g < 4) { g += 1; why.push(`hype ${hype} (50 or more): one step down`); }
  }
  return { grade: GRADES[g], kind, outlet: outlet(url, catalogKind), cites, sells, why };
}

// ---------- forecasts as events ----------
const WATCH = (ontology.people || []).flatMap((p) => [p.label, ...(p.aliases || [])].filter((n) => n && n.length > 3));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAMES = WATCH.length ? new RegExp(`\\b(${WATCH.map(esc).join("|")})\\b`, "gi") : null;
// Any name a forecast is pinned on goes too, watched or not: "Jane Doe predicts", "Jane Doe's estimate", "according to Jane Doe".
const NAME = "(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)?\\.? ){1,2}[A-Z][a-z]+(?:-[A-Z][a-z]+)?";
const PINNED = new RegExp(`\\b${NAME}(?='s\\b| (?:says|said|predicts|predicted|estimates|estimated|believes|argues|expects|thinks|claims|claimed|warns|warned|wrote|writes|forecasts|told|puts|put)\\b)|(?<=\\b[Aa]ccording to )${NAME}\\b`, "g");
const redact = (s) => (NAMES ? s.replace(NAMES, "[a named person]") : s).replace(PINNED, "[a named person]");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const HORIZON = [
  { re: /\bby (?:the end of |late |early |mid-?)?(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? )?((?:19|20)\d{2})\b/i,
    due: (m) => { if (!m[1]) return `${m[2]}-12-31`; const mo = MONTHS.indexOf(m[1].toLowerCase()) + 1; return new Date(Date.UTC(Number(m[2]), mo, 0)).toISOString().slice(0, 10); } },
  { re: /\bin ((?:20)\d{2})\b/i, due: (m) => `${m[1]}-12-31`, needsFuture: true },
  { re: /\bwithin (?:the next )?(\d{1,2}|a|one|two|three|five|ten) (months?|years?)\b/i, rel: true },
  { re: /\bin the next (\d{1,2}|few|two|three|five|ten) (months?|years?)\b/i, rel: true },
  { re: /\b(\d{1,2}) (months?|years?) (?:away|from now)\b/i, rel: true },
  { re: /\bnext year\b/i, due: (m, at) => `${Number(at.slice(0, 4)) + 1}-12-31` },
  { re: /\bby the end of (?:the|this) decade\b/i, due: (m, at) => `${Math.floor(Number(at.slice(0, 4)) / 10) * 10 + 9}-12-31` },
];
const FUTURE = /\b(will|would|could|going to|expect\w*|predict\w*|forecast\w*|likely|chance|probabilit\w+|odds|on track|away from|arrive|reach|achiev\w+|build\w*|plan\w*|aim\w*|possib\w+|soon|arriv\w+)\b/i;
const NUM = { a: 1, one: 1, two: 2, three: 3, few: 3, five: 5, ten: 10 };
function addMonths(at, n) { const d = new Date(`${at}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
function predictions(sentences, at = new Date().toISOString().slice(0, 10)) {
  const out = [];
  for (const raw of sentences) {
    const s = String(raw).trim(); if (s.length < 25 || /\?\s*$/.test(s) || !FUTURE.test(s)) continue; // a question isn't a forecast
    for (const h of HORIZON) {
      const m = s.match(h.re); if (!m) continue;
      let due;
      if (h.rel) { const n = NUM[String(m[1]).toLowerCase()] || Number(m[1]); due = addMonths(at, /year/i.test(m[2]) ? n * 12 : n); }
      else due = h.due(m, at);
      if (h.needsFuture && due <= at) continue; // "in 2019" is history, not a forecast
      out.push({ sentence: redact(s).slice(0, 240), due, horizon: m[0] });
      break;
    }
  }
  return out.slice(0, 6);
}

// ---------- buzz versus evidence ----------
const BUZZ_KINDS = new Set(["news", "newsletter", "people", "forum", "community", "commentary", "vendor", "policy"]);
const LOUD = 20, SOME = 5; // items about the topic in the window
const LEVELS = ["none yet", "thin", "early", "some support"];
function buzz({ stories = [], articles = [], strength = "none yet", days = 30, at = new Date().toISOString().slice(0, 10) }) {
  const since = new Date(Date.parse(`${at}T00:00:00Z`) - days * 864e5).toISOString().slice(0, 10);
  const recent = (d) => !d || String(d).slice(0, 10) >= since;
  const s = stories.filter((x) => recent(x.at) && (x.kinds || []).some((k) => BUZZ_KINDS.has(k)));
  const a = articles.filter((x) => recent(x.at));
  const n = s.length + a.length, level = n >= LOUD ? "loud" : n >= SOME ? "some" : "quiet";
  const hype = a.length ? Math.round(a.reduce((t, x) => t + (x.hype || 0), 0) / a.length) : null;
  const ev = LEVELS.indexOf(strength);
  const gap = level === "loud" && ev <= 1 ? "talked about far more than it has been shown"
    : level !== "quiet" && ev <= 1 ? "talked about more than it has been shown"
    : level === "quiet" && ev >= 2 ? "shown more than it is talked about"
    : "talk and evidence roughly in step";
  return { days, items: n, stories: s.length, articles: a.length, level, hype, gap,
    rule: `buzz counts news, newsletter, blog, forum and community items on the topic in the last ${days} days (quiet under ${SOME}, loud at ${LOUD} or more); it never changes the evidence rating` };
}

// ---------- outlet track records ----------
// Per outlet (personal blogs and newsletters pooled into one class): pieces reviewed, their grades, mean credibility,
// and forecasts made and how they turned out once a person marked them. A hit rate is shown only from 3 resolved
// forecasts up, and "unclear" ones don't count either way.
const MIN_RESOLVED = 3;
function trackRecords(docs, events) {
  const by = {};
  for (const d of docs) {
    const r = typeof d.result === "string" ? JSON.parse(d.result || "{}") : d.result || {}, src = r.source; if (!src) continue;
    const o = (by[src.outlet.id] ||= { id: src.outlet.id, label: src.outlet.label, kind: src.outlet.kind, personal: src.outlet.personal, base: (BY_KIND[src.outlet.kind] || {}).grade, pieces: 0, grades: {}, cred: 0, forecasts: 0, pending: 0, happened: 0, didNot: 0, unclear: 0 });
    o.pieces++; o.cred += d.credibility; o.grades[src.grade] = (o.grades[src.grade] || 0) + 1;
  }
  for (const e of events) {
    const o = by[e.outlet]; if (!o) continue;
    o.forecasts++; if (e.status === "happened") o.happened++; else if (e.status === "did-not") o.didNot++; else if (e.status === "unclear") o.unclear++; else o.pending++;
  }
  return Object.values(by).map((o) => {
    const resolved = o.happened + o.didNot;
    return { ...o, meanCredibility: Math.round(o.cred / o.pieces), cred: undefined, resolved, hitRate: resolved >= MIN_RESOLVED ? +(o.happened / resolved).toFixed(2) : null,
      monitor: o.pieces >= 3 && !o.personal ? "worth following: it publishes often on these topics" : null };
  }).sort((a, b) => b.pieces - a.pieces);
}

module.exports = { trackRecords, MIN_RESOLVED, BY_KIND, OUTLETS, GRADES, outletKind, outlet, grade, predictions, redact, buzz, hostOf, LOUD, SOME };
