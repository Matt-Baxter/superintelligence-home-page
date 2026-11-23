import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  join(here, "..", "..", ".env.development.local"),
  join(here, "..", "..", "..", "..", ".env.development.local"),
]) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

// Force isolated synthetic test schema on Neon so live si_combined & public.* are never touched (Constitution IV).
process.env.DB_SCHEMA = "si_combined_test";
process.env.JUDGE = "fixtures";

const { ensureSchema, S, sql } = await import("../../lib/db.ts");
const { hashSessionToken, registerUser, verifyCredentials } = await import("../../lib/auth.ts");
const { fetchAllSources, seedDefaultSources } = await import("../../lib/ingest.ts");
const { toggleUserInteraction } = await import("../../lib/interactions.ts");
const { parseFeedQuery } = await import("../../lib/schemas.ts");
const {
  buildAtomFeedXml,
  buildSourcesOpmlXml,
  getReviewLedger,
  getStoryById,
  getWeeklyBrief,
  listSavedStories,
  listStories,
} = await import("../../lib/stories.ts");

import type { ParsedFeedItem } from "../../lib/feeds.ts";
import type { SourceCatalogEntry } from "../../lib/sources-data.ts";

const SYNTHETIC_SOURCES: SourceCatalogEntry[] = [
  { id: "sample-arxiv", name: "Sample arXiv", kind: "papers", feedUrl: "https://sample.test/arxiv.xml", homeUrl: "https://sample.test", roleLabel: "primary", reviewLabel: "preprint", independence: "independent", provenanceNote: "Sample", history: "none" },
  { id: "sample-lab", name: "Sample Frontier Lab", kind: "frontier-lab", feedUrl: "https://sample.test/lab.xml", homeUrl: "https://sample.test", roleLabel: "primary", reviewLabel: "lab-research", independence: "frontier-vendor", provenanceNote: "Sample", history: "none" },
  { id: "sample-safety", name: "Sample Safety Group", kind: "safety-group", feedUrl: "https://sample.test/safety.xml", homeUrl: "https://sample.test", roleLabel: "primary", reviewLabel: "safety-eval", independence: "independent", provenanceNote: "Sample", history: "none" },
  { id: "sample-research", name: "Sample Research Org", kind: "research-org", feedUrl: "https://sample.test/research.xml", homeUrl: "https://sample.test", roleLabel: "primary", reviewLabel: "forecasting-eval", independence: "independent", provenanceNote: "Sample", history: "none" },
  { id: "sample-forum-a", name: "Sample Forum A", kind: "forum", feedUrl: "https://sample.test/forum-a.xml", homeUrl: "https://sample.test", roleLabel: "primary", reviewLabel: "forum-peer", independence: "independent", provenanceNote: "Sample", history: "none" },
  { id: "sample-forum-b", name: "Sample Forum B", kind: "forum", feedUrl: "https://sample.test/forum-b.xml", homeUrl: "https://sample.test", roleLabel: "primary", reviewLabel: "forum-peer", independence: "independent", provenanceNote: "Sample", history: "none" },
  { id: "sample-news-a", name: "Sample Newsletter A", kind: "newsletter", feedUrl: "https://sample.test/news-a.xml", homeUrl: "https://sample.test", roleLabel: "secondary", reviewLabel: "curated-synthesis", independence: "independent", provenanceNote: "Sample", history: "none" },
  { id: "sample-news-b", name: "Sample Newsletter B", kind: "newsletter", feedUrl: "https://sample.test/news-b.xml", homeUrl: "https://sample.test", roleLabel: "secondary", reviewLabel: "curated-synthesis", independence: "independent", provenanceNote: "Sample", history: "none" },
  { id: "sample-down", name: "Sample Unreachable Feed", kind: "news", feedUrl: "https://sample.test/down.xml", homeUrl: "https://sample.test", roleLabel: "secondary", reviewLabel: "press-search", independence: "independent", provenanceNote: "Sample", history: "none" },
];

