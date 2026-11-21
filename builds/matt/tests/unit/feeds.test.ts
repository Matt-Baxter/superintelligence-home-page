import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed } from "../../lib/feeds.ts";

// Unit tests for reading RSS and Atom feeds, using the saved sample feeds. (REQ-001)

const fixture = (name: string) => readFileSync(new URL(`../fixtures/feeds/${name}`, import.meta.url), "utf8");

describe("REQ-001: feeds are read in RSS and Atom formats", () => {
  it("reads an RSS feed, newest first, keeping HTML summaries for later cleanup", () => {
    const items = parseFeed(fixture("lab.xml"));
    assert.equal(items.length, 3);
    assert.equal(items[0].title, "Sample: Our View on AGI Timelines");
    assert.equal(items[0].link, "https://lab.example.com/blog/agi-timelines?utm_source=rss");
    assert.ok(items[0].published! > items[1].published!);
    assert.ok(items[2].summary.includes("<script>"));
  });

  it("reads an Atom feed with alternate links and published dates", () => {
    const items = parseFeed(fixture("arxiv.xml"));
    assert.equal(items.length, 2);
    assert.equal(items[0].link, "http://arxiv.org/abs/2611.00001v1");
    assert.equal(items[0].published?.toISOString(), "2026-11-10T09:00:00.000Z");
  });

  it("rejects something that isn't a feed", () => {
    assert.throws(() => parseFeed("<html><body>Not a feed</body></html>"), /Not an RSS or Atom feed/);
  });
});

describe("Google News search feeds (Build A)", () => {
  it("reads the outlet and removes the \" - Outlet\" suffix from headlines", () => {
    const items = parseFeed(fixture("news.xml"));
    assert.equal(items[0].title, "Sample: Lab Publishes Frontier Model Safety Framework");
    assert.equal(items[0].outlet, "Sample Times");
    assert.equal(items[0].outletUrl, "https://sampletimes.example.com");
    assert.equal(items[2].outlet, "X");
  });
});
