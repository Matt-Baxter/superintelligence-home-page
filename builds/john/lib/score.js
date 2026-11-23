// Story scorecard, in the spirit of a critics score next to an audience score (Rotten Tomatoes, IMDb), kept apart
// so neither hides the other:
//   grounded  0..100 from deterministic checks, each one pass / fail / null (null = not enough to tell). It exists
//             from the moment a story arrives; no person or model has to act first.
//   buzz      0..100 from votes and public notes, each weighted by how active the person is. Shown only after
//             MIN_RATERS distinct people, so one early account can't set it.
//   salt      plain-language "grain of salt" notes: every failed or undecided check, worded for readers.
// The checks follow a short reporting rubric (RUBRIC): balance across viewpoints, independent sourcing, a primary
// source, measured wording and checkable claims. Rules only, no model call: a model's view enters solely through the
// stored assessment (lib/assess.js), and then as one check among the others, never as the score itself.
//
//   const S = require("./lib/score");
//   S.card({ story, assessment, raters })  -> { grounded, buzz, checks, salt, raters }   pure, for tests
//   await S.attach(db, stories)            -> sets story.card on each shaped story (two batched queries)
const MIN_DECIDED = 3, MIN_RATERS = 3, BUZZ_HALF = 4; // ~4 weighted reactions take buzz to 50
const NOTE_WEIGHT = 0.5;
const HYPE = /\b(breakthrough|revolutionar\w*|game[- ]?chang\w*|changes everything|shock\w*|insane|mind[- ]?blowing|agi is here|unbelievable|stunning)\b/i;
const PRIMARY_KINDS = new Set(["papers", "journal", "academic", "research-org"]);

const RUBRIC = [
  { id: "balance", label: "Viewpoints", text: "More than one kind of source covers it, so no single outlet frames it alone." },
  { id: "independence", label: "Independent", text: "Not only the organization the story is about is reporting it." },
  { id: "primary", label: "Primary source", text: "A paper or research write-up is linked, so readers can check the claim." },
  { id: "measured", label: "Measured wording", text: "The headline avoids hype words that overstate a result." },
  { id: "checkable", label: "Checkable claims", text: "Benchmark numbers come with a paper behind them." },
  { id: "corroborated", label: "Corroborated", text: "Two or more separate sources carry the story." },
  { id: "on_topic", label: "On topic", text: "The assessment layer (rules first, then a small model only if unsure) placed it in scope." },
];

// Activity classes for people who vote or comment. Newer and quieter accounts still count, just for less.
const CLASSES = [
  { id: "new", label: "New", weight: 0.5, test: (u) => u.age_days < 1 || u.activity < 3 },
  { id: "reader", label: "Reader", weight: 1, test: (u) => u.activity < 20 },
  { id: "regular", label: "Regular", weight: 1.25, test: (u) => u.activity < 100 && u.public_notes < 5 },
  { id: "contributor", label: "Contributor", weight: 1.5, test: () => true },
];
const classify = (u) => CLASSES.find((c) => c.test(u));
// Votes + 3 per public note + 5 per submitted link: writing and submitting take more effort than a click.
const activityOf = (u) => (u.votes || 0) + 3 * (u.public_notes || 0) + 5 * (u.submitted || 0);

const check = (id, pass, detail) => ({ id, label: RUBRIC.find((r) => r.id === id).label, result: pass === null ? "null" : pass ? "pass" : "fail", detail });

function checks(story, assessment) {
  const sources = story.sources || [], kinds = new Set(sources.map((s) => s.kind || "submitted"));
  const papers = (story.papers || []).length, benches = (story.analysis?.benchmarks || []).filter((b) => b.score);
  const primary = papers > 0 || sources.some((s) => PRIMARY_KINDS.has(s.kind));
  const onlyLab = sources.length > 0 && [...kinds].every((k) => k === "lab");
  const hype = String(story.title || "").match(HYPE);
  const verdict = assessment?.verdict;
  return [
    check("corroborated", (story.nsources || sources.length) >= 2, `${story.nsources || sources.length} source${(story.nsources || sources.length) === 1 ? "" : "s"}`),
    check("balance", sources.length ? kinds.size >= 2 : null, sources.length ? `${kinds.size} kind${kinds.size === 1 ? "" : "s"}: ${[...kinds].join(", ")}` : "no sources recorded"),
    check("independence", (story.orgs || []).length ? !onlyLab : null, (story.orgs || []).length ? (onlyLab ? "only the lab's own channel" : "covered beyond the lab") : "no organization named"),
    check("primary", primary ? true : null, primary ? (papers ? `${papers} paper${papers === 1 ? "" : "s"} linked` : "research source") : "no paper linked yet"),
    check("measured", !hype, hype ? `headline says "${hype[0]}"` : "no hype words in the headline"),
    check("checkable", benches.length ? primary : null, benches.length ? `${benches.length} benchmark number${benches.length === 1 ? "" : "s"}${primary ? ", paper linked" : ", no paper"}` : "no benchmark numbers claimed"),
    check("on_topic", verdict === "relevant" ? true : verdict === "irrelevant" || verdict === "reject" ? false : null,
      verdict && verdict !== "unsure" ? `${verdict} at tier ${assessment.tier}${assessment.model ? ` (${assessment.model})` : " (rules only)"}` : "not assessed yet"),
  ];
}

