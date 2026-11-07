#!/usr/bin/env node
// Judge report (REQ-037, spec 003 T006): how many judged items sit near a verdict cutoff, where one marker more or
// less could change the verdict or the dossier's "credible" test. Read-only: it never writes anything but stdout.
// Cutoffs come from modules/review/review.js (`verdict`) and modules/review/dossier.js (credible = High band around 60, credibility >= 65 at m = 5; modules/review/bands.js).
// The band rule is the spec's half-open one: an item is Border for cutoff T at margin m when T - m <= S < T + m.
//   node scripts/judge-report.js                    reviewed docs in the database (same DATABASE_URL / DATA_DIR as the
//                                                    server); with no database, the synthetic samples run through review()
//   node scripts/judge-report.js --from <file>      a watch file (out/watch/<day>.json) or any JSON with papers/items
//   node scripts/judge-report.js --samples          force the synthetic samples (modules/review/samples.json, bench/review-set.json)
//   --margin <m>  margin used for the listing and the summary line (default 5)     --json  machine-readable output
const fs = require("node:fs"), path = require("node:path");

const CUTOFFS = [
  { field: "credibility", at: 35, why: "below it the verdict is \"doubtful\"" },
  { field: "credibility", at: 60, why: "\"major and credible\" needs it; the dossier counts a paper as credible only from 60 + m (its High band)" },
  { field: "credibility", at: 70, why: "\"solid, modest step\" needs it" },
  { field: "score", at: 40, why: "\"big if true\" needs it" },
  { field: "score", at: 55, why: "\"major and credible\" needs it" },
];
const MARGINS = [3, 5, 8];

// Half-open band around cutoff t: [t - m, t + m).
const isBorder = (v, t, m) => typeof v === "number" && Number.isFinite(v) && v >= t - m && v < t + m;

function report(items, margin = 5, source = "") {
  const rows = items.filter((x) => Number.isFinite(x.score) || Number.isFinite(x.credibility));
  const cutoffs = CUTOFFS.map((c) => {
    const counts = Object.fromEntries([...new Set([...MARGINS, margin])].sort((a, b) => a - b).map((m) => [m, rows.filter((x) => isBorder(x[c.field], c.at, m)).length]));
    const borderline = rows.filter((x) => isBorder(x[c.field], c.at, margin))
      .map((x) => ({ title: x.title, value: x[c.field], side: x[c.field] >= c.at ? "at or above" : "below", verdict: x.verdict }));
    return { field: c.field, cutoff: c.at, why: c.why, counts, borderline };
  });
  const near = new Set();
  rows.forEach((x, i) => { if (CUTOFFS.some((c) => isBorder(x[c.field], c.at, margin))) near.add(i); });
  return { source, margin, rule: "Border when T - m <= value < T + m", items: rows.length, borderline: near.size, cutoffs,
    summary: `judge report: ${rows.length} items, ${near.size} borderline at margin ${margin}` };
}

function toText(r) {
  const L = [`Source: ${r.source}`, `Band rule: ${r.rule}; counts at m = ${Object.keys(r.cutoffs[0].counts).join(", ")}`, ""];
  for (const c of r.cutoffs) {
    L.push(`${c.field} ${c.cutoff} (${c.why}): ${Object.entries(c.counts).map(([m, n]) => `m=${m}: ${n}`).join(", ")}`);
    for (const b of c.borderline) L.push(`  - ${b.title} (${c.field} ${b.value}, ${b.side} ${c.cutoff}${b.verdict ? `; ${b.verdict}` : ""})`);
  }
  return [...L, "", r.summary].join("\n");
}

const pick = (x) => ({ title: String(x.title || x.label || x.id || "(untitled)"), score: Number(x.score), credibility: Number(x.credibility), verdict: x.verdict || "" });

// Watch files carry papers with score and credibility; any other JSON with papers/items/samples arrays is judged as is,
// or run through review() when its entries carry text but no scores.
function fromFile(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(j) ? j : j.papers || j.items || j.samples || [];
  return list.map((x) => (Number.isFinite(x.score) || Number.isFinite(x.credibility) ? pick(x) : judged(x)));
}

function judged(x) {
  const R = require("../modules/review/review");
  const r = R.review({ kind: x.kind, title: x.title, authors: x.authors, text: x.text, url: x.url });
  return pick({ ...r, title: x.title || r.title || x.id });
}

function fromSamples() {
  const root = path.join(__dirname, "..");
  const a = require(path.join(root, "modules/review/samples.json")).samples, b = require(path.join(root, "bench/review-set.json")).items;
  return [...a, ...b].map(judged);
}

// The database, read-only: Postgres through lib/db without running the schema; SQLite opened read-only if the file exists.
async function fromDb() {
  const SQL = "SELECT title, score, credibility, verdict FROM review_docs ORDER BY id";
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const db = require("../lib/db");
    try { return { rows: (await db.all(SQL)).map(pick), where: "Postgres (DATABASE_URL), table review_docs" }; }
    catch (e) { return { rows: null, why: e.message }; }
    finally { try { await db.end?.(); } catch {} }
  }
  const file = path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "si.db");
  if (!fs.existsSync(file)) return { rows: null, why: `no database at ${path.relative(process.cwd(), file) || file}` };
  const { DatabaseSync } = require("node:sqlite");
  const raw = new DatabaseSync(file, { readOnly: true });
  try { return { rows: raw.prepare(SQL).all().map(pick), where: `SQLite ${path.relative(process.cwd(), file)}, table review_docs` }; }
  catch (e) { return { rows: null, why: e.message }; }
  finally { raw.close(); }
}

async function main(argv) {
  const flag = (n) => argv.includes(n), val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const margin = val("--margin") === undefined ? 5 : Number(val("--margin"));
  if (!(margin > 0)) throw new Error("--margin must be a positive number");
  let items, source;
  if (val("--from")) { items = fromFile(val("--from")); source = `file ${val("--from")}`; }
  else if (flag("--samples")) { items = fromSamples(); source = "synthetic samples (modules/review/samples.json + bench/review-set.json) through review()"; }
  else {
    const d = await fromDb();
    if (d.rows && d.rows.length) { items = d.rows; source = d.where; }
    else { items = fromSamples(); source = `synthetic samples through review() (${d.rows ? "no reviewed docs in the database" : d.why})`; }
  }
  const r = report(items, margin, source);
  console.log(flag("--json") ? JSON.stringify(r, null, 2) : toText(r));
}

if (require.main === module) main(process.argv.slice(2)).then(() => process.exit(0), (e) => { console.error("judge report:", e.message); process.exit(1); });
module.exports = { CUTOFFS, MARGINS, isBorder, report, toText };
