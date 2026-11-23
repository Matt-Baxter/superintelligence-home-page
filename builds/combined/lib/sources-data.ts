import type { SourceKind } from "./schemas";

// Unified 24-source catalog across 7 kinds (REQ-001, REQ-006, REQ-C07).
// Synthesizes the best of Matt's Build A (full Anthropic/OpenAI archives, DeepMind/xAI/Microsoft/Meta coverage,
// Substack & Forum GraphQL history, arXiv monthly queries) and John's Build B (METR, Apollo, Hugging Face,
// BAIR, static provenance & independence labels), while pruning noisy generic press queries.
// Zero Twitter/X/Nitter URLs.

export type ArchiveStrategy =
  | "full-feed"
  | "substack"
  | "forum-graphql"
  | "paged-rss"
  | "arxiv-month"
  | "gnews-month"
  | "none";

export type SourceCatalogEntry = {
  id: string;
  name: string;
  kind: SourceKind;
  feedUrl: string;
  homeUrl: string;
  historySearchUrl?: string;
  roleLabel: "primary" | "secondary";
  reviewLabel:
    | "preprint"
    | "lab-research"
    | "safety-eval"
    | "forecasting-eval"
    | "forum-peer"
    | "curated-synthesis"
    | "press-search";
  independence: "independent" | "frontier-vendor";
  provenanceNote: string;
  history: ArchiveStrategy;
};

