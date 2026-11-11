// Full-text paper analysis (REQ-057, proposed). Reads the structure from reader.js and answers, by published rules:
//   what does it claim (contributions), what backs each claim in the body (results with numbers, tables, theorems),
//   which abstract numbers can be found again in the body, how careful the work is (a full-text rigor checklist with
//   points), what it says it can't do (limitations), and what is still open (questions written from the gaps).
// Deterministic, no model calls. It reports what the paper says as the paper's claims ("the paper reports ..."), never
// as a person's, and never rates beyond what the text supports.
const { sentences } = require("../review/review");
const ontology = require("../../lib/ontology.json");

const STOP = new Set("a an and are as at be by for from has have in into is it its of on or our that the their this to we with which were was these those than then can using use used show shows".split(" "));
const tokens = (s) => (String(s).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter((w) => !STOP.has(w));
const overlap = (a, b) => { const A = new Set(tokens(a)), B = new Set(tokens(b)); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size); };
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const NUM = /(?<![\w.])[-−]?\d+(?:[.,]\d+)?\s?(?:%|×|x\b|pp\b|points?\b)?/g;
const numbersIn = (s) => (String(s).match(NUM) || []).map((x) => x.replace(/\s/g, "").replace("−", "-")).filter((x) => !/^(19|20)\d\d$/.test(x) && !/^\d$/.test(x.replace(/[%×x]/g, "")) || /[%×x]/.test(x));
const CONTRIB = /\b(we|this (paper|work|study))\s+(?:also\s+|further\s+|then\s+|first\s+|additionally\s+|finally\s+)?(propose|introduce|present|develop|design|show|find|demonstrate|prove|establish|derive|release|provide|identify|argue|construct|report|achieve|reach|obtain)s?\b|\bour (main |key )?(contribution|result|finding)s?\b|\b(results|experiments) (show|demonstrate|indicate|suggest)\b/i;
const RESULT = /\b(achiev|outperform|improv|reduc|increas|decreas|surpass|match|reach|attain|lower|higher|fewer|faster|gain|drop|beat|exceed|falls?|rises?|accuracy|score|rate|error|success)\w*/i;
const LIMIT = /\b(limitation|we (do not|don't|cannot|did not)|is limited|only (tested|evaluated|considered)|future work|we leave|remains? (open|unclear)|may not (generalize|transfer|hold)|caveat|threats? to validity)\b/i;
const HEDGE = /\b(may|might|could|suggests?|preliminary|appears? to|we hypothesi[sz]e|possibly|likely)\b/i;

// The full-text rigor checklist. Each item: what we look for, the points it earns, and how it's found. Published on
// the Responses page; the unit check keeps this list and the scorecard in step.
const CHECKS = [
  { id: "baselines", label: "Compares against baselines", points: 12, re: /\b(baselines?|compared (to|with|against)|state[- ]of[- ]the[- ]art|prior (method|work)s? (achieve|reach|score))\b/i },
  { id: "ablation", label: "Ablates its own parts", points: 10, re: /\b(ablat\w+|without (the|our) \w+ (component|module|step|term)|removing (the|each) \w+)\b/i },
  { id: "variance", label: "Reports spread (seeds, runs, intervals or error bars)", points: 14, re: /(±|\+\/-|\bstd\b|standard (deviation|error)|confidence intervals?|error bars?|\b\d+ (random )?(seeds|runs|trials|repetitions)\b|averaged over \d+|across \d+ seeds)/i },
  { id: "significance", label: "Tests whether differences are real (statistical test)", points: 8, re: /\b(p\s?[<=]\s?0?\.\d+|statistically significant|t-test|wilcoxon|bootstrap|permutation test|multiple hypothesis|false discovery)\b/i },
  { id: "heldout", label: "Evaluates on held-out or out-of-distribution data", points: 10, re: /\b(held[- ]out|out[- ]of[- ]distribution|unseen (tasks|data|domains)|test split|hidden (test|evaluation)s?|generali[sz]ation to)\b/i },
  { id: "contamination", label: "Checks for test-set contamination or leakage", points: 6, re: /\b(contaminat\w+|data leakage|leak(ed|age) (of|into)|decontaminat\w+|overlap (with|between) (the )?(training|pretraining))\b/i },
  { id: "code", label: "Releases code or data", points: 10, re: /(github\.com|huggingface\.co|zenodo|\bcode (is|will be) (publicly )?(available|released)|we (release|open-source)|open[- ]source(d)? (our|the) (code|implementation))/i },
  { id: "limitations", label: "States its limitations", points: 10, section: "limitations", re: LIMIT },
  { id: "compute", label: "Reports compute or cost", points: 4, re: /\b(gpu[- ]hours?|tpu|a100|h100|compute budget|wall[- ]clock|training (cost|time)|\$\d)/i },
  { id: "theory", label: "States a theorem or bound and proves it", points: 8, re: /\b(theorem|lemma|proposition|corollary)\s*\d|\bwe prove\b|\bproof\b/i },
  { id: "independent-benchmark", label: "Uses benchmarks it didn't build itself", points: 8, custom: true },
];
const NEGATIVE = [
  { id: "own-benchmark-only", label: "Evaluated only on a benchmark the authors introduce", points: -8 },
  { id: "abstract-untraced", label: "Abstract numbers not found again in the body", points: -6 },
  { id: "abstract-only", label: "Only the abstract could be read", points: 0 },
];

function benchmarksIn(text) {
  const t = String(text), found = new Map();
  for (const b of ontology.benchmarks || []) for (const term of [b.label, ...(b.terms || []), ...(b.aliases || [])].filter(Boolean)) if (new RegExp(`(?<![A-Za-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "i").test(t)) { found.set(b.id, b.label); break; }
  // Named datasets the registry doesn't know: "on X, Y and Z" after "benchmark(s)/dataset(s)/tasks".
  for (const m of t.matchAll(/\b(?:benchmarks?|datasets?|tasks?|suites?|(?:evaluat|test|experiment)\w*\s+on)\s*(?:\([^)]{0,40}\)\s*)?(?:such as|including|:|,)?\s*((?:[A-Z][A-Za-z0-9-]{1,24}(?:\s?[A-Z0-9][A-Za-z0-9-]*)?(?:,\s*|\s+and\s+|\s*\/\s*)?){1,6})/g))
    for (const name of m[1].split(/,\s*|\s+and\s+|\s*\/\s*/).map((x) => x.trim()).filter((x) => x.length > 2 && /[A-Z]/.test(x) && !/^(We|The|Our|This|In|On|For|Table|Figure|Section)$/.test(x))) if (!found.has(`name:${name.toLowerCase()}`)) found.set(`name:${name.toLowerCase()}`, name);
  return [...found.values()];
}

function analyse(doc, { review = null, example = null } = {}) {
  const body = doc.sections.filter((s) => !["references", "appendix", "related"].includes(s.kind));
  const all = body.map((s) => ({ s, sents: sentences(s.text).filter((x) => x.length > 30) }));
  const flat = all.flatMap(({ s, sents }) => sents.map((t, i) => ({ id: `${s.id}.${i + 1}`, section: s.heading, kind: s.kind, text: t })));
  const abs = sentences(doc.abstract || "").filter((x) => x.length > 20);
  const bodyText = flat.map((x) => x.text).join("\n"), tableText = doc.tables.map((t) => `${t.caption}\n${t.rows.map((r) => r.join(" ")).join("\n")}`).join("\n");

  // 1) Contributions: what it says it does (abstract and introduction first, then any "we show" in the body).
  const pool = [...abs.map((t, i) => ({ id: `abs.${i + 1}`, section: "Abstract", kind: "abstract", text: t })), ...flat.filter((x) => x.kind === "intro" || x.kind === "conclusion")];
  let contributions = pool.filter((x) => CONTRIB.test(x.text)).slice(0, 8);
  if (!contributions.length) contributions = pool.slice(0, 3);

  // 2) Results: sentences in method/experiments/theory with numbers or result verbs, plus table captions.
  const results = flat.filter((x) => ["experiments", "theory", "method", "other", "conclusion"].includes(x.kind) && (numbersIn(x.text).length && RESULT.test(x.text) || /\b(theorem|lemma|we prove)\b/i.test(x.text)))
    .map((x) => ({ ...x, numbers: numbersIn(x.text), hedged: HEDGE.test(x.text) }));
  const tables = doc.tables.map((t) => ({ id: `table.${t.n}`, section: `Table ${t.n}`, kind: "table", text: t.caption, numbers: numbersIn(t.rows.flat().join(" ")).slice(0, 60), rows: t.rows.length }));

  // 3) Claim -> evidence map: each contribution gets the body results and tables that share its words or numbers.
  const claims = contributions.map((c) => {
    const nums = numbersIn(c.text);
    const ev = [...results, ...tables].map((r) => ({ r, score: overlap(c.text, r.text) + (nums.some((n) => r.numbers.includes(n)) ? 0.6 : 0) })).filter((x) => x.score >= 0.28).sort((a, b) => b.score - a.score).slice(0, 3).map((x) => ({ id: x.r.id, section: x.r.section, text: x.r.text.slice(0, 400), numbers: x.r.numbers.slice(0, 8), hedged: !!x.r.hedged }));
    let level = ev.some((e) => e.numbers.length || /theorem|lemma|prove/i.test(e.text)) ? "backed" : ev.length ? "partly backed" : "not found in the body";
    // A "we propose / introduce" claim is about what the method is: the method section describing it is its evidence.
    if (!ev.length && /\b(propose|introduce|present|develop|design|construct|contribution|method|approach|framework)\b/i.test(c.text) && !nums.length) {
      const m = flat.filter((x) => x.kind === "method" || x.kind === "theory").map((x) => ({ x, s: overlap(c.text, x.text) })).filter((y) => y.s >= 0.2).sort((a, b) => b.s - a.s)[0];
      if (m) { ev.push({ id: m.x.id, section: m.x.section, text: m.x.text.slice(0, 400), numbers: [], hedged: false }); level = "described"; }
    }
    return { id: c.id, section: c.section, text: c.text, numbers: nums, level, evidence: ev };
  });

  // 4) Abstract numbers found again in the body or tables (a number only the abstract states can't be checked here).
  const absNums = [...new Set(abs.flatMap(numbersIn))];
  const traced = absNums.map((n) => ({ number: n, inBody: bodyText.includes(n) || tableText.includes(n) || bodyText.includes(n.replace(/%$/, "")) }));

  // 5) Rigor checklist over the full text (or the abstract when that's all there is).
  const where = doc.fullText ? `${bodyText}\n${tableText}\n${doc.links.join(" ")}` : `${doc.abstract}`;
  const benches = benchmarksIn(`${bodyText}\n${tableText}\n${doc.abstract}`);
  const ownBench = /\bwe (introduce|present|propose|build|construct|release|curate)\b[^.]{0,80}\b(benchmark|dataset|suite|test set)\b/i.test(`${doc.abstract}\n${bodyText}`);
  const checklist = CHECKS.map((c) => {
    let hit, evidence = null;
    if (c.custom) { hit = benches.length >= (ownBench ? 2 : 1); evidence = hit ? `Benchmarks named: ${benches.slice(0, 6).join(", ")}${ownBench ? " (one is the authors' own)" : ""}.` : null; }
    else if (c.section && doc.sections.some((s) => s.kind === c.section && s.words > 20)) { hit = true; evidence = `A "${doc.sections.find((s) => s.kind === c.section).heading}" section.`; }
    else { const m = flat.find((x) => c.re.test(x.text)) || (c.id === "code" && doc.links.length ? { text: doc.links[0], section: "links" } : null) || (!doc.fullText && c.re.test(where) ? { text: doc.abstract, section: "Abstract" } : null); hit = !!m; evidence = m ? `${m.section}: “${m.text.slice(0, 220)}${m.text.length > 220 ? "…" : ""}”` : null; }
    return { id: c.id, label: c.label, points: c.points, met: hit, earned: hit ? c.points : 0, evidence };
  });
  const penalties = [];
  if (ownBench && benches.length < 2) penalties.push({ ...NEGATIVE[0], why: "The only benchmark named is one the paper introduces." });
  const untraced = traced.filter((t) => !t.inBody);
  if (doc.fullText && absNums.length >= 2 && untraced.length / absNums.length > 0.5) penalties.push({ ...NEGATIVE[1], why: `${untraced.length} of ${absNums.length} abstract numbers (${untraced.slice(0, 4).map((t) => t.number).join(", ")}) aren't in the body text or tables we could read.` });
  if (!doc.fullText) penalties.push({ ...NEGATIVE[2], why: "Only the abstract was available, so every check below reads the abstract alone." });
  const max = CHECKS.reduce((n, c) => n + c.points, 0);
  const raw = checklist.reduce((n, c) => n + c.earned, 0) + penalties.reduce((n, p) => n + p.points, 0);
  const rigor = Math.max(0, Math.min(100, Math.round((raw / max) * 100)));

  // 6) Limitations it states, and open questions written from what's missing.
  const limitations = flat.filter((x) => x.kind === "limitations" || LIMIT.test(x.text)).slice(0, 6).map((x) => ({ id: x.id, section: x.section, text: x.text }));
  const missing = checklist.filter((c) => !c.met).map((c) => c.id);
  const Q = {
    variance: "Are the gains larger than run-to-run noise? No spread across seeds or runs is reported.",
    baselines: "Better than what? No comparison against a baseline is described.",
    ablation: "Which part does the work? The paper doesn't remove its parts one at a time.",
    heldout: "Does it hold on data it wasn't tuned on? No held-out or out-of-distribution evaluation is described.",
    contamination: "Could the test items have been seen in training? No contamination check is described.",
    code: "Can anyone rerun it? No code or data release is mentioned.",
    limitations: "Where does it stop working? The paper has no limitations section.",
    significance: "Would the differences survive a statistical test? None is reported.",
    "independent-benchmark": "Does it hold on someone else's benchmark? No benchmark from outside the paper is named.",
  };
  const questions = [...missing.filter((m) => Q[m]).map((m) => ({ from: m, text: Q[m] })), ...claims.filter((c) => c.level === "not found in the body").slice(0, 2).map((c) => ({ from: c.id, text: `Where is this shown? “${c.text.slice(0, 160)}${c.text.length > 160 ? "…" : ""}” has no matching result in the body we could read.` }))];

  const backed = claims.filter((c) => c.level === "backed").length;
  const strength = !doc.fullText ? "abstract only" : rigor >= 60 && backed >= Math.ceil(claims.length / 2) ? "well supported" : rigor >= 35 && backed ? "partly supported" : "thinly supported";
  return {
    id: doc.id, url: doc.url, title: doc.title, read: { source: doc.source, fullText: doc.fullText, words: doc.words, sections: doc.sections.map((s) => ({ id: s.id, heading: s.heading, kind: s.kind, words: s.words })), tables: doc.tables.length, figures: doc.figures.length, references: doc.references, links: doc.links },
    contributions: claims, results: results.slice(0, 20), tables, abstractNumbers: traced, benchmarks: benches, ownBenchmark: ownBench,
    checklist, penalties, rigor, rigorMax: 100, limitations, questions, strength,
    summary: `${doc.fullText ? `Read in full (${doc.words} words, ${doc.sections.length} sections, ${doc.tables.length} tables)` : "Only the abstract could be read"}. ${backed} of ${claims.length} stated contributions have a matching result in the body; full-text rigor ${rigor}/100 (${checklist.filter((c) => c.met).length} of ${checklist.length} checks met); ${strength}.`,
    review: review ? { verdict: review.verdict, credibility: review.credibility, significance: review.significance } : null,
    example: example ? { id: example.id, title: example.title, verdict: example.verdict || null, series: example.series || null } : null,
  };
}

module.exports = { analyse, CHECKS, NEGATIVE, numbersIn, benchmarksIn, overlap };
