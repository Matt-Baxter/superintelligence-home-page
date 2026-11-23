// Bake-off scorer (CONTRACT.md sections 4 to 6). One pure entry point: decide(criteria, evidence).
// Every value is pass, fail or unknown (null). Unknowns are never guessed: they widen the range
// [low, high] a build's total can still reach, and the decision is made only once ranges allow it.
"use strict";

const VERDICTS = new Set(["pass", "fail"]);

// An AT counts only when run against the deployed app (contract section 4). Self-tests and proxies
// are kept as notes so people can see them, but they never move a score.
function acceptanceFor(build, criteria, evidence) {
  const rows = criteria.acceptance.map((at) => {
    const all = (evidence.acceptance || []).filter((e) => e.build === build && e.at === at.id);
    const counted = all.filter((e) => e.on === criteria.rules.acceptanceCountsOnly && VERDICTS.has(e.result));
    const latest = counted.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    return {
      id: at.id, feature: at.feature, expected: at.expected,
      result: latest ? latest.result : null,
      by: latest ? latest.by : null,
      notes: all.filter((e) => e !== latest).map((e) => `${e.on}${e.result ? ` ${e.result}` : ""}: ${e.note || ""}`.trim()),
    };
  });
  const passed = rows.filter((r) => r.result === "pass").length;
  const unknown = rows.filter((r) => r.result === null).length;
  const n = rows.length;
  return { rows, passed, failed: n - passed - unknown, unknown, low: passed / n, high: (passed + unknown) / n };
}

// Relevance needs every sampled story judged by both partners; one "no" makes a story off-topic.
// The rule pre-check is shown as a hint and never replaces a person's judgment.
function relevanceFor(build, criteria, evidence) {
  const sample = (evidence.relevance || {})[build] || { stories: [] };
  const stories = sample.stories || [];
  const need = criteria.rules.relevanceSample;
  const judged = stories.filter((s) => s.judges && Object.values(s.judges).length >= 2 && Object.values(s.judges).every((v) => typeof v === "boolean"));
  const onTopic = judged.filter((s) => Object.values(s.judges).every(Boolean)).length;
  const hint = stories.length ? stories.filter((s) => s.ruleTopics && s.ruleTopics.length).length / stories.length : null;
  const complete = stories.length >= need && judged.length >= need;
  const value = complete ? onTopic / judged.length : null;
  return { sampled: stories.length, judged: judged.length, onTopic, need, hint, value,
    meetsTarget: value === null ? null : value >= criteria.rules.relevanceTarget };
}

function manualFor(build, id, evidence) {
  const v = ((evidence.manual || {})[build] || {})[id];
  if (!v || v.value === null || v.value === undefined) return { value: null, note: v && v.note };
  const value = Number(v.value);
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${build}.${id}: value must be 0 to 1, got ${v.value}`);
  return { value, note: v.note, by: v.by };
}

function scoreBuild(build, criteria, evidence) {
  const acceptance = acceptanceFor(build.id, criteria, evidence);
  const relevance = relevanceFor(build.id, criteria, evidence);
  const lines = criteria.criteria.map((c) => {
    let low, high, value, detail;
    if (c.id === "acceptance") { low = acceptance.low; high = acceptance.high; value = acceptance.unknown ? null : acceptance.low; detail = acceptance; }
    else if (c.id === "relevance") { value = relevance.value; low = value ?? 0; high = value ?? 1; detail = relevance; }
    else { const m = manualFor(build.id, c.id, evidence); value = m.value; low = value ?? 0; high = value ?? 1; detail = m; }
    return { id: c.id, label: c.label, weight: c.weight, value, points: value === null ? null : round(value * c.weight),
      low: round(low * c.weight), high: round(high * c.weight), detail };
  });
  const sum = (k) => round(lines.reduce((t, l) => t + l[k], 0));
  const known = lines.every((l) => l.value !== null);
  return { ...build, lines, low: sum("low"), high: sum("high"), total: known ? sum("low") : null,
    missing: lines.filter((l) => l.value !== null ? false : true).map((l) => l.label) };
}

// Decision (section 6). A build wins outright only when its worst case beats the other's best case
// by more than the tiebreak margin, or when both totals are final and differ by more than it.
// Anything closer goes to the relevance tiebreak.
function decide(criteria, evidence) {
  const [a, b] = criteria.builds.map((x) => scoreBuild(x, criteria, evidence));
  const { within, criterion } = criteria.rules.tiebreak;
  let decision;
  if (a.low > b.high + within) decision = { status: "decided", base: a.id, why: `Build ${a.id}'s lowest possible total (${a.low}) beats Build ${b.id}'s highest (${b.high}) by more than ${within}.` };
  else if (b.low > a.high + within) decision = { status: "decided", base: b.id, why: `Build ${b.id}'s lowest possible total (${b.low}) beats Build ${a.id}'s highest (${a.high}) by more than ${within}.` };
  else if (a.total !== null && b.total !== null) {
    const gap = round(Math.abs(a.total - b.total));
    if (gap > within) { const w = a.total > b.total ? a : b; decision = { status: "decided", base: w.id, why: `Build ${w.id} leads by ${gap} points.` }; }
    else {
      const ra = a.lines.find((l) => l.id === criterion).value, rb = b.lines.find((l) => l.id === criterion).value;
      decision = ra === rb
        ? { status: "tied", base: null, why: `Totals within ${within} and ${criterion} is equal; partners decide or merge.` }
        : { status: "decided", base: ra > rb ? a.id : b.id, why: `Totals within ${within} points (gap ${gap}); higher ${criterion} decides.` };
    }
  } else {
    decision = { status: "open", base: null,
      why: `Not decidable yet: the ranges overlap (A ${a.low}–${a.high}, B ${b.low}–${b.high}).`,
      needs: [...new Set([...a.missing.map((m) => `A: ${m}`), ...b.missing.map((m) => `B: ${m}`)])] };
  }
  return { contract: criteria.contract, builds: [a, b], decision };
}

const round = (x) => Math.round(x * 10) / 10;

module.exports = { decide, scoreBuild, acceptanceFor, relevanceFor };
