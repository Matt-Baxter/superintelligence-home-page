import { z } from "zod";

// The learning report as data: every row says where an idea came from, what the other build lacked,
// and what the combined build added on top. The /compare page renders this; tests pin its shape.

export const BuildIdSchema = z.enum(["matt", "john", "combined"]);
export type BuildId = z.infer<typeof BuildIdSchema>;

export const BUILDS: Record<BuildId, { name: string; author: string; tool: string; stack: string }> = {
  matt: { name: "Build A", author: "Matt", tool: "Claude Code + Spec Kit", stack: "Next.js 16, TypeScript, Postgres" },
  john: { name: "Build B", author: "John", tool: "v0", stack: "Express, CommonJS, custom module kernel" },
  combined: { name: "Combined", author: "Both", tool: "v0, from both specs", stack: "Next.js 16, React 19, Zod, Postgres" },
};

export const ComparisonRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  area: z.string(),
  matt: z.string(),
  john: z.string(),
  pickedFrom: z.enum(["matt", "john", "both"]),
  combinedAddition: z.string(),
  lesson: z.string(),
});
export type ComparisonRow = z.infer<typeof ComparisonRowSchema>;

export const COMPARISON: ComparisonRow[] = ComparisonRowSchema.array().parse([
  {
    id: "framework",
    area: "Framework",
    matt: "Next.js App Router, typed end to end, forms work without JavaScript.",
    john: "Express monolith with string templates and a custom module kernel.",
    pickedFrom: "matt",
    combinedAddition: "Every write route answers both HTML forms and JSON, validated by one Zod schema.",
    lesson: "A boring, typed foundation made every later graft cheaper.",
  },
  {
    id: "topics",
    area: "Topic tagging",
    matt: "Flat list of 9 topics. Matched 64% of a hand-labelled sample.",
    john: "28-topic tree with orgs, benchmarks and researchers. Matched 85%, but let in medical and vision papers.",
    pickedFrom: "both",
    combinedAddition: "Matt's spec phrases plus John's tree, behind a context check that rejects look-alike words.",
    lesson: "Recall came from John, precision from Matt's stricter phrases. Neither alone was enough.",
  },
  {
    id: "topic-filter",
    area: "Topic filter",
    matt: "Missing. Failed acceptance test AT-13.",
    john: "Present, but 14 of 16 alignment results were off-topic.",
    pickedFrom: "john",
    combinedAddition: "Shareable URL filter with named presets, backed by the precision gate above.",
    lesson: "A feature that exists but returns wrong results is still a failed test.",
  },
  {
    id: "scoring",
    area: "Significance score",
    matt: "One paid model call per story, off when no key, capped at 5 a day.",
    john: "Free 0–100 rule-based score with a point-by-point breakdown, plus a 3-tier model cascade.",
    pickedFrom: "john",
    combinedAddition: "The free score always runs; models only judge what rules cannot decide, under a daily spend ceiling.",
    lesson: "Explainable rules first, models second, keeps cost and trust under control.",
  },
  {
    id: "accounts",
    area: "Accounts",
    matt: "scrypt hashing, hashed session tokens, constant-time login.",
    john: "Bot honeypot, sign-in lockout, per-member budgets.",
    pickedFrom: "both",
    combinedAddition: "Required email, per-IP sign-up throttle and a sign-up watch ledger.",
    lesson: "Crypto hygiene and abuse controls solve different problems; you need both.",
  },
  {
    id: "audit",
    area: "Audit trail",
    matt: "Public ledger showing why each story was kept or dropped.",
    john: "Story provenance with first-seen time per outlet.",
    pickedFrom: "both",
    combinedAddition: "Human review queue: uncertain stories go to readers, three agreeing votes adjust the rating.",
    lesson: "Showing the machine's reasons invites people to correct it. Give them a place to do that.",
  },
  {
    id: "archive",
    area: "History",
    matt: "Resumable 2023–present backfill with a cursor.",
    john: "Weekly brief, source health, OPML and Atom export.",
    pickedFrom: "both",
    combinedAddition: "A harvest run ledger records per-source success and failure for every fetch.",
    lesson: "Silent feed failures were the main data-quality risk in both builds.",
  },
  {
    id: "spend",
    area: "Usage and spend",
    matt: "Fixed daily cap of 5 model calls.",
    john: "Per-member budgets on heavy routes.",
    pickedFrom: "both",
    combinedAddition: "Per-tier quotas on every write route, plus operator settings for AI units, Tier 2 escalation and harvest size.",
    lesson: "Limits belong in one table that both the code and the public limits page read.",
  },
]);

export type ProvenanceTally = Record<"matt" | "john" | "both", number>;

export function tallyProvenance(rows: ComparisonRow[] = COMPARISON): ProvenanceTally {
  return rows.reduce<ProvenanceTally>(
    (acc, row) => {
      acc[row.pickedFrom] += 1;
      return acc;
    },
    { matt: 0, john: 0, both: 0 },
  );
}
