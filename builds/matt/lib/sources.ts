// Build A's sources (REQ-001): 11 public feeds across 6 kinds. The list itself is in
// sources.json so the migration script can read it too.
//
// Feed check, 2026-11-13 (T013). Each URL was fetched and confirmed to return RSS or Atom with
// recent items:
//
// | Source                     | Kind         | Result                                              |
// |----------------------------|--------------|-----------------------------------------------------|
// | arXiv (AI papers)          | papers       | Replaced: the daily cs.AI RSS feed is empty on some  |
// |                            |              | days, so this uses arXiv's search feed (Atom) for    |
// |                            |              | cs.AI papers on alignment, superintelligence, AGI   |
// |                            |              | or interpretability. OK, 50 items.                  |
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
// When SOURCES=fixtures (tests only), the saved sample feeds in tests/fixtures/ are used instead.

import realSources from "./sources.json";
import fixtureSources from "../tests/fixtures/sources.json";

export type SourceKind = "papers" | "frontier-lab" | "safety-group" | "research-org" | "forum" | "newsletter";

export type Source = {
  id: string;
  name: string;
  kind: SourceKind;
  feedUrl: string;
};

export function getSources(): Source[] {
  return (process.env.SOURCES === "fixtures" ? fixtureSources : realSources) as Source[];
}