const FEED_DATA: Record<string, ParsedFeedItem[]> = {
  "https://sample.test/arxiv.xml": [
    {
      title: "Sample Paper: Scalable Oversight for Superhuman Agents",
      link: "https://arxiv.org/abs/2611.11111v1",
      summary: "Sample test data on scalable oversight and alignment of superintelligent models.",
      authors: "Sample Author A",
      published: new Date("2026-11-22T12:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
    {
      title: "Sample Consumer AI Photo-Editing App",
      link: "https://sample.test/photo-app",
      summary: "Sample test data for a smartphone AI photo-editing app with portrait filters.",
      authors: "Sample Product Team",
      published: new Date("2026-11-22T11:30:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
  "https://sample.test/lab.xml": [
    {
      title: "Sample Frontier Model System Card and AI Safety Evaluations",
      link: "https://sample.test/lab/system-card",
      summary: '<p>Sample test data: How we run AI safety evaluations before release.<script>alert("xss")</script></p>',
      authors: "Sample Safety Team",
      published: new Date("2026-11-21T15:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
    {
      title: "Sample Thread on Alignment Research",
      link: "https://x.com/samplelab/status/999999",
      summary: "Sample test data linking to Twitter/X alignment thread.",
      authors: "Sample Account",
      published: new Date("2026-11-21T14:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
  "https://sample.test/safety.xml": [
    {
      title: "Sample Mitigating Loss of Control and Deceptive Alignment",
      link: "https://sample.test/safety/loss-of-control",
      summary: "Sample test data analyzing loss of control and deceptive alignment in autonomous systems.",
      authors: "Sample Safety Researcher",
      published: new Date("2026-11-20T10:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
  "https://sample.test/research.xml": [
    {
      title: "Sample Paper: Scalable Oversight for Superhuman Agents",
      link: "https://arxiv.org/pdf/2611.11111v2",
      summary: "Sample test data: independent replication of arXiv:2611.11111 scalable oversight.",
      authors: "Sample Eval Group",
      published: new Date("2026-11-22T13:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
    {
      title: "Sample Survey Updating AGI Timelines and Compute Scaling",
      link: "https://sample.test/research/agi-timelines",
      summary: "Sample test data examining AGI timelines and training compute scaling laws.",
      authors: "Sample Forecaster",
      published: new Date("2026-11-19T09:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
  "https://sample.test/forum-a.xml": [
    {
      title: "Sample Paper: Scalable Oversight for Superhuman Agents",
      link: "https://sample.test/forum-a/discussion-2611-11111",
      summary: "Sample test data forum review of arXiv:2611.11111 scalable oversight.",
      authors: "Sample Reviewer",
      published: new Date("2026-11-22T14:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
  "https://sample.test/forum-b.xml": [
    {
      title: "Sample Mechanistic Interpretability with Sparse Autoencoders",
      link: "https://sample.test/forum-b/sae-circuits",
      summary: "Sample test data on mechanistic interpretability and sparse autoencoders.",
      authors: "Sample Interp Researcher",
      published: new Date("2026-11-18T08:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
  "https://sample.test/news-a.xml": [
    {
      title: "Sample Recursive Self-Improvement and AI Research Agents",
      link: "https://sample.test/news-a/rsi-agents",
      summary: "Sample test data covering recursive self-improvement and AI research agents.",
      authors: "Sample Editor A",
      published: new Date("2026-11-17T08:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
  "https://sample.test/news-b.xml": [
    {
      title: "Sample Frontier AI Regulation and Compute Governance Framework",
      link: "https://sample.test/news-b/compute-governance",
      summary: "Sample test data on frontier AI regulation and international compute governance.",
      authors: "Sample Editor B",
      published: new Date("2026-11-16T08:00:00Z"),
      outlet: null,
      outletUrl: null,
    },
  ],
};

describe("End-to-End Contract Acceptance Suite (AT-01..AT-15, AT-C3..AT-C4) on Isolated Neon Schema", () => {
  let fetchSummary: Awaited<ReturnType<typeof fetchAllSources>>;

  before(async () => {
    await ensureSchema();
    await sql`
      TRUNCATE
        ${S()}.users,
        ${S()}.sessions,
        ${S()}.sources,
        ${S()}.stories,
        ${S()}.story_topics,
        ${S()}.story_sources,
        ${S()}.story_keys,
        ${S()}.votes,
        ${S()}.saves,
        ${S()}.history_progress
      RESTART IDENTITY CASCADE
    `;
    await seedDefaultSources(SYNTHETIC_SOURCES);

    fetchSummary = await fetchAllSources({
      fetcher: async (url) => {
        if (url.endsWith("/down.xml")) {
          throw new Error("Simulated ECONNREFUSED on sample-down");
        }
        return FEED_DATA[url] ?? [];
      },
    });
  });

  after(async () => {
    await sql`DROP SCHEMA IF EXISTS si_combined_test CASCADE`;
    await sql.end();
  });

  it("AT-01 & AT-06: fetches 8 working sample sources across 5+ kinds newest-first; 1 unreachable source does not break feed", async () => {
    assert.equal(fetchSummary.fetched, 8);
    assert.equal(fetchSummary.failed, 1);

    const feed = await listStories(parseFeedQuery({}));
    assert.ok(feed.stories.length >= 7);
    assert.equal(feed.activeSourceCount, 8);
    assert.ok(feed.activeKindCount >= 5);

    // Verify newest-first ordering
    const timestamps = feed.stories.map((s) => s.publishedAt.getTime());
    assert.deepEqual(timestamps, [...timestamps].sort((a, b) => b - a));

    // Verify unreachable source recorded last_error
    const [downRow] = await sql<{ last_error: string | null }[]>`
      SELECT last_error FROM ${S()}.sources WHERE id = 'sample-down'
    `;
    assert.ok(downRow.last_error?.includes("Simulated ECONNREFUSED"));
  });

  it("AT-02, AT-05 & AT-15: excludes AI photo-editing app, blocks Twitter/X links, and strips <script> tags", async () => {
    const feed = await listStories(parseFeedQuery({}));
    assert.equal(feed.stories.some((s) => /photo-editing/i.test(s.title)), false);
    assert.equal(feed.stories.some((s) => /x\.com|twitter\.com/i.test(s.url)), false);

    const evalStory = feed.stories.find((s) => s.title.includes("AI Safety Evaluations"));
    assert.ok(evalStory);
    assert.equal(evalStory.summary.includes("<script"), false);
    assert.ok(evalStory.summary.includes("How we run AI safety evaluations before release."));
  });

  it("AT-03 & AT-04: groups duplicate arXiv paper across 3 sources and shows matched words 'AGI timelines'", async () => {
    const feed = await listStories(parseFeedQuery({}));

    const grouped = feed.stories.find((s) => s.title.includes("Scalable Oversight for Superhuman Agents"));
    assert.ok(grouped, "Grouped paper must exist once");
    assert.equal(grouped.sources.length, 3);

    const detail = await getStoryById(grouped.id);
    assert.ok(detail);
    assert.equal(detail.sources.length, 3);
    assert.ok(detail.why.some((w) => w.factor === "Cross-source coverage"));

    const timelines = feed.stories.find((s) => s.title.includes("AGI Timelines"));
    assert.ok(timelines);
    const ftTopic = timelines.rootTopics.find((t) => t.id === "forecasting-timelines");
    assert.ok(ftTopic);
    assert.ok(ftTopic.matched.includes("AGI timelines"));
  });

  it("AT-07, AT-08 & AT-09: creates accounts with scrypt hashes, refuses duplicate usernames, and verifies credentials", async () => {
    const alice = await registerUser({ username: "sample_alice", email: "sample_alice+123@example.com", password: "SamplePass123!", ipHash: "test-ip" });
    assert.equal(alice.ok, true);
    if (!alice.ok) return;

    // Duplicate username (even with different casing) is refused
    const dup = await registerUser({ username: "SAMPLE_ALICE", email: "alice_dup@example.com", password: "AnotherPass123!", ipHash: "test-ip" });
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.code, "taken");

    // Password is never stored in plain text (REQ-011)
    const [rawUser] = await sql<{ password_hash: string }[]>`
      SELECT password_hash FROM ${S()}.users WHERE id = ${alice.userId}
    `;
    assert.ok(rawUser.password_hash.startsWith("scrypt$"));
    assert.equal(rawUser.password_hash.includes("SamplePass123!"), false);

    // Valid and invalid sign-in checks
    const validLogin = await verifyCredentials("sample_alice", "SamplePass123!");
    assert.equal(validLogin?.username, "sample_alice");
    const wrongLogin = await verifyCredentials("sample_alice", "WrongPass999!");
    assert.equal(wrongLogin, null);

    // Session token hashing
    assert.notEqual(hashSessionToken("raw-cookie-secret"), "raw-cookie-secret");
  });

  it("AT-10, AT-11 & AT-12: persists votes/saves per user and refuses cross-user tamper attempts with 403", async () => {
    const bob = await registerUser({ username: "sample_bob", email: "sample_bob+456@example.com", password: "SamplePass456!", ipHash: "test-ip" });
    assert.equal(bob.ok, true);
    if (!bob.ok) return;

    const [aliceRow] = await sql<{ id: string }[]>`
      SELECT id FROM ${S()}.users WHERE lower(username) = 'sample_alice'
    `;
    const aliceId = String(aliceRow.id);
    const bobId = bob.userId;

    const feed = await listStories(parseFeedQuery({}));
    const story1 = feed.stories[0];
    const story2 = feed.stories[1];

    // Alice votes and saves story1; Bob saves story2
    const v1 = await toggleUserInteraction({ kind: "vote", sessionUserId: aliceId, storyId: story1.id });
    assert.equal(v1.ok && v1.active, true);

    await toggleUserInteraction({ kind: "save", sessionUserId: aliceId, storyId: story1.id });
    await toggleUserInteraction({ kind: "save", sessionUserId: bobId, storyId: story2.id });

    // AT-10: Alice's vote shows as Alice's
    const aliceFeed = await listStories(parseFeedQuery({}), aliceId);
    const aliceView1 = aliceFeed.stories.find((s) => s.id === story1.id)!;
    assert.equal(aliceView1.voted, true);
    assert.equal(aliceView1.votes, 1);

    // AT-11: Alice and Bob each see only their own saved stories
    const aliceSaved = await listSavedStories(aliceId);
    const bobSaved = await listSavedStories(bobId);
    assert.deepEqual(aliceSaved.map((s) => s.id), [story1.id]);
    assert.deepEqual(bobSaved.map((s) => s.id), [story2.id]);

    // AT-12: Bob tries to remove Alice's vote by passing claimedUserId = aliceId -> 403 Forbidden!
    const tamper = await toggleUserInteraction({
      kind: "vote",
      sessionUserId: bobId,
      storyId: story1.id,
      claimedUserId: aliceId,
    });
    assert.equal(tamper.ok, false);
    if (!tamper.ok) assert.equal(tamper.status, 403);

    // Confirm Alice's vote is completely untouched
    const recheck = await listStories(parseFeedQuery({}), aliceId);
    assert.equal(recheck.stories.find((s) => s.id === story1.id)?.votes, 1);
  });

  it("AT-13, AT-C3 & AT-C4: filters strictly by Alignment and serves Brief, Review Ledger, Atom & OPML", async () => {
    const alignedFeed = await listStories(parseFeedQuery({ topic: "alignment" }));
    assert.ok(alignedFeed.stories.length >= 1);
    for (const s of alignedFeed.stories) {
      assert.ok(
        s.rootTopics.some((t) => t.id === "alignment"),
        `Story "${s.title}" in alignment filter lacked alignment root topic`,
      );
    }

    const brief = await getWeeklyBrief(14);
    assert.equal(brief.schemaVersion, "si-brief-v1");
    assert.ok(brief.landmarks.length > 0);

    const ledger = await getReviewLedger({});
    assert.ok(ledger.counts.total >= 7);

    const atom = await buildAtomFeedXml("https://example.org", "alignment");
    assert.ok(atom.includes('<feed xmlns="http://www.w3.org/2005/Atom">'));

    const opml = await buildSourcesOpmlXml();
    assert.ok(opml.includes('<opml version="2.0">'));
  });
});
