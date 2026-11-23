import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeStory, detectBenchmarks } from "../../lib/analysis.ts";
import { arxivId, htmlToText, isTwitterUrl, storyKeysFor, truncate } from "../../lib/text.ts";

describe("Plain-text Sanitizer, Identity Keys & 0-100 Significance Engine", () => {
  it("AT-15 (REQ-021): strips <script>, <img>, and HTML tags to safe plain text", () => {
    const dirty =
      '<p>How we run <b>AI safety</b> evaluations.<script>alert("xss")</script><img src="https://evil.example/pixel.png" onerror="alert(1)"/></p>';
    const clean = htmlToText(dirty);
    assert.equal(clean, "How we run AI safety evaluations.");
    assert.equal(clean.includes("<script"), false);
    assert.equal(clean.includes("<img"), false);
  });

  it("AT-05 (REQ-006): detects and blocks Twitter/X/t.co/Nitter URLs", () => {
    assert.equal(isTwitterUrl("https://x.com/researcher/status/12345"), true);
    assert.equal(isTwitterUrl("https://twitter.com/lab/status/99"), true);
    assert.equal(isTwitterUrl("https://t.co/abc123"), true);
    assert.equal(isTwitterUrl("https://nitter.net/user/status/1"), true);
    assert.equal(isTwitterUrl("https://arxiv.org/abs/2611.01234"), false);
    assert.equal(isTwitterUrl("https://alignmentforum.org/posts/xyz"), false);
  });

  it("AT-03 (REQ-004): generates canonical arxiv, doi, url and title deduplication keys", () => {
    assert.equal(arxivId("https://arxiv.org/pdf/2504.12345v2"), "2504.12345");
    const keysA = storyKeysFor({
      url: "https://arxiv.org/abs/2504.12345v1?utm_source=rss",
      title: "Scalable Oversight via Prover-Verifier Games",
    });
    const keysB = storyKeysFor({
      url: "https://alignmentforum.org/posts/abc/scalable-oversight-via-prover-verifier-games",
      title: "Scalable Oversight via Prover-Verifier Games",
      summary: "Discussion of arXiv:2504.12345 on scalable oversight.",
    });
    assert.equal(keysA[0], "arxiv:2504.12345");
    assert.equal(keysB[0], "arxiv:2504.12345");
  });

  it("REQ-007: truncates summaries to at most 300 characters", () => {
    const long = "superintelligence ".repeat(40);
    const short = truncate(long, 300);
    assert.ok(Array.from(short).length <= 300);
  });

  it("extracts numeric % and time-horizon benchmark scores and explains 0-100 points", () => {
    const text =
      "New frontier model achieves 74.2% on SWE-bench Verified and a 4.5-hour autonomous task time horizon on RE-Bench.";
    const benches = detectBenchmarks(text);
    const swe = benches.find((b) => b.id === "swe-bench-verified");
    const horizon = benches.find((b) => b.id === "metr-horizon");
    assert.ok(swe?.score);
    assert.equal(swe.score.value, 74.2);
    assert.equal(swe.score.unit, "%");
    assert.ok(horizon?.score);
    assert.equal(horizon.score.value, 4.5);
    assert.equal(horizon.score.unit, "hours");

    const analysis = analyzeStory({
      title: "Alignment Faking and Scalable Oversight Evaluation on SWE-bench Verified",
      summary: text,
      sourceKinds: ["frontier-lab", "safety-group", "papers"],
      sourceCount: 3,
    });
    assert.ok(analysis.significanceScore >= 60, `Expected high score, got ${analysis.significanceScore}`);
    assert.ok(analysis.why.some((w) => w.factor === "Cross-source coverage"));
    assert.ok(analysis.why.some((w) => w.factor === "Benchmarks"));
  });
});
