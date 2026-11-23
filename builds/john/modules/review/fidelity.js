// Paraphrase fidelity: does an agent's paraphrase say what its source abstract says? (specs/003-judge-fidelity,
// REQ-033, task T020.) Pure and deterministic: no model calls, no dependencies, the same answer every time.
//
//   fidelity(source, paraphrase) -> { pass, checks: [{ id, pass, detail, sentence, source }], summary, failed,
//                                     alignment: [{ sentence, source, overlap }], version }
//
// The scores never come from the paraphrase (REQ-033): the watcher judges the abstract and only shows a paraphrase
// that passes here. Eight checks, ids fixed by bench/fidelity-cases.json:
//   numbers        every number in the paraphrase is in the source; every number in the source is in the paraphrase
//                  (unless the paraphrase is a short summary: under 60% of the source's content words)
//   units          a number that is in the source carries the same unit ("4 percentage points" is not "4%")
//   hedges         a hedged source sentence (may, might, could, suggests, indicates, appears to, preliminary, likely)
//                  keeps a hedge in the paraphrase sentences aligned to it; an overclaim verb the source doesn't use
//                  (proves, guarantees, enables, demonstrates, establishes, confirms) is a hedge violation too
//   negation       a negated source clause stays negated, and a paraphrase clause isn't negated unless its source is
//   claims-added   a paraphrase clause with 2 or more content words that appear nowhere in the source adds a claim
//   claims-dropped a source claim clause whose content words are under 60% present in the paraphrase is dropped
//   entities       hyphenated capitalised names (Sample-Net) and capitalised words inside a sentence are in the source
//   limitations    a source limitation clause (limitations, only, future work, may not, not evaluate/scale/transfer,
//                  outside our evaluation, limited to) has a paraphrase sentence with a limitation cue covering half
//                  of its content words
//
// How sentences are compared. Text is normalised first (number words -> digits, "per cent" -> %, "percentage points"
// -> pp, 1,200 -> 1200, 40M / 40-million / 32 thousand -> the value, "no X" -> 0 X, "twice" -> 2x). Content words are
// the remaining words minus stop words, hedge, overclaim and negation words, stemmed by a small suffix stripper and
// mapped through a short list of common paraphrase synonyms (repair~fix, publish~release, drop~fall, test~evaluate...).
// overlap(S, P) = |S ∩ P| / |S|, the share of a source sentence's content words found in a paraphrase sentence.
// Thresholds, each stated once: ALIGN 0.5 (a paraphrase sentence is aligned to a source sentence), COVER 0.6 (a source
// claim is still present somewhere in the paraphrase), SAME 0.75 (the paraphrase restates a negated clause closely
// enough that losing the negation is an inversion, not a drop), NOVEL 2 (new content words that make an added claim).
// Each defect is blamed once: a sentence the negation check blames isn't also blamed by numbers, limitations or
// claims-dropped (it is noted in their detail instead).
//
// Not checked (known limits): bounds and approximations ("less than 1 pp" vs "1 pp", "~4%"), the direction of a
// comparison ("more" vs "less"), causal words added ("so", "because"), hedges ADDED to a certain claim, and any claim
// whose new wording happens to reuse the source's words. Synonyms outside the list read as new words.
const VERSION = "1.0.0";
const ALIGN = 0.5, COVER = 0.6, SAME = 0.75, NOVEL = 2, SHORT = 0.6, LIMIT_COVER = 0.5;

