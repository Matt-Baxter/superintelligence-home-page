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
function parse(format, body) {
  if (format === "hf-daily") return parseHfDaily(typeof body === "string" ? JSON.parse(body) : body);
  return parseXml(String(body));
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

async function fetchSource(src, { timeoutMs = 15000 } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(src.url, { signal: ctl.signal, headers: { "User-Agent": "si-homepage/1.0 (course project feed reader)", Accept: "application/rss+xml, application/atom+xml, application/json, text/xml, */*" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    return parse(src.format, src.format === "hf-daily" ? JSON.parse(body) : body);
  } finally { clearTimeout(t); }
}

module.exports = { parse, parseXml, parseHfDaily, storyKeys, canonicalUrl, arxivId, normUrl, fetchSource, stripHtml };
