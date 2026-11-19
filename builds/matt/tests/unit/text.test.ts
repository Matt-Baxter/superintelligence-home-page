import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { arxivId, htmlToText, isTwitterUrl, normalizeTitle, normalizeUrl, truncate } from "../../lib/text.ts";

// Unit tests for the text helpers used when storing feed items.

describe("REQ-021: feed HTML becomes plain text", () => {
  it("removes script blocks, image tags and other markup", () => {
    const html = '<p>How we run <b>AI safety</b> evals.</p><script>alert(1)</script><img src="x">';
    assert.equal(htmlToText(html), "How we run AI safety evals.");
  });

  it("decodes entities and removes tags hidden inside escaped markup", () => {
    assert.equal(htmlToText("Tom &amp; Jerry &lt;script&gt;bad()&lt;/script&gt; &#8212; done"), "Tom & Jerry bad() — done");
  });
});

describe("REQ-007: summaries are at most 300 characters", () => {
  it("leaves short text alone and shortens long text with an ellipsis", () => {
    assert.equal(truncate("short"), "short");
    const cut = truncate("a".repeat(400));
    assert.equal(Array.from(cut).length, 300);
    assert.ok(cut.endsWith("…"));
  });
});

describe("REQ-004: keys for grouping the same story", () => {
  it("normalizes URLs: host case, www, tracking parameters, trailing slash", () => {
    assert.equal(normalizeUrl("https://WWW.Lab.example.com/blog/x/?utm_source=rss&b=2"), "lab.example.com/blog/x?b=2");
    assert.equal(normalizeUrl("not a url"), null);
  });

  it("normalizes titles", () => {
    assert.equal(normalizeTitle("Sample: Scalable  Oversight!"), "sample scalable oversight");
  });

  it("finds arXiv IDs in abs and pdf links, without the version", () => {
    assert.equal(arxivId("https://arxiv.org/pdf/2611.00001v2"), "2611.00001");
    assert.equal(arxivId("http://arxiv.org/abs/1706.03762"), "1706.03762");
    assert.equal(arxivId("https://example.com/paper"), null);
  });
});

describe("REQ-006: Twitter/X links are recognized", () => {
  it("matches twitter.com, x.com and t.co, including subdomains, but not look-alikes", () => {
    for (const url of ["https://x.com/a/status/1", "https://mobile.twitter.com/a", "https://t.co/abc"]) {
      assert.equal(isTwitterUrl(url), true, url);
    }
    for (const url of ["https://box.com/a", "https://notx.com/a", "https://example.com/x.com"]) {
      assert.equal(isTwitterUrl(url), false, url);
    }
  });
});
