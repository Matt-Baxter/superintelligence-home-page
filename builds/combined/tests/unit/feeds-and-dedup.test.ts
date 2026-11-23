import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFeedXml } from "../../lib/feeds.ts";
import { parseFeedQuery, serializeFeedQuery } from "../../lib/schemas.ts";

describe("RSS / Atom / Google News Parser & URL Workspace State", () => {
  it("parses Atom 1.0 feeds cleanly", () => {
    const atom = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Sample arXiv</title>
        <entry>
          <title>Sample Paper on Scalable Oversight</title>
          <link href="https://arxiv.org/abs/2611.99999" rel="alternate"/>
          <published>2026-11-20T10:00:00Z</published>
          <summary>Sample test data investigating scalable oversight for superintelligent agents.</summary>
          <author><name>Sample Researcher</name></author>
        </entry>
      </feed>`;
    const items = parseFeedXml(atom);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Sample Paper on Scalable Oversight");
    assert.equal(items[0].link, "https://arxiv.org/abs/2611.99999");
    assert.equal(items[0].authors, "Sample Researcher");
  });

  it("parses RSS 2.0 with Google News <source> outlet attribution", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Frontier AI Governance Summit Convenes - Sample Tech Journal</title>
            <link>https://example.org/governance-summit</link>
            <pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate>
            <source url="https://example.org">Sample Tech Journal</source>
          </item>
        </channel>
      </rss>`;
    const items = parseFeedXml(rss);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Frontier AI Governance Summit Convenes");
    assert.equal(items[0].outlet, "Sample Tech Journal");
    assert.equal(items[0].outletUrl, "https://example.org");
  });

  it("validates URL workspace presets and falls back gracefully on malformed query params", () => {
    const presetState = parseFeedQuery({ preset: "alignment-safety" });
    assert.equal(presetState.topic, "alignment");
    assert.equal(presetState.sort, "best");

    const badState = parseFeedQuery({ sort: "invalid-sort", page: "-99" });
    assert.equal(badState.sort, "newest");
    assert.equal(badState.page, 1);
    assert.equal(serializeFeedQuery(badState), "/");
  });
});