// ---------- normalisers (worth sharing with the judge's own text layer) ----------
// Split at . ! ? followed by space and a capital, digit or opening quote, keeping common abbreviations inside.
const ABBR = /\b(?:et al|e\.g|i\.e|fig|figs|eq|eqs|approx|vs|cf|no|sec|tab|ref)\.$/i;
function sentences(text) {
  const parts = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])/);
  const out = [];
  for (const p of parts) { if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += " " + p; else out.push(p); }
  return out.map((s) => s.trim()).filter(Boolean);
}
const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const MULT = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
const NW = `(?:${[...Object.keys(SMALL), ...Object.keys(MULT)].join("|")})`;
const WORDSEQ = new RegExp(`\\b${NW}(?:[\\s-]+${NW})*\\b`, "g");
function wordsToNumber(seq) {
  let total = 0, cur = 0;
  for (const w of seq.split(/[\s-]+/)) {
    if (w in SMALL) cur += SMALL[w];
    else if (w === "hundred") cur = (cur || 1) * 100;
    else { total += (cur || 1) * MULT[w]; cur = 0; }
  }
  return total + cur;
}
const fmt = (n) => String(Math.round(n * 1e6) / 1e6);
// Lowercase text with numbers as digits and units as symbols: "forty-one and fifty-eight percent" -> "41 and 58 %".
function normNumbers(text) {
  let t = String(text || "").toLowerCase().replace(/[   ]/g, " ").replace(/[–—]/g, "-");
  t = t.replace(/(\d),(?=\d{3}\b)/g, "$1");
  t = t.replace(/\bper ?cent\b|\bpercent\b/g, "%").replace(/\bpercentage[- ]points?\b/g, "pp");
  t = t.replace(/\b(\d+(?:\.\d+)?)\s*-?\s*(thousand|million|billion|trillion)\b/g, (_, n, m) => fmt(Number(n) * MULT[m]));
  t = t.replace(/\b(\d+(?:\.\d+)?)(k|m|b)\b/g, (_, n, m) => fmt(Number(n) * { k: 1e3, m: 1e6, b: 1e9 }[m]));
  t = t.replace(WORDSEQ, (s) => fmt(wordsToNumber(s)));
  t = t.replace(/\bnone\b|\bno\b(?= (?!longer|more|less|doubt)[a-z])/g, "0");
  t = t.replace(/\btwice\b|\bdoubles?\b|\bdoubled\b/g, "2x").replace(/\btriples?\b|\btripled\b/g, "3x");
  return t;
}
const UNIT = [[/^\s*%/, "%"], [/^\s*pp\b/, "pp"], [/^\s*(?:x\b|×|times\b|-?fold\b)/, "x"], [/^\s*points?\b/, "points"]];
const QUAL = /(~|\babout|\baround|\bapproximately|\broughly|\bnearly|\balmost|\bless than|\bmore than|\bunder|\bover|\bup to|\bat least|\bat most)\s*$/;
// Numbers with units, from text. A number glued to a name ("Sample-Net-2", "GPT4") is part of the name and skipped.
function quantities(text) {
  const out = [];
  sentences(text).forEach((sent, si) => {
    const t = normNumbers(sent), qs = [];
    for (const m of t.matchAll(/(\d+(?:\.\d+)?)/g)) {
      const before = t.slice(0, m.index), after = t.slice(m.index + m[0].length);
      if (/[a-z]-?$/.test(before) || /^\.\d/.test(after)) continue;
      const unit = (UNIT.find(([re]) => re.test(after)) || [null, ""])[1];
      qs.push({ value: Number(m[1]), unit, approx: (before.match(QUAL) || [])[1] || null, text: m[0] + (unit ? (unit === "%" || unit === "x" ? unit : " " + unit) : ""), at: m.index, end: m.index + m[0].length, sentence: sent, si });
    }
    // Ranges: "41 and 58 %", "3-5%", "41 to 58%": the first number takes the second one's unit.
    for (let i = qs.length - 2; i >= 0; i--) if (!qs[i].unit && qs[i + 1].unit && /^\s*(?:and|to|-|or)\s*$/.test(t.slice(qs[i].end, qs[i + 1].at))) { qs[i].unit = qs[i + 1].unit; qs[i].text += qs[i].unit === "%" ? "%" : ` ${qs[i].unit}`; }
    out.push(...qs);
  });
  return out;
}

const STOP = new Set(("a an the and or but of on in to for with by from as at about over under above below beyond between across into onto upon up down than more less most least " +
  "this that these those it its they them their there here we our us you he she his her is are was were be been being am do does did has have had " +
  "will would shall should can also only not no nor never whether when if which while though although so such each any all both some very just then " +
  "what who whom where how overall against within per x pp").split(" "));
