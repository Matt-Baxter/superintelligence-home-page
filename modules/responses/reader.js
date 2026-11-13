// Paper reader (REQ-056, proposed): turns a paper's full text into structure the analysis can use - title, abstract,
// numbered sections, table and figure captions, table cells, references and links - from arXiv's HTML rendering
// (LaTeXML), from a PDF (via pdftotext, when installed) or from plain text. No dependencies, no model calls, $0.
//
// Fetching is polite and cached: one request at a time, at least 3 s apart (arXiv's stated limit), a descriptive
// User-Agent, and every download kept under out/papers/<id>/ so a paper is read from the network once. It never uses
// arXiv's API host (export.arxiv.org); the daily watcher's own search is the only caller of that.
const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", times: "×", plusmn: "±", minus: "−", le: "≤", ge: "≥", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m);
// Math: keep LaTeXML's alttext (the TeX source) so "95%" and "$p<0.05$" survive as text.
const mathText = (html) => html.replace(/<math[^>]*alttext="([^"]*)"[^>]*>[\s\S]*?<\/math>/gi, (_, alt) => ` ${alt.replace(/\\%/g, "%").replace(/\\pm/g, "±").replace(/\\times/g, "×").replace(/[{}$\\]/g, "").trim()} `);
const text = (html) => decode(mathText(String(html)).replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d|figcaption|caption)>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const words = (s) => (String(s).match(/\S+/g) || []).length;
const ARXIV_ID = /(\d{4}\.\d{4,5})(v\d+)?/;
const LINK = /https?:\/\/(?:github\.com|gitlab\.com|huggingface\.co|zenodo\.org|osf\.io|codeocean\.com)\/[^\s"'<>)\]]+/gi;
const SECTION_KIND = [
  ["abstract", /^abstract$/i], ["intro", /introduction|overview|motivation/i], ["related", /related work|background|prior work|preliminar/i],
  ["method", /method|approach|framework|model|algorithm|setup|design|formulation|our /i], ["theory", /theor|analysis|guarantee|proof|bound/i],
  ["experiments", /experiment|evaluation|result|benchmark|empirical|ablation|study/i], ["limitations", /limitation|threat|caveat|broader impact|ethic|risk/i],
  ["conclusion", /conclusion|discussion|summary|future work/i], ["appendix", /appendix|supplement/i], ["references", /references|bibliography/i],
];
const kindOf = (heading) => (SECTION_KIND.find(([, re]) => re.test(heading)) || ["other"])[0];

// arXiv HTML (LaTeXML): sections are <section class="ltx_section"> with an <h2 class="ltx_title">; tables and figures
// are <figure class="ltx_table|ltx_figure"> with <figcaption>; the bibliography is <ul class="ltx_biblist">.
function fromHtml(html, meta = {}) {
  const h = String(html);
  const title = text((h.match(/<h1[^>]*class="[^"]*ltx_title_document[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || h.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || meta.title || "").replace(/^\[[^\]]+\]\s*/, "");
  const abstract = text((h.match(/<div[^>]*class="[^"]*ltx_abstract[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<(?:section|div[^>]*ltx_(?:para|section|keywords)|nav))/i) || h.match(/<div[^>]*class="[^"]*ltx_abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "").replace(/^Abstract\s*/i, "");
  const authors = [...h.matchAll(/<span[^>]*class="[^"]*ltx_personname[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => text(m[1]).split("\n")[0].trim()).filter(Boolean);
  const tables = [], figures = [];
  for (const m of h.matchAll(/<figure[^>]*class="[^"]*ltx_(table|figure)[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi)) {
    const cap = text((m[2].match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i) || [])[1] || "");
    if (m[1].toLowerCase() === "table") {
      const rows = [...m[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => text(c[1]).replace(/\n/g, " "))).filter((r) => r.some(Boolean));
      tables.push({ n: tables.length + 1, caption: cap, rows: rows.slice(0, 40) });
    } else figures.push({ n: figures.length + 1, caption: cap });
  }
  // Sections: top-level ltx_section (and ltx_appendix); subsections fold into their section's text.
  const body = h.replace(/<figure[\s\S]*?<\/figure>/gi, " ");
  const sections = [];
  const re = /<section[^>]*class="[^"]*ltx_(section|appendix|bibliography)[^"]*"[^>]*>/gi; const starts = [...body.matchAll(re)];
  starts.forEach((m, i) => {
    const chunk = body.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : body.length);
    const heading = text((chunk.match(/<h[2-3][^>]*class="[^"]*ltx_title[^"]*"[^>]*>([\s\S]*?)<\/h[2-3]>/i) || [])[1] || (m[1] === "bibliography" ? "References" : "")).replace(/\s+/g, " ").trim();
    const t = text(chunk.replace(/<h[2-3][^>]*class="[^"]*ltx_title[^"]*"[^>]*>[\s\S]*?<\/h[2-3]>/i, ""));
    sections.push({ heading: heading || `Section ${i + 1}`, kind: m[1] === "bibliography" ? "references" : kindOf(heading.replace(/^[\dA-Z]+\s+/, "")), text: t });
  });
  const refs = (h.match(/<li[^>]*class="[^"]*ltx_bibitem[^"]*"/gi) || []).length;
  return finish({ source: "html", title, authors, abstract, sections, tables, figures, references: refs, links: [...new Set(h.match(LINK) || [])] }, meta);
}

// PDF text (pdftotext -layout off): headings are short lines like "3 Method", "3.2 Results" or "LIMITATIONS"; tables
// survive only as their captions ("Table 2: ...") and loose numbers, which the extractor reads as sentences.
// Markdown tables (a web reader's rendering of HTML tables): consecutive "| a | b |" lines, matched to the nearest
// "Table N" caption above them, so table cells can back a paper's claims as they do from the HTML reader.
function mdTables(t, captions) {
  const lines = t.split("\n"), out = []; let cur = null;
  lines.forEach((l, i) => {
    if (/^\s*\|.*\|\s*$/.test(l)) {
      if (!cur) { const cap = lines.slice(Math.max(0, i - 4), i).reverse().find((x) => /^\s*Table\s*\d/i.test(x)) || ""; const n = Number((cap.match(/Table\s*(\d+)/i) || [])[1]) || null; cur = { n, caption: cap.replace(/^\s*Table\s*\d+[.:]?\s*/i, "").trim(), rows: [] }; out.push(cur); }
      if (!/^\s*\|[\s:|-]+\|\s*$/.test(l)) cur.rows.push(l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    } else if (l.trim()) cur = null;
  });
  const used = new Set(out.map((x) => x.n).filter(Boolean));
  return [...out.filter((x) => x.rows.length > 1), ...captions.filter((c) => !used.has(c.n)).map((c) => ({ ...c, rows: [] }))];
}
function fromText(raw, meta = {}) {
  // Markdown from a web reader: headings lose their #s, emphasis and link syntax go, so section detection works as on PDF text.
  raw = String(raw).replace(/^Source: .*\n/, "").replace(/^(?:URL|Published|Author): .*\n/gm, "").replace(/^#{1,6}\s+/gm, "").replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/\[([^\]\n]{1,200})\]\((?:https?:)?[^)\s]*\)/g, "$1");
  const t = String(raw).replace(/\r/g, "").replace(/\f/g, "\n").replace(/(\w)-\n(\w)/g, "$1$2").replace(/[ \t]+/g, " ")
    // pdftotext often puts a section number on its own line: "3\n\nExperiments" -> "3 Experiments".
    .replace(/^(\d{1,2}(?:\.\d{1,2})*)\n\n?([A-Z][^\n]{2,60})$/gm, "$1 $2");
  const lines = t.split("\n").map((l) => l.trim());
  const isHead = (l) => l.length > 2 && l.length < 70 && !/[.:;,]$/.test(l) && (/^(\d{1,2}(\.\d{1,2})?|[A-H](\.\d)?)\.?\s+[A-Z][A-Za-z]/.test(l) || /^(Abstract|Introduction|Related Work|Background|Method|Methods|Approach|Experiments|Results|Evaluation|Discussion|Limitations|Conclusions?|References|Acknowledg(e)?ments|Appendix)\b/i.test(l) && words(l) <= 6);
  const sections = []; let cur = { heading: "Front matter", lines: [] };
  for (const l of lines) { if (isHead(l) && !/^(Table|Figure|Fig\.)\s*\d/i.test(l)) { sections.push(cur); cur = { heading: l, lines: [] }; } else cur.lines.push(l); }
  sections.push(cur);
  const secs = sections.map((s) => ({ heading: s.heading.replace(/\s+/g, " "), kind: s.heading === "Front matter" ? "front" : kindOf(s.heading.replace(/^[\dA-Z.]+\s+/, "")), text: s.lines.join("\n").replace(/([^\n])\n(?!\n)/g, "$1 ").replace(/\n{2,}/g, "\n\n").trim() })).filter((s) => s.text || s.kind === "references");
  const absSec = secs.find((s) => s.kind === "abstract");
  const front = secs.find((s) => s.kind === "front");
  const abstract = meta.abstract || (absSec ? absSec.text : ((front && front.text.match(/Abstract[.:]?\s*([\s\S]{200,2500}?)(\n\n|$)/i)) || [])[1] || "");
  const caps = (kind) => [...t.matchAll(new RegExp(`^${kind}\\s*(\\d+)[.:]\\s*([^\\n]+(?:\\n(?![A-Z][a-z]+ \\d)[^\\n]+){0,3})`, "gmi"))].map((m) => ({ n: Number(m[1]), caption: m[2].replace(/\s+/g, " ").trim() }));
  const refSec = secs.find((s) => s.kind === "references");
  const refs = refSec ? (refSec.text.match(/^\s*\[\d+\]|\n\s*\[\d+\]|(?:^|\n)[A-Z][a-zA-Z-]+,\s[A-Z]\./g) || []).length : 0;
  return finish({ source: meta.source || "text", title: meta.title || (front ? front.text.split("\n")[0].slice(0, 200) : ""), authors: meta.authors || [], abstract, sections: secs.filter((s) => s.kind !== "abstract" && s.kind !== "front" || (s.kind === "front" && !abstract)), tables: mdTables(t, caps("Table")), figures: caps("(?:Figure|Fig\\.)"), references: refs, links: [...new Set(t.match(LINK) || [])] }, meta);
}

function fromPdf(file, meta = {}) {
  let out; try { out = execFileSync("pdftotext", ["-enc", "UTF-8", file, "-"], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 }).toString("utf8"); }
  catch (e) { throw new Error(`Couldn't read the PDF (${e.code === "ENOENT" ? "install poppler-utils for pdftotext" : String(e.message).split("\n")[0]}).`); }
  return fromText(out, { ...meta, source: "pdf" });
}

function finish(doc, meta) {
  const sections = doc.sections.map((s, i) => ({ id: `s${i + 1}`, ...s, words: words(s.text) }));
  const body = sections.filter((s) => s.kind !== "references" && s.kind !== "appendix");
  return { id: meta.id || null, url: meta.url || null, title: doc.title || meta.title || "", authors: doc.authors.length ? doc.authors : meta.authors || [], abstract: doc.abstract || meta.abstract || "",
    source: doc.source, sections, tables: doc.tables, figures: doc.figures, references: doc.references, links: doc.links.map((l) => l.replace(/[.,;]+$/, "")),
    words: body.reduce((n, s) => n + s.words, 0), fullText: body.length >= 3 && body.reduce((n, s) => n + s.words, 0) >= 100 };
}

// Read whatever was given: a path to .html/.pdf/.txt, or an arXiv id / URL (fetched politely, cached on disk).
let last = 0;
const pause = async () => { const wait = last + 3100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last = Date.now(); };
async function get(url, binary) {
  await pause();
  const r = await fetch(url, { headers: { "User-Agent": "superintelligence-homepage-paper-reader/0.1 (SEIS 606 class project; one request per 3 s; cached)" }, redirect: "follow" });
  if (!r.ok) { const e = new Error(`${url}: HTTP ${r.status}`); e.status = r.status; throw e; }
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}
async function read(input, { cacheDir = process.env.PAPER_CACHE || (process.env.VERCEL ? path.join(require("node:os").tmpdir(), "papers") : path.join(__dirname, "..", "..", "out", "papers")), meta = {}, offline = false } = {}) {
  const s = String(input).trim();
  if (fs.existsSync(s)) {
    const ext = path.extname(s).toLowerCase();
    if (ext === ".pdf") return fromPdf(s, meta);
    const raw = fs.readFileSync(s, "utf8");
    return /<html|<section|<div/i.test(raw.slice(0, 5000)) || ext === ".html" || ext === ".htm" ? fromHtml(raw, meta) : fromText(raw, meta);
  }
  const id = (s.match(ARXIV_ID) || [])[1]; if (!id) throw new Error(`Give a file path or an arXiv id or URL (got "${s}").`);
  const dir = path.join(cacheDir, id); fs.mkdirSync(dir, { recursive: true });
  const m = { id, url: `https://arxiv.org/abs/${id}`, ...meta };
  const html = path.join(dir, "paper.html"), pdf = path.join(dir, "paper.pdf"), txt = path.join(dir, "paper.txt");
  if (fs.existsSync(html)) return fromHtml(fs.readFileSync(html, "utf8"), m);
  if (fs.existsSync(pdf)) return fromPdf(pdf, m);
  // Text saved by an agent's reader (the web fetch tool's markdown of the arXiv HTML page), for hosts scripts can't reach.
  if (fs.existsSync(txt)) return fromText(fs.readFileSync(txt, "utf8"), m);
  if (offline) throw new Error(`${id} isn't cached in ${dir}; put paper.html, paper.pdf or paper.txt (a web reader's text) there, or run without --offline.`);
  // The HTML rendering keeps sections and tables; older papers or failed conversions only have the PDF.
  try { const page = await get(`https://arxiv.org/html/${id}`); if (/ltx_section|ltx_abstract/.test(page)) { fs.writeFileSync(html, page); return fromHtml(page, m); } } catch (e) { if (e.status && e.status !== 404) throw e; }
  fs.writeFileSync(pdf, await get(`https://arxiv.org/pdf/${id}`, true));
  return fromPdf(pdf, m);
}

module.exports = { read, fromHtml, fromText, fromPdf, text, decode, kindOf };
