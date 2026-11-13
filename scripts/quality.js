#!/usr/bin/env node
// Quality report on REAL reviews (the database the watcher fills), complementing the synthetic benchmark (bench/):
// does the judging actually tell pieces apart, and do its parts agree with each other? No labels are invented: these
// are internal-consistency and discrimination checks, each with the threshold it is held to, so a weak spot shows up
// as a number and becomes a synthetic benchmark item before any rule changes (tune-significance).
//   node scripts/quality.js            same DATABASE_URL / DATA_DIR as the server; writes out/quality/<date>.md
const fs = require("node:fs"), path = require("node:path");
const GR = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
// Spearman rank correlation (ties averaged).
function rank(a) { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = []; for (let i = 0; i < s.length;) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
function spearman(x, y) { if (x.length < 3) return null; const a = rank(x), b = rank(y), ma = mean(a), mb = mean(b); const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0), den = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) * b.reduce((s, v) => s + (v - mb) ** 2, 0)); return den ? +(num / den).toFixed(2) : null; }

function analyse(rows) {
  const R = rows.map((d) => { const r = typeof d.result === "string" ? JSON.parse(d.result || "{}") : d.result || {}; const J = Object.fromEntries((r.judges || []).map((j) => [j.id, j]));
    return { kind: d.kind, title: d.title, cred: d.credibility, verdict: d.verdict, grade: r.source ? r.source.grade : null, hype: (J.hype || {}).score ?? 0, rigor: (J.rigor || {}).score ?? 0, panel: r.panel ? r.panel.status : "none", forecasts: (r.forecasts || []).length, survey: !!r.survey }; });
  const checks = [];
  const add = (id, label, value, ok, why, fix) => checks.push({ id, label, value, ok, why, fix });
  const verdicts = R.reduce((a, x) => ((a[x.verdict] = (a[x.verdict] || 0) + 1), a), {});
  const top = Math.max(0, ...Object.values(verdicts)), share = R.length ? top / R.length : 0;
  add("verdict-spread", "Share of pieces in the most common verdict", +share.toFixed(2), share <= 0.7, "a verdict that nearly everything gets tells a reader nothing", "add synthetic items for the pieces lumped together, then adjust the verdict rules");
  const arts = R.filter((x) => x.kind !== "paper");
  const cs = arts.map((x) => x.cred);
  add("article-spread", "Credibility spread among articles (standard deviation)", +sd(cs).toFixed(1), arts.length < 3 || sd(cs) >= 8, "articles bunched at one credibility can't be told apart", "credit articles for what they can show (citing the study, naming its sample) rather than paper-style rigor");
  const g = arts.filter((x) => x.grade), rho = spearman(g.map((x) => GR[x.grade]), g.map((x) => x.cred));
  add("grade-vs-credibility", "Rank agreement of source grade and credibility among articles (Spearman)", rho, rho == null || rho >= 0.3, "a well-sourced report and a hype blog should not score alike; grade and credibility measure related things", "let citing primary research count toward an article's rigor");
  const rh = spearman(arts.map((x) => x.hype), arts.map((x) => x.cred));
  add("hype-vs-credibility", "Rank agreement of hype and credibility among articles (Spearman; should be negative)", rh, rh == null || rh <= -0.3, "more hype should mean less credibility", "check the hype word list against the real pieces");
  const papers = R.filter((x) => x.kind === "paper" && !x.survey), sp = papers.length ? papers.filter((x) => x.verdict === "minor").length / papers.length : 0;
  add("papers-minor", "Share of primary papers judged \"minor\"", +sp.toFixed(2), sp <= 0.6, "abstracts of careful papers landing in \"minor\" means the significance side is too stingy or the verdict rules too coarse", "review the verdict thresholds with synthetic papers of known size");
  const paneled = R.filter((x) => x.panel === "agreed" || x.panel === "disagreed").length / (R.length || 1);
  add("panel-coverage", "Share of reviews judged by the two-model panel", +paneled.toFixed(2), paneled >= 0.9, "REQ-055: every background judgement should be compared across two models", "set PANEL_MODELS where the watcher runs");
  return { n: R.length, kinds: R.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {}), verdicts, checks, rows: R };
}

function report(A, day) {
  const L = [`# Judging quality on real reviews, ${day}`, "", `${A.n} reviews (${Object.entries(A.kinds).map(([k, v]) => `${v} ${k}`).join(", ")}). Verdicts: ${Object.entries(A.verdicts).map(([k, v]) => `${k} ${v}`).join(", ")}.`, "",
    "These checks need no labels: they ask whether the judging tells pieces apart and whether its parts agree. A failed check is fixed by first adding a synthetic benchmark item that reproduces it (bench/review-set.json), so the fix shows as uplift.", "",
    "| Check | Value | Holds | Why it matters | Next step if not |", "| --- | --- | --- | --- | --- |",
    ...A.checks.map((c) => `| ${c.label} | ${c.value ?? "n/a"} | ${c.ok ? "yes" : "**no**"} | ${c.why} | ${c.ok ? "" : c.fix} |`), "",
    "| Piece | Kind | Grade | Credibility | Hype | Verdict |", "| --- | --- | --- | --- | --- | --- |",
    ...A.rows.map((r) => `| ${r.title.slice(0, 70)} | ${r.kind} | ${r.grade || "?"} | ${r.cred} | ${r.hype} | ${r.verdict} |`)];
  return L.join("\n") + "\n";
}

async function main() {
  const db = require("../lib/db"), { createKernel } = require("../kernel/kernel"), k = createKernel();
  db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
  const rows = await db.all("SELECT kind, title, credibility, verdict, result FROM review_docs ORDER BY id DESC LIMIT 500");
  const day = new Date().toISOString().slice(0, 10), A = analyse(rows), md = report(A, day), dir = path.join(__dirname, "..", "out", "quality");
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${day}.md`), md); console.log(md);
  console.log(`quality: ${A.checks.filter((c) => c.ok).length} of ${A.checks.length} checks hold`);
}
module.exports = { analyse, spearman };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error("quality:", e.message); process.exit(1); });