const HEDGE = /\b(may|might|could|suggests?|suggested|suggesting|indicates?|indicated|indicating|seems?|seemed|appears? (?:to|that)|preliminary|likely|possibly|perhaps|tentative(?:ly)?)\b/i;
const HEDGE_W = /^(may|might|could|suggest\w*|indicat\w*|seem\w*|preliminary|likely|possibly|perhaps|tentative\w*)$/;
const OVERCLAIM = /\b(prove[sdn]?|proving|guarantee[sd]?|guaranteeing|enable[sd]?|enabling|demonstrate[sd]?|demonstrating|establish(?:es|ed|ing)?|confirm(?:s|ed|ing)?)\b/gi;
const NEG = /\b(?:not|never|without|neither|nor|cannot)\b|n't\b|\bfail(?:s|ed)? to\b|\boutside (?:of )?(?:our|the) (?:evaluation|scope|study)\b/i;
const NEG_W = /^(not|never|without|neither|nor|cannot|outside|fail|fails|failed)$/;
const LIMIT = /\blimitations?\b|\bcaveats?\b|\bonly\b|\bfuture work\b|\blimited to\b|\b(?:may|might|could|will) not\b|\bnot (?:evaluate|test|cover|study|transfer|generali[sz]e|scale|hold|compare)|\boutside (?:of )?(?:our|the) (?:evaluation|scope|study)\b/i;
// Common paraphrase synonyms, mapped to one word before stemming. Kept short and generic; anything else reads as new.
const SYN = { describe: "present", describes: "present", described: "present", introduce: "present", introduces: "present", introduced: "present", propose: "present", proposes: "present", proposed: "present",
  test: "evaluate", tests: "evaluate", tested: "evaluate", testing: "evaluate", assess: "evaluate", assesses: "evaluate", assessed: "evaluate", evaluation: "evaluate",
  repair: "fix", repairs: "fix", repaired: "fix", fixes: "fix", fixed: "fix",
  raise: "improve", raises: "improve", raised: "improve", increase: "improve", increases: "improve", increased: "improve", boost: "improve", boosts: "improve", gain: "improve", gains: "improve", improvement: "improve", improvements: "improve",
  carry: "transfer", carries: "transfer", generalise: "transfer", generalize: "transfer", generalises: "transfer", generalizes: "transfer",
  drop: "fall", drops: "fall", dropped: "fall", falls: "fall", falling: "fall", fell: "fall", decline: "fall", declines: "fall", decrease: "fall", decreases: "fall",
  publish: "release", publishes: "release", published: "release", reach: "score", reaches: "score", obtain: "score", obtained: "score", obtains: "score",
  sit: "appear", sits: "appear", place: "appear", placed: "appear", lies: "appear", located: "appear", mid: "middle", left: "leave" };