export const DEFAULT_SOURCES: SourceCatalogEntry[] = [
  {
    id: "arxiv-si",
    name: "arXiv (Superintelligence & AI Safety)",
    kind: "papers",
    feedUrl:
      "https://export.arxiv.org/api/query?search_query=(cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL)+AND+(ti:superintelligence+OR+ti:superintelligent+OR+ti:AGI+OR+ti:%22artificial+general+intelligence%22+OR+ti:%22AI+safety%22+OR+ti:%22AI+alignment%22+OR+ti:%22scalable+oversight%22+OR+ti:%22existential+risk%22+OR+ti:%22loss+of+control%22+OR+ti:%22recursive+self-improvement%22+OR+ti:%22self-improvement+memory%22+OR+ti:%22deceptive+alignment%22+OR+ti:%22mechanistic+interpretability%22+OR+ti:%22alignment+faking%22+OR+ti:%22weak-to-strong%22+OR+ti:%22sleeper+agents%22)&sortBy=submittedDate&sortOrder=descending&max_results=30",
    homeUrl: "https://arxiv.org/list/cs.AI/recent",
    roleLabel: "primary",
    reviewLabel: "preprint",
    independence: "independent",
    provenanceNote: "Open-access cs.AI/cs.LG/cs.CL preprints filtered to core superintelligence, alignment & interpretability titles",
    history: "arxiv-month",
  },
  {
    id: "hf-papers",
    name: "Hugging Face Daily Papers",
    kind: "papers",
    feedUrl: "https://papers.takara.ai/api/feed",
    homeUrl: "https://huggingface.co/papers",
    roleLabel: "primary",
    reviewLabel: "preprint",
    independence: "independent",
    provenanceNote: "Community-surfaced ML preprints gated by the disambiguated superintelligence scope filter",
    history: "none",
  },
  {
    id: "openai-news",
    name: "OpenAI Research & Safety",
    kind: "frontier-lab",
    feedUrl: "https://openai.com/news/rss.xml",
    homeUrl: "https://openai.com/research",
    roleLabel: "primary",
    reviewLabel: "lab-research",
    independence: "frontier-vendor",
    provenanceNote: "Official OpenAI research releases, system cards, preparedness & alignment publications (full archive to 2016)",
    history: "full-feed",
  },
  {
    id: "google-deepmind",
    name: "Google DeepMind Blog",
    kind: "frontier-lab",
    feedUrl: "https://deepmind.google/blog/rss.xml",
    homeUrl: "https://deepmind.google/research/",
    historySearchUrl:
      "https://news.google.com/rss/search?q=site%3Adeepmind.google+OR+site%3Adeepmind.com+when%3A7d&hl=en-US&gl=US&ceid=US:en",
    roleLabel: "primary",
    reviewLabel: "lab-research",
    independence: "frontier-vendor",
    provenanceNote: "Official Google DeepMind capability, Frontier Safety Framework & formal reasoning releases",
    history: "gnews-month",
  },
  {
    id: "anthropic-research",
    name: "Anthropic Research",
    kind: "frontier-lab",
    feedUrl: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_research.xml",
    homeUrl: "https://www.anthropic.com/research",
    roleLabel: "primary",
    reviewLabel: "lab-research",
    independence: "frontier-vendor",
    provenanceNote: "Anthropic mechanistic interpretability, Constitutional AI, sleeper agents & alignment faking archive (2021–present)",
    history: "full-feed",
  },
  {
    id: "anthropic-news",
    name: "Anthropic Announcements",
    kind: "frontier-lab",
    feedUrl: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    homeUrl: "https://www.anthropic.com/news",
    roleLabel: "primary",
    reviewLabel: "lab-research",
    independence: "frontier-vendor",
    provenanceNote: "Anthropic Responsible Scaling Policy updates, model cards & frontier governance commitments",
    history: "full-feed",
  },
  {
    id: "meta-ai",
    name: "Meta AI (FAIR)",
    kind: "frontier-lab",
    feedUrl:
      "https://news.google.com/rss/search?q=(site%3Aai.meta.com+OR+site%3Aabout.fb.com)+(%22frontier+AI%22+OR+%22AI+safety%22+OR+superintelligence+OR+AGI)+when%3A14d&hl=en-US&gl=US&ceid=US:en",
    homeUrl: "https://ai.meta.com/research/",
    roleLabel: "primary",
    reviewLabel: "lab-research",
    independence: "frontier-vendor",
    provenanceNote: "Meta FAIR open-weight frontier model & Frontier AI Framework releases",
    history: "gnews-month",
  },
  {
    id: "xai-official",
    name: "xAI Safety & Releases",
    kind: "frontier-lab",
    feedUrl: "https://news.google.com/rss/search?q=site%3Ax.ai+when%3A14d&hl=en-US&gl=US&ceid=US:en",
    homeUrl: "https://x.ai/",
    roleLabel: "primary",
    reviewLabel: "lab-research",
    independence: "frontier-vendor",
    provenanceNote: "xAI Risk Management Framework, frontier cluster & model releases (via x.ai domain, never x.com)",
    history: "gnews-month",
  },
  {
    id: "microsoft-ai",
    name: "Microsoft AI Frontier",
    kind: "frontier-lab",
    feedUrl: "https://news.google.com/rss/search?q=site%3Amicrosoft.ai+when%3A14d&hl=en-US&gl=US&ceid=US:en",
    homeUrl: "https://microsoft.ai/",
    roleLabel: "primary",
    reviewLabel: "lab-research",
    independence: "frontier-vendor",
    provenanceNote: "Microsoft AI superintelligence & frontier safety announcements",
    history: "gnews-month",
  },
  {
    id: "miri",
    name: "MIRI (Machine Intelligence Research Institute)",
    kind: "safety-group",
    feedUrl: "https://intelligence.org/feed/",
    homeUrl: "https://intelligence.org/",
    roleLabel: "primary",
    reviewLabel: "safety-eval",
    independence: "independent",
    provenanceNote: "Foundational alignment theory, corrigibility, agent foundations & existential risk research",
    history: "paged-rss",
  },
  {
    id: "redwood-research",
    name: "Redwood Research",
    kind: "safety-group",
    feedUrl: "https://blog.redwoodresearch.org/feed",
    homeUrl: "https://www.redwoodresearch.org/",
    roleLabel: "primary",
    reviewLabel: "safety-eval",
    independence: "independent",
    provenanceNote: "AI control protocols, adversarial subversion evaluations & alignment faking studies",
    history: "substack",
  },
  {
    id: "metr-research",
    name: "METR (Model Evaluation & Threat Research)",
    kind: "safety-group",
    feedUrl: "https://metr.org/feed.xml",
    homeUrl: "https://metr.org/",
    roleLabel: "primary",
    reviewLabel: "safety-eval",
    independence: "independent",
    provenanceNote: "Autonomous replication, long-horizon agent time horizons & RE-Bench evaluations",
    history: "full-feed",
  },
  {
    id: "apollo-research",
    name: "Apollo Research",
    kind: "safety-group",
    feedUrl:
      "https://news.google.com/rss/search?q=site%3Aapolloresearch.ai+when%3A30d&hl=en-US&gl=US&ceid=US:en",
    homeUrl: "https://www.apolloresearch.ai/research",
    roleLabel: "primary",
    reviewLabel: "safety-eval",
    independence: "independent",
    provenanceNote: "Empirical scheming, deceptive alignment & interpretability evaluations on frontier models",
    history: "gnews-month",
  },
  {
    id: "epoch-ai",
    name: "Epoch AI",
    kind: "research-org",
    feedUrl: "https://epochai.substack.com/feed",
    homeUrl: "https://epoch.ai/",
    roleLabel: "primary",
    reviewLabel: "forecasting-eval",
    independence: "independent",
    provenanceNote: "Empirical compute scaling trends, training run datasets, hardware bottlenecks & FrontierMath",
    history: "substack",
  },
  {
    id: "ai-impacts",
    name: "AI Impacts",
    kind: "research-org",
    feedUrl: "https://blog.aiimpacts.org/feed",
    homeUrl: "https://aiimpacts.org/",
    roleLabel: "primary",
    reviewLabel: "forecasting-eval",
    independence: "independent",
    provenanceNote: "Expert surveys, AGI timeline forecasting & discontinuous progress research",
    history: "paged-rss",
  },
  {
    id: "bair-blog",
    name: "BAIR (Berkeley AI Research)",
    kind: "research-org",
    feedUrl: "https://bair.berkeley.edu/blog/feed.xml",
    homeUrl: "https://bair.berkeley.edu/blog/",
    roleLabel: "primary",
    reviewLabel: "preprint",
    independence: "independent",
    provenanceNote: "Academic RL, reasoning, human-compatible AI & scaling research from UC Berkeley",
    history: "full-feed",
  },
  {
    id: "alignment-forum",
    name: "AI Alignment Forum",
    kind: "forum",
    feedUrl: "https://www.alignmentforum.org/feed.xml",
    homeUrl: "https://www.alignmentforum.org/",
    roleLabel: "primary",
    reviewLabel: "forum-peer",
    independence: "independent",
    provenanceNote: "Curated technical alignment, mechanistic interpretability, inner alignment & AI control forum",
    history: "forum-graphql",
  },
  {
    id: "lesswrong-ai",
    name: "LessWrong",
    kind: "forum",
    feedUrl: "https://www.lesswrong.com/feed.xml",
    homeUrl: "https://www.lesswrong.com/",
    roleLabel: "primary",
    reviewLabel: "forum-peer",
    independence: "independent",
    provenanceNote: "Long-form technical AI timelines, safety cases, takeoff debates & forecasting analysis",
    history: "forum-graphql",
  },
  {
    id: "import-ai",
    name: "Import AI (Jack Clark)",
    kind: "newsletter",
    feedUrl: "https://importai.substack.com/feed",
    homeUrl: "https://importai.substack.com/",
    roleLabel: "secondary",
    reviewLabel: "curated-synthesis",
    independence: "independent",
    provenanceNote: "Weekly synthesis of frontier capability papers, evaluations & compute policy",
    history: "substack",
  },
  {
    id: "zvi-ai",
    name: "Don't Worry About the Vase",
    kind: "newsletter",
    feedUrl: "https://thezvi.substack.com/feed",
    homeUrl: "https://thezvi.substack.com/",
    roleLabel: "secondary",
    reviewLabel: "curated-synthesis",
    independence: "independent",
    provenanceNote: "Comprehensive weekly frontier lab, governance & safety synthesis",
    history: "substack",
  },
  {
    id: "transformer-news",
    name: "Transformer News",
    kind: "newsletter",
    feedUrl: "https://www.transformernews.ai/feed",
    homeUrl: "https://www.transformernews.ai/",
    roleLabel: "secondary",
    reviewLabel: "curated-synthesis",
    independence: "independent",
    provenanceNote: "Dedicated reporting on frontier AI governance, legislation & safety institutes",
    history: "substack",
  },
  {
    id: "gnews-superintelligence",
    name: "Google News: Superintelligence & AGI Policy",
    kind: "news",
    feedUrl:
      "https://news.google.com/rss/search?q=(superintelligence+OR+%22artificial+general+intelligence%22+OR+%22frontier+AI+regulation%22+OR+%22AI+Safety+Institute%22)+-%22Alamos+Gold%22+-NYSE+when%3A7d&hl=en-US&gl=US&ceid=US:en",
    homeUrl: "https://news.google.com/",
    roleLabel: "secondary",
    reviewLabel: "press-search",
    independence: "independent",
    provenanceNote: "Multi-outlet press aggregation for superintelligence & frontier governance (stock-ticker noise excluded)",
    history: "gnews-month",
  },
  {
    id: "gnews-ai-alignment",
    name: "Google News: AI Alignment & Safety Evaluations",
    kind: "news",
    feedUrl:
      "https://news.google.com/rss/search?q=(%22AI+alignment%22+OR+%22scalable+oversight%22+OR+%22deceptive+alignment%22+OR+%22existential+risk%22+AI)+when%3A7d&hl=en-US&gl=US&ceid=US:en",
    homeUrl: "https://news.google.com/",
    roleLabel: "secondary",
    reviewLabel: "press-search",
    independence: "independent",
    provenanceNote: "Multi-outlet press aggregation for technical AI alignment, oversight & existential risk",
    history: "gnews-month",
  },
];