const SALT = {
  corroborated: { fail: "Only one source so far." },
  balance: { fail: "Every source is the same kind of outlet." },
  independence: { fail: "Self-reported: only the lab's own channel carries it." },
  primary: { null: "No paper linked yet; treat claims as unverified." },
  measured: { fail: "The headline uses hype wording." },
  checkable: { fail: "Benchmark numbers with no paper behind them." },
  on_topic: { fail: "The assessment layer judged it off topic." },
};

function card({ story, assessment = null, raters = [] }) {
  const list = checks(story, assessment);
  const decided = list.filter((c) => c.result !== "null"), passed = decided.filter((c) => c.result === "pass").length;
  const grounded = decided.length >= MIN_DECIDED ? Math.round((100 * passed) / decided.length) : null;
  const people = new Map();
  for (const r of raters) {
    const p = people.get(r.user_id) || { cls: classify({ ...r, activity: activityOf(r) }), votes: 0, notes: 0 };
    if (r.kind === "vote") p.votes++; else p.notes++;
    people.set(r.user_id, p);
  }
  const byClass = Object.fromEntries(CLASSES.map((c) => [c.id, 0]));
  let weighted = 0;
  for (const p of people.values()) { byClass[p.cls.id]++; weighted += p.cls.weight * (Math.min(1, p.votes) + NOTE_WEIGHT * Math.min(3, p.notes)); }
  const buzz = people.size >= MIN_RATERS ? Math.round(100 * (1 - Math.pow(0.5, weighted / BUZZ_HALF))) : null;
  const salt = list.map((c) => SALT[c.id]?.[c.result]).filter(Boolean);
  return { grounded, buzz, checks: list, salt, raters: { count: people.size, weighted: Math.round(weighted * 100) / 100, byClass } };
}

async function attach(db, stories) {
  if (!stories.length) return stories;
  const ids = stories.map((s) => s.id), q = ids.map(() => "?").join(",");
  const assessed = new Map((await db.all(`SELECT story_id, tier, verdict, confidence, model FROM assessments WHERE story_id IN (${q})`, ...ids).catch(() => [])).map((a) => [a.story_id, a]));
  // One row per reaction, with the reacting person's activity totals.
  const rows = await db.all(`SELECT x.story_id, x.kind, u.id AS user_id, u.created_at,
      (SELECT COUNT(*) FROM votes v WHERE v.user_id = u.id) AS votes,
      (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id AND n.private = 0) AS public_notes,
      (SELECT COUNT(*) FROM stories s WHERE s.submitted_by = u.id) AS submitted
    FROM (SELECT story_id, user_id, 'vote' AS kind FROM votes WHERE story_id IN (${q})
          UNION ALL SELECT story_id, user_id, 'note' AS kind FROM notes WHERE private = 0 AND story_id IN (${q})) x
    JOIN users u ON u.id = x.user_id`, ...ids, ...ids);
  const now = Date.now(), byStory = new Map();
  for (const r of rows) {
    const t = Date.parse(String(r.created_at || "").replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(r.created_at || "")) ? "" : "Z"));
    r.age_days = Number.isFinite(t) ? (now - t) / 864e5 : 365;
    if (!byStory.has(r.story_id)) byStory.set(r.story_id, []);
    byStory.get(r.story_id).push(r);
  }
  for (const s of stories) s.card = card({ story: s, assessment: assessed.get(s.id) || null, raters: byStory.get(s.id) || [] });
  return stories;
}

module.exports = { card, attach, checks, classify, activityOf, RUBRIC, CLASSES, MIN_RATERS, MIN_DECIDED };