function stem(w0) {
  let w = SYN[w0] || w0;
  if (w.length <= 3) return w;
  w = w.replace(/ies$/, "y").replace(/([^s])s$/, "$1");
  w = w.replace(/(?:ment|ing|ion|ed|er|ly)$/, "");
  w = w.replace(/e$/, "").replace(/([b-df-hj-np-tv-z])\1$/, "$1");
  return w.length >= 2 ? w : w0;
}
// Capitalised names: any hyphenated capitalised word (Sample-Net), or a capitalised word that doesn't start a sentence.
function entities(sent) {
  const out = [];
  for (const m of sent.matchAll(/(?<![\w-])[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+|(?<![\w-])[A-Z][a-z0-9]*[A-Z0-9][A-Za-z0-9]*|(?<![\w-])[A-Z][a-z]+(?![\w-])/g)) {
    const first = !sent.slice(0, m.index).replace(/["'(\[\s]/g, "");
    if (first && !m[0].includes("-") && !/[A-Z0-9].*[A-Z0-9]/.test(m[0].slice(1))) continue;
    out.push(m[0]);
  }
  return out;
}
// Content words of a piece of text (a set of stems). Entity words are left out when `skipEntities` is set.
function content(text, skipEntities = false) {
  let t = String(text || "");
  if (skipEntities) for (const e of entities(t)) t = t.replace(e, " ");
  const ws = normNumbers(t).match(/[a-z]+/g) || [];
  return new Set(ws.filter((w) => !STOP.has(w) && !HEDGE_W.test(w) && !NEG_W.test(w) && !/^(prove|proves|proven|proved|guarantee\w*|enable\w*|demonstrat\w*|establish\w*|confirm\w*)$/.test(w)).map(stem));
}
const share = (a, b) => { if (!a.size) return 1; let n = 0; for (const x of a) if (b.has(x)) n++; return n / a.size; };
const minShare = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.min(a.size, b.size); };
const jaccard = (a, b) => { const u = new Set([...a, ...b]); if (!u.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / u.size; };
const union = (sets) => new Set(sets.flatMap((s) => [...s]));
// Clauses: every comma, semicolon and colon, and the contrastive words, split a sentence (for added claims and negation).
const clauses = (s) => s.split(/,(?!\d{3}\b)\s*|[;:]\s*|\s+(?=(?:but|while|though|although|whereas)\b)/).map((x) => x.trim()).filter(Boolean);
// Coarser units for limitations and dropped claims: only contrastive boundaries split ("..., but only under ...").
const units = (s) => s.split(/;\s*|,(?!\d{3}\b)\s*(?=(?:but|which|though|although|whereas|while)\b)/).map((x) => x.trim()).filter(Boolean);
const short = (s, n = 160) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function fidelity(source, paraphrase) {
  const S = sentences(source), P = sentences(paraphrase);
  const Sc = S.map((s) => content(s)), Pc = P.map((s) => content(s)), Pall = union(Pc), Sall = union(Sc);
  const checks = {}, blamed = new Set(), notes = {};
  const fail = (id, detail, sentence, src = null) => { (checks[id] ||= []).push({ detail, sentence, source: src }); };
  const note = (id, msg) => { (notes[id] ||= []).push(msg); };
  const bestP = (c) => P.reduce((b, _, i) => { const o = share(c, Pc[i]); return o > b.o ? { i, o } : b; }, { i: -1, o: 0 });
  const bestS = (c) => S.reduce((b, _, i) => { const o = jaccard(c, Sc[i]); return o > b.o ? { i, o } : b; }, { i: -1, o: 0 });
  const alignment = P.map((p, i) => { const b = bestS(Pc[i]); return { sentence: short(p), source: b.i >= 0 ? short(S[b.i]) : null, overlap: Math.round(b.o * 100) / 100 }; });

  // ---- negation (first, so other checks don't blame the same sentence twice) ----
  const negUnits = (sents) => sents.flatMap((s, si) => clauses(s).filter((c) => NEG.test(c)).map((c) => { const cc = content(c); return { c, si, cc: cc.size >= 2 ? cc : content(s) }; }));
  const sNeg = negUnits(S), pNeg = negUnits(P);
  for (const n of sNeg) {
    if (pNeg.some((m) => minShare(n.cc, m.cc) >= 0.5)) continue;
    const b = bestP(n.cc);
    if (b.o >= SAME) { blamed.add(n.si); fail("negation", `the source says "${short(n.c, 90)}" (negated); the paraphrase restates it without the negation`, P[b.i], S[n.si]); }
  }
  for (const m of pNeg) {
    if (!m.cc.size || sNeg.some((n) => minShare(n.cc, m.cc) >= 0.5)) continue;
    const b = bestS(m.cc); if (b.i >= 0) blamed.add(b.i);
    fail("negation", `"${short(m.c, 90)}" is negated, but the source sentence it restates isn't`, P[pNeg.indexOf(m) >= 0 ? m.si : 0], b.i >= 0 ? S[b.i] : null);
  }

  // ---- numbers and units ----
  const qS = quantities(source), qP = quantities(paraphrase);
  const tooShort = Pall.size < SHORT * Sall.size;
  for (const q of qP) {
    if (qS.some((r) => same(r.value, q.value) && r.unit === q.unit)) continue;
    const r = qS.find((r) => same(r.value, q.value));
    if (r) fail("units", `${q.text} in the paraphrase is ${r.text} in the source (${r.unit || "a count"} vs ${q.unit || "a count"})`, q.sentence, r.sentence);
    else fail("numbers", `${q.text} is not in the source`, q.sentence, null);
  }
  for (const r of qS) {
    if (qP.some((q) => same(q.value, r.value))) continue;
    if (blamed.has(r.si)) { note("numbers", `${r.text} is missing, counted under negation`); continue; }
    if (tooShort) { note("numbers", `${r.text} is not mentioned (a short summary may leave numbers out)`); continue; }
    fail("numbers", `${r.text} from the source is missing`, null, r.sentence);
  }

  // ---- hedges and overclaim verbs ----
  S.forEach((s, si) => {
    if (!HEDGE.test(s)) return;
    const aligned = P.map((p, i) => ({ p, o: share(Sc[si], Pc[i]) })).filter((x) => x.o >= ALIGN);
    if (!aligned.length || aligned.some((x) => HEDGE.test(x.p))) return;
    const best = aligned.sort((a, b) => b.o - a.o)[0];
    fail("hedges", `the source hedges this ("${(s.match(HEDGE) || [])[0]}"); the paraphrase states it without a hedge`, best.p, s);
  });
  const srcOver = new Set((String(source).match(OVERCLAIM) || []).map((w) => stem(w.toLowerCase())));
  for (const p of P) for (const w of p.match(OVERCLAIM) || []) if (!srcOver.has(stem(w.toLowerCase()))) fail("hedges", `"${w}" claims more than the source, which never uses it`, p, null);

  // ---- entities ----
  const srcLow = String(source).toLowerCase();
  const hasName = (e) => new RegExp(`(?<![\\w-])${e.toLowerCase().replace(/[-]/g, "\\-")}(?![\\w-])`).test(srcLow);
  // A hyphenated compound of source words ("English-only") is a rewording, not a new name.
  const known = (e) => hasName(e) || (e.includes("-") && e.split("-").every((part) => hasName(part)));
  for (const p of P) for (const e of entities(p)) if (!known(e)) fail("entities", `"${e}" is not named in the source`, p, null);

  // ---- claims added: a clause with NOVEL or more content words found nowhere in the source ----
  const Sall2 = union(S.map((s) => content(s)));
  for (const p of P) for (const c of clauses(p)) {
    const novel = [...content(c, true)].filter((w) => !Sall2.has(w));
    if (novel.length >= NOVEL) fail("claims-added", `"${short(c, 90)}" has ${novel.length} content words the source never uses (${novel.join(", ")})`, p, null);
  }

  // ---- limitations, then dropped claims ----
  const limitP = P.map((p, i) => ({ p, has: LIMIT.test(p), c: Pc[i] })).filter((x) => x.has);
  const limitUnits = new Set();
  S.forEach((s, si) => units(s).forEach((u) => {
    if (!LIMIT.test(u)) return;
    limitUnits.add(`${si}:${u}`);
    const uc = content(u).size >= 2 ? content(u) : Sc[si];
    if (limitP.some((x) => share(uc, x.c) >= LIMIT_COVER)) return;
    if (blamed.has(si)) { note("limitations", `"${short(u, 80)}" is gone, counted under negation`); return; }
    blamed.add(si);
    fail("limitations", `the source's limitation "${short(u, 90)}" has no counterpart in the paraphrase`, null, s);
  }));
  S.forEach((s, si) => units(s).forEach((u) => {
    if (limitUnits.has(`${si}:${u}`)) return;
    const uc = content(u); if (uc.size < 2) return;
    const o = share(uc, Pall); if (o >= COVER) return;
    if (blamed.has(si)) { note("claims-dropped", `"${short(u, 80)}" is gone, counted under another check`); return; }
    fail("claims-dropped", `"${short(u, 90)}" is missing from the paraphrase (${Math.round(o * 100)}% of its content words present)`, null, s);
  }));

  const IDS = ["numbers", "units", "hedges", "negation", "claims-added", "claims-dropped", "entities", "limitations"];
  const out = IDS.map((id) => {
    const f = checks[id] || [], n = notes[id] || [];
    return { id, pass: !f.length, detail: f.length ? f.map((x) => x.detail).join("; ") : n.length ? `ok (${n.join("; ")})` : "ok", sentence: f.length ? short((f[0].sentence || f[0].source || "")) || null : null, source: f.length && f[0].source ? short(f[0].source) : null };
  });
  const failed = out.filter((c) => !c.pass).map((c) => c.id);
  const summary = failed.length ? `unfaithful: ${failed.map((id) => `${id} (${out.find((c) => c.id === id).detail.split("; ")[0]})`).join("; ")}` : "faithful: all 8 checks pass";
  return { pass: !failed.length, failed, checks: out, summary, alignment, version: VERSION };
}

// Accuracy on a labelled set shaped like bench/fidelity-cases.json: a case is right when pass matches and, for an
// unfaithful one, the expected check is among the failures ("exact" when it is the only one). Used by the unit test and bench.
function evaluate(set) {
  const rows = [];
  for (const s of set.sources || []) for (const p of s.paraphrases || []) {
    const r = fidelity(s.text, p.text), e = p.expect || {};
    const right = r.pass === e.pass && (e.pass || r.failed.includes(e.check));
    rows.push({ id: p.id, kind: p.kind, expect: e.check || null, failed: r.failed, right, exact: right && (e.pass || r.failed.length === 1), summary: r.summary });
  }
  const of = (k) => rows.filter((x) => x.kind === k), rate = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : 1);
  return { n: rows.length, right: rows.filter((x) => x.right).length, accuracy: rate(rows, (x) => x.right), faithfulPass: rate(of("faithful"), (x) => x.right),
    unfaithfulCaught: rate(of("unfaithful"), (x) => x.failed.length > 0), expectedCheck: rate(of("unfaithful"), (x) => x.right), onlyExpected: rate(of("unfaithful"), (x) => x.exact),
    misses: rows.filter((x) => !x.right), extra: rows.filter((x) => x.right && !x.exact), rows };
}

module.exports = { fidelity, evaluate, sentences, quantities, normNumbers, content, stem, entities, VERSION, CHECKS: ["numbers", "units", "hedges", "negation", "claims-added", "claims-dropped", "entities", "limitations"] };
