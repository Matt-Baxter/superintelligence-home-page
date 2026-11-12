// Feed parsing and story keys. No dependencies: RSS 2.0, Atom (incl. arXiv's API), and Hugging Face Daily Papers JSON.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
function decode(s) {
  return String(s ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const stripHtml = (s) => decode(decode(s)).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function tagText(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}
function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  const pick = links.find((a) => /rel=["']alternate["']/.test(a)) || links.find((a) => !/rel=/.test(a)) || links[0] || "";
  const href = pick.match(/href=["']([^"']+)["']/);
  return href ? decode(href[1]) : "";
}
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
function isoDate(s) { const t = Date.parse(s); return Number.isFinite(t) ? new Date(t).toISOString() : null; }

function parseXml(xml) {
  const items = [];
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = isAtom ? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [] : xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = stripHtml(tagText(b, "title"));
    let url = isAtom ? atomLink(b) : decode(tagText(b, "link")).trim();
    if (!url) url = decode(tagText(b, "guid") || tagText(b, "id")).trim();
    const summary = stripHtml(tagText(b, "description") || tagText(b, "summary") || tagText(b, "content:encoded") || tagText(b, "content"));
    const published = isoDate(tagText(b, "pubDate") || tagText(b, "published") || tagText(b, "updated") || tagText(b, "dc:date"));
    const authors = isAtom ? [...b.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/gi)].map((m) => stripHtml(m[1])) : [stripHtml(tagText(b, "dc:creator") || tagText(b, "author"))].filter(Boolean);
    if (title && /^https?:\/\//.test(url)) items.push({ title: cut(title, 300), url, summary: cut(summary, 700), published, authors: authors.slice(0, 4) });
  }
  return items;
}
function parseHfDaily(json) {
  const arr = Array.isArray(json) ? json : json.papers || [];
  return arr.map((e) => {
    const p = e.paper || e; const id = p.id || p.arxivId;
    return id && (p.title || e.title) ? {
      title: cut(String(p.title || e.title).replace(/\s+/g, " ").trim(), 300), url: `https://huggingface.co/papers/${id}`,
      summary: cut(String(p.summary || "").replace(/\s+/g, " ").trim(), 700), published: isoDate(e.publishedAt || p.publishedAt),
      authors: (p.authors || []).map((a) => a.name).filter(Boolean).slice(0, 4), score: Number(p.upvotes || e.upvotes) || 0,
    } : null;
  }).filter(Boolean);
}
// JSON Feed 1.x (jsonfeed.org): many blogs and newsletters publish one.
function parseJsonFeed(json) {
  return (json.items || []).map((i) => {
    const url = i.url || i.external_url || i.id;
    const title = i.title || stripHtml(i.content_html || i.content_text || "").slice(0, 120);
    return url && title && /^https?:\/\//.test(url) ? { title: cut(stripHtml(title), 300), url, summary: cut(stripHtml(i.summary || i.content_text || i.content_html || ""), 700),
      published: isoDate(i.date_published || i.date_modified), authors: (i.authors || (i.author ? [i.author] : [])).map((a) => a.name).filter(Boolean).slice(0, 4) } : null;
  }).filter(Boolean);
}
// Hacker News via the Algolia search API (https://hn.algolia.com/api). Links to the story, not the HN thread, when there is one.
function parseHnAlgolia(json) {
  return (json.hits || []).map((h) => {
    const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
    return h.title ? { title: cut(h.title, 300), url, summary: `${h.points ?? 0} points and ${h.num_comments ?? 0} comments on Hacker News: https://news.ycombinator.com/item?id=${h.objectID}`,
      published: isoDate(h.created_at), authors: h.author ? [h.author] : [], score: Number(h.points) || 0 } : null;
  }).filter(Boolean);
}
// Semantic Scholar Graph API paper search (https://api.semanticscholar.org). Prefers the arXiv link so stories group with arXiv/HF.
function parseSemanticScholar(json) {
  return (json.data || []).map((p) => {
    const ax = p.externalIds?.ArXiv;
    const url = ax ? `https://arxiv.org/abs/${ax}` : p.url || (p.paperId ? `https://www.semanticscholar.org/paper/${p.paperId}` : null);
    return url && p.title ? { title: cut(p.title, 300), url, summary: cut(p.tldr?.text || p.abstract || "", 700), published: isoDate(p.publicationDate || (p.year ? `${p.year}-01-01` : null)),
      authors: (p.authors || []).map((a) => a.name).filter(Boolean).slice(0, 4), score: Number(p.citationCount) || 0 } : null;
  }).filter(Boolean);
}
const FORMATS = {
  rss: { label: "RSS or Atom (also Substack, Medium, Reddit .rss, GitHub releases.atom, YouTube channel feeds)", json: false, parse: (b) => parseXml(String(b)) },
  arxiv: { label: "arXiv API (Atom)", json: false, parse: (b) => parseXml(String(b)) },
  jsonfeed: { label: "JSON Feed", json: true, parse: parseJsonFeed },
  "hf-daily": { label: "Hugging Face Daily Papers", json: true, parse: parseHfDaily },
  "hn-algolia": { label: "Hacker News search (Algolia API)", json: true, parse: parseHnAlgolia },
  "semantic-scholar": { label: "Semantic Scholar paper search", json: true, parse: parseSemanticScholar },
};
function parse(format, body) {
  const f = FORMATS[format] || FORMATS.rss;
  return f.parse(f.json && typeof body === "string" ? JSON.parse(body) : body);
}

// One story per real-world thing: an arXiv id beats a URL, a URL beats a title.
function arxivId(url) {
  const m = String(url).match(/(?:arxiv\.org\/(?:abs|pdf|html)\/|huggingface\.co\/papers\/|alphaxiv\.org\/abs\/)(\d{4}\.\d{4,5})/i);
  return m ? m[1] : null;
}
function normUrl(u) {
  try {
    const x = new URL(u); x.hash = "";
    [...x.searchParams.keys()].forEach((k) => { if (/^(utm_|ref$|source$|fbclid|gclid)/i.test(k)) x.searchParams.delete(k); });
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + (x.search || "")).toLowerCase();
  } catch { return null; }
}
const normTitle = (t) => String(t).toLowerCase().replace(/^(paper|blog|new post)\s*:\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
function storyKeys(item) {
  const keys = [];
  const ax = arxivId(item.url); if (ax) keys.push("arxiv:" + ax);
  const nu = normUrl(item.url); if (nu && !ax) keys.push("url:" + nu);
  const nt = normTitle(item.title); if (nt.split(" ").length >= 4) keys.push("title:" + nt);
  return keys;
}
function canonicalUrl(item) { const ax = arxivId(item.url); return ax ? `https://arxiv.org/abs/${ax}` : item.url; }

const UA = "si-homepage/1.0 (course project feed reader; +https://github.com/Matt-Baxter/superintelligence-home-page)";
// Test-only: fixture://name reads test/fixtures/name. Only when ALLOW_FIXTURE_FEEDS=1 (set by the sample-data servers).
async function readFixture(url) {
  if (process.env.ALLOW_FIXTURE_FEEDS !== "1") throw new Error("fixture:// feeds are only allowed in tests");
  const name = url.slice("fixture://".length).replace(/[^a-z0-9._-]/gi, "");
  const text = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "test", "fixtures", name), "utf8");
  return process.env.FIXTURE_DATES === "shift" ? require("../test/fixture-dates").shiftText(text) : text;
}
// Server-side fetches only go to public http(s) hosts: no localhost, private ranges or cloud metadata addresses.
// (A hostname check, not DNS resolution; good enough for an admin-only feature on a class project.)
function assertPublicUrl(url) {
  let u; try { u = new URL(url); } catch { throw new Error("That isn't a valid URL."); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http and https feeds are supported.");
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h === "0.0.0.0" || h === "::1" ||
      /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^f[cd][0-9a-f]{2}:/.test(h))
    throw new Error("That address isn't a public website.");
}
// Fetch with conditional GET: pass the etag / lastModified we saw last time and get {notModified:true} when nothing changed.
async function fetchText(url, { timeoutMs = 15000, etag, lastModified, accept } = {}) {
  if (url.startsWith("fixture://")) return { status: 200, body: await readFixture(url) };
  assertPublicUrl(url);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const headers = { "User-Agent": UA, Accept: accept || "application/rss+xml, application/atom+xml, application/feed+json, application/json, text/xml, text/html;q=0.8, */*;q=0.5" };
    if (etag) headers["If-None-Match"] = etag;
    if (lastModified) headers["If-Modified-Since"] = lastModified;
    const res = await fetch(url, { signal: ctl.signal, headers, redirect: "follow" });
    if (res.status === 304) return { status: 304, notModified: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    if (body.length > 5_000_000) throw new Error("Response too large (over 5 MB)");
    return { status: res.status, body, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"), contentType: res.headers.get("content-type") || "" };
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s`);
    throw e;
  } finally { clearTimeout(t); }
}
async function fetchSource(src, opts = {}) {
  const r = await fetchText(src.url, { ...opts, etag: opts.conditional ? src.etag : null, lastModified: opts.conditional ? src.last_modified : null });
  if (r.notModified) return { notModified: true, items: [] };
  let items;
  try { items = parse(src.format, r.body); } catch (e) { throw new Error(`Couldn't parse as ${src.format}: ${e.message}`); }
  if (!items.length && /<html[\s>]/i.test(r.body.slice(0, 2000))) throw new Error("That URL is a web page, not a feed. Try “Find feed” to discover the feed link.");
  const cap = Math.max(1, Math.min(200, Number(src.max_items) || 50));
  return Object.assign(items.slice(0, cap), { etag: r.etag, lastModified: r.lastModified });
}
// Feed autodiscovery: given a site's homepage, find its RSS/Atom/JSON feeds.
async function discoverFeeds(pageUrl) {
  const found = [];
  const add = (href, type, title) => { try { const u = new URL(href, pageUrl).toString(); if (!found.some((f) => f.url === u)) found.push({ url: u, format: /json/.test(type) ? "jsonfeed" : "rss", title: title || "" }); } catch {} };
  const r = await fetchText(pageUrl, { accept: "text/html, application/xhtml+xml, */*;q=0.5" });
  const html = r.body || "";
  if (/^\s*<\?xml|<rss[\s>]|<feed[\s>]/i.test(html.slice(0, 500))) return [{ url: pageUrl, format: "rss", title: "This URL is already a feed" }];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']?alternate/i.test(tag)) continue;
    const type = (tag.match(/type=["']([^"']+)/i) || [])[1] || "";
    if (!/(rss|atom|feed\+json|json)/i.test(type)) continue;
    const href = (tag.match(/href=["']([^"']+)/i) || [])[1]; const title = (tag.match(/title=["']([^"']+)/i) || [])[1];
    if (href) add(decode(href), type, title && decode(title));
  }
  // Common locations, when the page doesn't advertise one.
  if (!found.length && !pageUrl.startsWith("fixture://")) {
    for (const p of ["/feed", "/rss.xml", "/feed.xml", "/atom.xml", "/index.xml", "/rss", "/blog/rss.xml", "/feed.json"]) {
      try { const u = new URL(p, pageUrl).toString(); const t = await fetchText(u, { timeoutMs: 6000 }); if (t.body && /<rss[\s>]|<feed[\s>]|"version":\s*"https:\/\/jsonfeed/i.test(t.body.slice(0, 2000))) add(u, /jsonfeed/.test(t.body.slice(0, 500)) ? "json" : "rss", ""); } catch {}
    }
  }
  return found;
}
module.exports = { parse, parseXml, parseHfDaily, parseJsonFeed, parseHnAlgolia, parseSemanticScholar, FORMATS, storyKeys, canonicalUrl, arxivId, normUrl, fetchSource, fetchText, discoverFeeds, stripHtml, assertPublicUrl };
