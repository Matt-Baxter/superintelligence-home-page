#!/usr/bin/env node
// Read every paper and article in a watch input in full, and set the full-text reading next to the judgement of the
// abstract or summary (modules/review/fulltext.js). REQ-027, REQ-028.
//   node scripts/read.js --from out/watch/inputs/2026-11-12.json      -> out/read/<date>.md and .json
// Texts are read from local files only (nothing is fetched here; arxiv.org isn't reachable from scripts):
//   papers    out/papers/<arXiv id>/paper.html | paper.pdf | paper.txt   (the reader's cache; an agent saves paper.txt)
//   articles  the input's "file" field, or out/articles/<slug of the outlet>.txt
// A piece with no saved text is listed as "not read" with where to save it. Full texts are never stored in the database
// or the repo (REQ-007): only these results are written, under out/.
const fs = require("node:fs"), path = require("node:path");
const R = require("../modules/review/review"), F = require("../modules/review/fulltext");
const reader = require("../modules/responses/reader"), A = require("../modules/responses/analysis");
const root = path.join(__dirname, ".."), arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const from = arg("--from"); if (!from) { console.error("Usage: node scripts/read.js --from <watch input json>"); process.exit(1); }
const entries = JSON.parse(fs.readFileSync(from, "utf8")), date = (path.basename(from).match(/\d{4}-\d{2}-\d{2}/) || [new Date().toISOString().slice(0, 10)])[0];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ARXIV = /arxiv\.org\/(?:abs|html|pdf)\/(\d{4}\.\d{4,5})/;
// Truncated: the saver marked the text as cut ("[truncated]"), or a paper's text has neither a conclusion nor a
// reference list (it stopped inside the body). Articles end with footers and embeds, so only the marker counts there.
const marked = (t) => /\[(?:truncated|cut off)\]/i.test(t);
const paperCut = (t, doc) => marked(t) || !(doc.sections || []).some((s) => ["conclusion", "references"].includes(s.kind));

(async () => {
  const rows = [];
  for (const e of entries) {
    const base = { kind: e.kind || "paper", title: e.title, url: e.url, sourceKind: e.sourceKind || null, at: e.published };
    const quick = R.review({ kind: base.kind, title: e.title, text: e.abstract || e.summary, authors: (e.authors || []).join(", "), url: e.url, sourceKind: e.sourceKind, at: e.published });
    try {
      if (base.kind === "paper") {
        const id = (String(e.url).match(ARXIV) || [])[1]; if (!id) throw new Error("no arXiv id in the URL");
        const doc = await reader.read(id, { offline: true });
        const raw = ["paper.txt", "paper.html"].map((f) => path.join(root, "out", "papers", id, f)).find((f) => fs.existsSync(f));
        // The paper's own abstract replaces our summary for the abstract judgement, when the reader found it.
        const abstractReview = doc.abstract && doc.abstract.length > 200 ? R.review({ kind: "paper", title: e.title, text: doc.abstract, authors: (e.authors || []).join(", "), url: e.url, sourceKind: e.sourceKind, at: e.published }) : quick;
        rows.push({ ...base, read: F.paper({ abstractReview, analysis: A.analyse(doc, { review: abstractReview }), doc, truncated: raw ? paperCut(fs.readFileSync(raw, "utf8"), doc) : false, at: e.published }) });
      } else {
        const file = e.file || path.join("out", "articles", `${slug((e.authors || [])[0] || e.title)}.txt`), p = path.resolve(root, file);
        if (!fs.existsSync(p)) throw new Error(`save the article's text to ${file}`);
        const text = fs.readFileSync(p, "utf8").replace(/^Source: .*\n/, "").replace(/^(?:URL|Published|Author): .*\n/gm, "");
        const full = R.review({ kind: "article", title: e.title, text, authors: (e.authors || []).join(", "), url: e.url, sourceKind: e.sourceKind, at: e.published });
        rows.push({ ...base, read: F.article({ summaryReview: quick, fullReview: full, title: e.title, text, truncated: marked(text) }) });
      }
    } catch (err) { rows.push({ ...base, read: null, notRead: err.message, abstract: { credibility: quick.credibility, verdict: quick.verdict } }); }
  }
  const dir = path.join(root, "out", "read"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${date}.json`), JSON.stringify({ date, rules: F.RULES, rows }, null, 2));
  const read = rows.filter((r) => r.read), split = read.filter((r) => !r.read.agree);
  const md = [`# Full-text reading, ${date}`, "", `${read.length} of ${rows.length} pieces read in full; ${split.length} where the two readings disagree (sent to a person). Rules: modules/review/fulltext.js, published with the criteria.`, "",
    "| Piece | Abstract or summary | Full text | Rubric (full text) | Readings |", "| --- | --- | --- | --- | --- |",
    ...rows.map((r) => !r.read ? `| [${r.title}](${r.url}) | ${r.abstract.verdict}, ${r.abstract.credibility} | not read: ${r.notRead} | | |`
      : `| [${r.title}](${r.url}) | ${r.read.abstract.verdict}, ${r.read.abstract.credibility}${r.read.abstract.grade ? `, grade ${r.read.abstract.grade}` : ""} | ${r.read.verdict}, ${r.read.credibility}${r.read.kind === "paper" ? ` (rigor ${r.read.rigor}; contributions backed ${r.read.contributions.backedShare ?? "n/a"}; abstract numbers in body ${r.read.abstractNumbers.traced ?? "n/a"})` : `${r.read.grade ? `, grade ${r.read.grade}` : ""}`}${r.read.truncated ? "; text cut off" : ""} | ${r.read.si.stance}, ${r.read.si.relevance} | ${r.read.agree ? "agree" : `disagree: ${r.read.reasons.join("; ")}`} |`),
    "", "## Dated forecasts found in full texts", "", ...read.flatMap((r) => (r.read.forecasts || []).map((f) => `- ${f.due}: ${f.sentence} (${r.title})`)), "",
    "## The logic, piece by piece", "", "Every number above comes from these steps. Each step shows its result and what produced it; quotes are short excerpts from the piece.", "",
    ...read.flatMap((r) => [`### ${r.title}`, "", `Rubric on the full text: ${r.read.si.summary} (relevance ${r.read.si.relevance}).`, ...r.read.si.dimensions.map((d) => `- ${d.label} (${d.axis}) ${d.level}/3: ${d.why.join("; ")}`), "",
      ...r.read.logic.flatMap((l) => [`**${l.step}: ${l.result}**`, ...l.because.map((b) => `- ${b}`), ""])])];
  fs.writeFileSync(path.join(dir, `${date}.md`), md.join("\n"));
  console.log(`read: ${read.length} of ${rows.length} read in full, ${split.length} disagree -> out/read/${date}.md`);
})().catch((e) => { console.error(e); process.exit(1); });
