// Corrective pass over an analysis run. Each rule inspects a step's verdict against its own evidence
// (and, for cross-step rules, against other steps). Rules run repeatedly until a pass changes nothing,
// so a correction can trigger further corrections. Every application is recorded in the trace.
//
// Verdict vocabulary after critique:
//   pass / fail          - the evidence is the acceptance test itself
//   supports / contradicts - proxy evidence; reported, never counted (CONTRACT.md: probes are notes)
//   unknown              - not decided by this run
"use strict";

const SAMPLE_DATA_ATS = new Set(["AT-01", "AT-02", "AT-03", "AT-04", "AT-05", "AT-06"]);
const HUMAN_ATS = new Set(["AT-07", "AT-08", "AT-09", "AT-10", "AT-11", "AT-12", "AT-14"]);
const MAX_PASSES = 6;

const RULES = [
  {
    id: "left-the-site",
    why: "The step ended on another origin, so what it observed is not the build under test.",
    apply(s) {
      if (!s.evidence || s.evidence.sameOrigin !== false) return null;
      return s.verdict !== "unknown" ? "unknown" : null;
    },
  },
  {
    id: "proxy-cannot-decide",
    why: "Probe evidence on live data cannot decide a test defined on the shared sample data or a human step.",
    apply(s) {
      if (s.evidence?.kind !== "probe") return null;
      if (!(SAMPLE_DATA_ATS.has(s.at) || HUMAN_ATS.has(s.at))) return null;
      if (s.verdict === "pass") return "supports";
      if (s.verdict === "fail") return "contradicts";
      return null;
    },
  },
  {
    id: "no-evidence-no-verdict",
    why: "A verdict with no recorded evidence is not a verdict.",
    apply(s) {
      const empty = !s.evidence || Object.keys(s.evidence).filter((k) => k !== "kind").length === 0;
      return empty && s.verdict !== "unknown" ? "unknown" : null;
    },
  },
  {
    id: "filter-precondition",
    why: "The phone check for AT-13 only counts on the filtered view; if the filter step is not a pass, neither is this.",
    apply(s, all) {
      if (s.at !== "AT-13" || s.evidence?.kind !== "measure") return null;
      const filter = all.find((o) => o.at === "AT-13" && o !== s && o.evidence && "found" in o.evidence);
      if (!filter || filter.verdict === "pass") return null;
      if (s.verdict === "pass") return "supports";
      if (s.verdict === "fail") return "contradicts";
      return null;
    },
  },
  {
    id: "rule-tagger-is-one-sided",
    why: "The title-only rule tagger can raise doubt about a filter but cannot confirm it, so a filter pass rests on it alone is downgraded.",
    apply(s) {
      if (s.at !== "AT-13" || !s.evidence || !("ruleAlignment" in s.evidence)) return null;
      return s.verdict === "pass" ? "supports" : null;
    },
  },
];

function critique(input) {
  const steps = input.map((s) => ({ ...s, evidence: s.evidence && { ...s.evidence }, corrections: [] }));
  const trace = [];
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    let changed = 0;
    for (const s of steps) {
      for (const r of RULES) {
        const to = r.apply(s, steps);
        if (to && to !== s.verdict) {
          trace.push({ pass, rule: r.id, step: s.n, at: s.at, from: s.verdict, to, why: r.why, changed: true });
          s.corrections.push({ rule: r.id, from: s.verdict, to });
          s.verdict = to; changed++;
        }
      }
    }
    trace.push({ pass, rule: "fixed-point-check", changed: false, note: changed ? `${changed} correction(s); running again` : "no corrections; stable" });
    if (!changed) break;
  }
  return { steps, trace };
}

function byTest(steps) {
  const order = { fail: 0, contradicts: 1, unknown: 2, supports: 3, pass: 4 };
  const out = {};
  for (const s of steps) {
    const cur = out[s.at];
    if (!cur || order[s.verdict] < order[cur]) out[s.at] = s.verdict;
  }
  return out;
}

module.exports = { critique, byTest, RULES };
