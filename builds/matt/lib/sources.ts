// Build A's sources (REQ-001): 21 public feeds across 7 kinds. The list itself is in
// sources.json so the migration script can read it too.
//
// Feed check, 2026-11-13 (T013). Each URL was fetched and confirmed to return RSS or Atom with
// recent items:
//
// | Source                     | Kind         | Result                                              |
// |----------------------------|--------------|-----------------------------------------------------|
// | arXiv (superintelligence   | papers       | Replaced twice. The daily cs.AI RSS feed is empty on  |
// | papers)                    |              | some days. A search of abstracts for "alignment" etc. |
// |                            |              | let in off-topic papers (clustering, proteins). Now   |
// |                            |              | it searches cs.AI paper *titles* for core phrases     |
// |                            |              | only (superintelligence, AGI, AI safety, AI alignment, |
// |                            |              | scalable oversight, existential risk, loss of control, |
// |                            |              | recursive self-improvement, intelligence explosion,   |
// |                            |              | deceptive alignment), newest 20. (2026-11-14)         |
// | OpenAI News                | frontier-lab | OK                                                  |
// | Google DeepMind Blog       | frontier-lab | OK                                                  |
// | MIRI                       | safety-group | OK                                                  |
// | Redwood Research           | safety-group | OK                                                  |
// | Epoch AI                   | research-org | Replaced: epoch.ai has no RSS feed (404); uses       |
// |                            |              | Epoch's newsletter feed on Substack. OK.            |
// | AI Impacts                 | research-org | OK                                                  |
// | AI Alignment Forum         | forum        | OK                                                  |
// | LessWrong                  | forum        | OK                                                  |
// | Import AI                  | newsletter   | OK                                                  |
// | Don't Worry About the Vase | newsletter   | OK                                                  |
//
// 11 working sources across 6 kinds (the bar is 8 across 5; AT-01).
//
// 2026-11-21: added 5 Google News search feeds (kind "news"), one per query, for a wider range of
// outlets. Checked: each returns up to 100 recent articles from dozens of outlets. They are noisy
// (e.g. "AGI" is also a stock ticker), so their items rely on the AI judge (lib/judge.ts).
//
// 2026-11-22: added the other frontier labs (Matt's request). Checked by hand:
// - Anthropic has no feed of its own. Its News and Research feeds come from a community project
//   on GitHub (Olshansk/rss-feeds) that rebuilds them from anthropic.com; both hold the full
//   archive back to 2021. Risk: if that project stops updating, these sources go quiet (the fetch
//   still works; the source's last success date shows it).
// - Meta AI, xAI and Microsoft AI have no working feeds (404, or a stale community feed for Meta),
//   so each is a Google News search of the lab's own site (e.g. "site:x.ai"). Plain "site:meta.com"
//   returned product pages, so Meta's search covers ai.meta.com and about.fb.com only.
// - Google DeepMind's own feed only reaches December 2025, so the history fill uses a search of
//   deepmind.google and deepmind.com (its address before 2024) instead.
//
// When SOURCES=fixtures (tests only), the saved sample feeds in tests/fixtures/ are used instead.

import realSources from "./sources.json";
import fixtureSources from "../tests/fixtures/sources.json";
import fixtureHistorySources from "../tests/fixtures/history-sources.json";

export type SourceKind = "papers" | "frontier-lab" | "safety-group" | "research-org" | "forum" | "newsletter" | "news";

export type Source = {
  id: string;
  name: string;
  kind: SourceKind;
  feedUrl: string;
  // How the history fill reads this source's archive, when it can't tell from the address
  // (lib/history.ts). "full-feed": the feed itself holds the whole archive.
  history?: "full-feed" | "paged-feed" | "substack" | "news-month" | "forum-month";
  // A Google News search used only for the history fill, month by month, for a source whose own
  // feed doesn't reach back far enough (Google DeepMind).
  historySearch?: string;
};

export function getSources(): Source[] {
  return (process.env.SOURCES === "fixtures" ? fixtureSources : realSources) as Source[];
}

// Sources whose archives the history fill reads. In tests, a separate set of sample archives.
export function getHistorySources(): Source[] {
  return (process.env.SOURCES === "fixtures" ? fixtureHistorySources : realSources) as Source[];
}
