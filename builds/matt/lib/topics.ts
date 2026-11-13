// Superintelligence topics and key phrases, copied exactly from the spec table
// "Superintelligence topics and key phrases" (spec v1.3). Fixed for both builds: change it only
// with both partners' approval and a changelog entry. (REQ-003, REQ-005)

export type Topic = {
  id: string;
  label: string;
  phrases: string[];
};

export const TOPICS: Topic[] = [
  {
    id: "capabilities-agi",
    label: "Capabilities & AGI progress",
    phrases: ["AGI", "artificial general intelligence", "superintelligence", "superintelligent", "frontier model", "human-level AI"],
  },
  {
    id: "automating-ai-research",
    label: "Automating AI research",
    phrases: ["automated AI research", "AI scientist", "automating AI research", "AI research agent"],
  },
  {
    id: "recursive-self-improvement",
    label: "Recursive self improvement",
    phrases: ["recursive self-improvement", "self-improving AI", "intelligence explosion"],
  },
  {
    id: "alignment",
    label: "Alignment",
    phrases: ["alignment", "aligned AI", "misalignment", "reward hacking", "scalable oversight", "superalignment"],
  },
  {
    id: "interpretability",
    label: "Interpretability",
    phrases: ["interpretability", "mechanistic interpretability", "sparse autoencoder"],
  },
  {
    id: "safety-risk",
    label: "Safety & risk",
    phrases: ["AI safety", "existential risk", "x-risk", "catastrophic risk", "loss of control", "deceptive alignment"],
  },
  {
    id: "forecasting-timelines",
    label: "Forecasting & timelines",
    phrases: ["AGI timelines", "forecasting AI", "AI forecast", "transformative AI"],
  },
  {
    id: "compute-scaling",
    label: "Compute & scaling",
    phrases: ["scaling laws", "compute scaling", "training compute", "scaling hypothesis"],
  },
  {
    id: "governance-policy",
    label: "Governance & policy",
    phrases: ["AI governance", "frontier AI regulation", "compute governance", "AI policy", "frontier AI safety"],
  },
];

export const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

export type TopicMatch = { id: string; label: string; matched: string[] };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A phrase matches only as whole words: it can't have a letter or digit directly before or
// after it. So "AGI" matches "AGI timelines" but not "magic", and "align" never matches
// "alignment". Capital letters are ignored. (REQ-003, spec v1.3)
function phraseRegex(phrase: string): RegExp {
  const body = escapeRegex(phrase.toLowerCase()).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u");
}

const COMPILED = TOPICS.map((t) => ({
  topic: t,
  phrases: t.phrases.map((p) => ({ phrase: p, re: phraseRegex(p) })),
}));

// Returns every topic the text matches, with the key phrases that matched (as written in the
// spec). An empty result means the item is not about superintelligence and is left out.
export function matchTopics(text: string): TopicMatch[] {
  const haystack = text.toLowerCase();
  const results: TopicMatch[] = [];
  for (const { topic, phrases } of COMPILED) {
    const matched = phrases.filter(({ re }) => re.test(haystack)).map(({ phrase }) => phrase);
    if (matched.length > 0) {
      results.push({ id: topic.id, label: topic.label, matched });
    }
  }
  return results;
}
