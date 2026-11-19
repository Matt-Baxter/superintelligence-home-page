import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchTopics, TOPICS } from "../../lib/topics.ts";

// Unit tests for superintelligence topic matching. (REQ-003, REQ-005; spec v1.4)

const ids = (text: string) => matchTopics(text).map((m) => m.id);

describe("REQ-003: key phrases match as whole words, ignoring capital letters", () => {
  it('matches "AGI" in "AGI timelines" but not inside "magic" or "imagine"', () => {
    assert.ok(ids("AGI timelines are shrinking").includes("capabilities-agi"));
    assert.deepEqual(ids("A magic trick to imagine"), []);
  });

  it('does not match "align" against "alignment"', () => {
    assert.deepEqual(ids("We align the text boxes"), []);
    assert.deepEqual(ids("Text ALIGNMENT matters"), ["alignment"]);
  });

  it("matches plural and singular forms listed in the spec", () => {
    assert.deepEqual(ids("New frontier models released"), ["capabilities-agi"]);
    assert.deepEqual(ids("Existential risks ahead"), ["safety-risk"]);
    assert.deepEqual(ids("A new scaling law"), ["compute-scaling"]);
  });

  it("leaves out general AI news that matches no topic", () => {
    assert.deepEqual(ids("Introducing a new AI photo-editing app"), []);
  });

  it("matches phrases with hyphens", () => {
    assert.deepEqual(ids("On x-risk and recursive self-improvement"), ["recursive-self-improvement", "safety-risk"]);
  });
});

describe("REQ-005: each match reports the key phrases that caused it", () => {
  it('reports "AGI timelines" under Forecasting & timelines', () => {
    const forecasting = matchTopics("AGI timelines are shrinking").find((m) => m.id === "forecasting-timelines");
    assert.ok(forecasting);
    assert.equal(forecasting.label, "Forecasting & timelines");
    assert.deepEqual(forecasting.matched, ["AGI timelines"]);
  });
});

describe("Contract: the code's topic list matches the shared spec exactly", () => {
  it("every topic and key phrase in lib/topics.ts matches the spec table", () => {
    const spec = readFileSync(new URL("../../../../specs/001-superintelligence-homepage/spec.md", import.meta.url), "utf8");
    const section = spec.split("### Superintelligence topics and key phrases")[1].split("### Key Entities")[0];
    const rows = [...section.matchAll(/^\| ([^|]+?) \| ([^|]+?) \|$/gm)]
      .map((m) => [m[1].trim(), m[2].trim()])
      .filter(([topic]) => topic !== "Topic" && !topic.startsWith("-"));
    const specTopics = Object.fromEntries(rows.map(([topic, phrases]) => [topic, phrases.split(",").map((p) => p.trim())]));
    const codeTopics = Object.fromEntries(TOPICS.map((t) => [t.label, t.phrases]));
    assert.deepEqual(codeTopics, specTopics);
  });
});
