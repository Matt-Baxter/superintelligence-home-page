import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPARISON, tallyProvenance } from "../../lib/build-comparison.ts";
import { limitFor, readSpendSettings, TIER_LIMITS } from "../../lib/limits.ts";
import { applyConsensus, decideConsensus } from "../../lib/review-queue.ts";

test("every comparison row has a unique anchor id and a combined addition", () => {
  const ids = new Set(COMPARISON.map((r) => r.id));
  assert.equal(ids.size, COMPARISON.length);
  for (const row of COMPARISON) assert.ok(row.combinedAddition.length > 10, row.id);
});

test("provenance tally accounts for every row", () => {
  const t = tallyProvenance();
  assert.equal(t.matt + t.john + t.both, COMPARISON.length);
});

test("visitors cannot vote, save or run harvests", () => {
  assert.equal(limitFor("anonymous", "vote").perDay, 0);
  assert.equal(limitFor("anonymous", "save").perDay, 0);
  assert.equal(limitFor("free", "harvest_manual").perDay, 0);
  assert.ok(TIER_LIMITS.reviewer.harvest_manual);
});

test("spend settings clamp out-of-range env values", () => {
  const prev = process.env.SPEND_MAX_JUDGE_PER_HARVEST;
  process.env.SPEND_MAX_JUDGE_PER_HARVEST = "99999";
  assert.equal(readSpendSettings().maxJudgePerHarvest, 500);
  process.env.SPEND_MAX_JUDGE_PER_HARVEST = "nonsense";
  assert.equal(readSpendSettings().maxJudgePerHarvest, 40);
  if (prev === undefined) delete process.env.SPEND_MAX_JUDGE_PER_HARVEST;
  else process.env.SPEND_MAX_JUDGE_PER_HARVEST = prev;
});

test("review consensus needs a quorum and off-topic removes from scope", () => {
  assert.equal(decideConsensus({ confirm: 2, overrated: 0, underrated: 0, off_topic: 0 }), null);
  assert.equal(decideConsensus({ confirm: 0, overrated: 0, underrated: 0, off_topic: 3 }), "off_topic");
  assert.equal(applyConsensus(70, "off_topic").inScope, false);
});
