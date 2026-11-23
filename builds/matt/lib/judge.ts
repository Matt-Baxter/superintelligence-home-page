import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { sql } from "./db";

// AI significance judge for Build A (Build A plan; research §14). Claude scores each story 1–10 for
// how meaningful a development it is on the path to superintelligence. Only stories scoring
// JUDGE_MIN_SCORE or higher appear in the feed, each with Claude's one-line reason, labelled as
// an AI assessment.
//
// Modes (env JUDGE): "anthropic" calls Claude; "fixtures" is a fake judge for tests (no API calls);
// "off" disables judging and shows every keyword-matched story. Default: "anthropic" when
// ANTHROPIC_API_KEY is set, otherwise "off", so the site keeps working before the key is added.

export const JUDGE_MIN_SCORE = 8;
// At most this many stories per day appear (env DAILY_CAP, default 5): the top-scoring ones, so
// the bar is relative to what else happened that day. Days are counted in Central time.
export const DAILY_CAP_DEFAULT = 5;
export const FEED_TIME_ZONE = "America/Chicago";

export function dailyCap(): number {
  const n = Number.parseInt(process.env.DAILY_CAP ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DAILY_CAP_DEFAULT;
}
export const DEFAULT_JUDGE_MODEL = "claude-haiku-5-5";
const MAX_PER_RUN = 300;
const CONCURRENCY = 4;

export type JudgeMode = "anthropic" | "fixtures" | "off";

export function judgeMode(): JudgeMode {
  const mode = process.env.JUDGE;
  if (mode === "anthropic" || mode === "fixtures" || mode === "off") return mode;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "off";
}

export function judgeModel(): string {
  return judgeMode() === "fixtures" ? "fixture-judge" : process.env.JUDGE_MODEL || DEFAULT_JUDGE_MODEL;
}

export type StoryToJudge = { title: string; summary: string; sources: string[]; published: Date };
export type Judgment = { score: number; reason: string };

// The scoring guide. Matt reviews and tunes this; it decides what "meaningful" means for Build A.
export const SCORING_GUIDE = `You rate stories for the Superintelligence Homepage, a site that shows only meaningful developments on the path to superintelligence: progress toward AGI and superintelligence, frontier AI capabilities, automating AI research, recursive self-improvement, alignment and safety of advanced AI, interpretability, forecasts and timelines, compute and scaling, and governance of frontier AI.

Score how significant this story is as a development toward (or for the safety and governance of) superintelligence, from 1.0 to 10.0, with one decimal place (for example 8.2 or 6.7). Use the decimal to place the story within a band, so stronger stories in the same band score higher:

10: A landmark. A new frontier model that clearly advances the state of the art, a major alignment or interpretability breakthrough, or binding national or international law on frontier AI.
9: A major development from a leading lab, government or research group that people following superintelligence will discuss for weeks. For example a significant new capability result, an important safety finding, a major forecast revision by a leading forecaster, or a significant frontier AI policy action.
8: A significant, concrete update: substantial new research, data or analysis from a credible source on frontier capabilities, alignment, interpretability, forecasting, compute or frontier AI governance.
5-7: Relevant but not a meaningful update: commentary, opinion, explainers, incremental or narrow papers, conference recaps, roundups, interviews, or restating known positions.
2-4: Only loosely related: AI products and business news, applications of AI in a specific field, or a passing mention of AGI or AI safety.
1: Not about superintelligence at all: unrelated uses of a word (such as "AGI" as a stock ticker), finance or stock tips, advertising, or spam.

Judge only from the title, summary and source given. Do not reward hype, alarmist wording or a famous name on its own. When unsure between two scores, choose the lower one.

Give the score (one decimal place) and a reason of one short sentence (at most 25 words) that a reader will see under the story, saying concretely why it is or isn't a meaningful development.`;

const JudgmentSchema = z.object({
  score: z.number(),
  reason: z.string(),
});

let client: Anthropic | undefined;

async function judgeWithClaude(story: StoryToJudge): Promise<Judgment> {
  client ??= new Anthropic();
  const response = await client.messages.parse({
    model: judgeModel(),
    max_tokens: 1024,
    system: SCORING_GUIDE,
    output_config: { effort: "low", format: zodOutputFormat(JudgmentSchema) },
    messages: [
      {
        role: "user",
        content: [
          `Title: ${story.title}`,
          `Summary: ${story.summary || "(none)"}`,
          `Source: ${story.sources.join(", ")}`,
          `Published: ${story.published.toISOString().slice(0, 10)}`,
        ].join("\n"),
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    // Too few rather than too many: a story Claude declines to assess stays hidden.
    return { score: 0, reason: "Not scored: the AI declined to assess this story." };
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`No valid judgment (stop reason: ${response.stop_reason})`);
  const score = Math.min(10, Math.max(1, Math.round(parsed.score * 10) / 10));
  const reason = parsed.reason.replace(/\s+/g, " ").trim().slice(0, 300);
  return { score, reason };
}

// Fake judge for tests: deterministic, no network. Titles containing "Minor" score low.
function judgeWithFixtures(story: StoryToJudge): Judgment {
  return /\bminor\b/i.test(story.title)
    ? { score: 4.2, reason: "Sample assessment: a minor mention, not a meaningful development." }
    : { score: 9.1, reason: "Sample assessment: a significant development for testing." };
}

export async function judgeStory(story: StoryToJudge): Promise<Judgment> {
  const mode = judgeMode();
  if (mode === "fixtures") return judgeWithFixtures(story);
  if (mode === "anthropic") return judgeWithClaude(story);
  throw new Error("Judging is off");
}

export type JudgeSummary = { mode: JudgeMode; judged: number; failed: number; remaining: number };

// Scores stories that haven't been judged yet, newest first. A story that fails to be judged
// (network error, rate limit) is left for the next run; it stays hidden until it has a score.
// `deadline` (ms since epoch) stops it from starting new judgments late in a run.
export async function judgePending(deadline: number = Infinity): Promise<JudgeSummary> {
  const mode = judgeMode();
  if (mode === "off") return { mode, judged: 0, failed: 0, remaining: 0 };

  const pending = await sql<{ id: string; title: string; summary: string; published_at: Date; sources: string[] }[]>`
    SELECT s.id, s.title, s.summary, s.published_at,
      COALESCE((SELECT array_agg(COALESCE(ss.outlet || ' (via ' || src.name || ')', src.name))
        FROM story_sources ss JOIN sources src ON src.id = ss.source_id WHERE ss.story_id = s.id), '{}') AS sources
    FROM stories s WHERE s.judged_at IS NULL
    ORDER BY s.published_at DESC LIMIT ${MAX_PER_RUN}`;

  let judged = 0;
  let failed = 0;
  const model = judgeModel();
  let next = 0;
  async function worker() {
    while (next < pending.length && Date.now() < deadline) {
      const row = pending[next++];
      try {
        const j = await judgeStory({ title: row.title, summary: row.summary, sources: row.sources, published: new Date(row.published_at) });
        await sql`UPDATE stories SET ai_score = ${j.score}, ai_reason = ${j.reason}, ai_model = ${model}, judged_at = now() WHERE id = ${row.id}`;
        judged++;
      } catch (err) {
        failed++;
        console.error(`Could not judge story ${row.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM stories WHERE judged_at IS NULL`;
  return { mode, judged, failed, remaining: count };
}
