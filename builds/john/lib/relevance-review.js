// Review-only phrase strategies based on spec 001 v1.1 in PR #3.
const { stripHtml } = require("./feeds");
const { analyze } = require("./analysis");
const { topicIndex } = require("./tagger");
const { resolve } = require("./publication-identity");

const phrases = {
  capabilities: ["AGI", "artificial general intelligence", "superintelligence", "superintelligent", "frontier model", "human-level AI"],
  "automating-ai-research": ["automated AI research", "AI scientist", "automating AI research", "AI research agent"],
  "recursive-self-improvement": ["recursive self-improvement", "self-improving AI", "intelligence explosion"],
  alignment: ["alignment", "aligned AI", "misalignment", "reward hacking", "scalable oversight", "superalignment"],
  interpretability: ["interpretability", "mechanistic interpretability", "sparse autoencoder"],
  safety: ["AI safety", "existential risk", "x-risk", "catastrophic risk", "loss of control", "deceptive alignment"],
  forecasting: ["AGI timelines", "forecasting AI", "AI forecast", "transformative AI"],
  compute: ["scaling laws", "compute scaling", "training compute", "scaling hypothesis"],
  policy: ["AI governance", "frontier AI regulation", "compute governance", "AI policy", "frontier AI safety"],
};

const escapeRegex = phrase => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactPatterns = new Map(Object.values(phrases).flat().map(phrase => [
  phrase, new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_])${escapeRegex(phrase)}(?![\\p{L}\\p{N}\\p{M}_])`, "iu"),
]));

function proposedTopics({ title, summary }, { exact = false } = {}) {
  const fields = { title: title ?? "", summary: summary ?? "" };
  return Object.entries(phrases).flatMap(([topic, terms]) => {
    const evidence = terms.flatMap(phrase => Object.entries(fields)
      .filter(([, value]) => exact ? exactPatterns.get(phrase).test(value) : value.toLowerCase().includes(phrase.toLowerCase()))
      .map(([field]) => ({ phrase, field })));
    if (!evidence.length) return [];
    return [{ topic, label: topicIndex.byId.get(topic).label, matched: [...new Set(evidence.map(hit => hit.phrase))], evidence }];
  });
}

const ambiguousTerms = new Set(["alignment", "misalignment", "loss of control", "catastrophic risk", "existential risk"]);

function reviewFeedItems(entries) {
  const publications = new Map(), topics = new Map();
  const items = entries.map(({ source, item }, index) => {
    const id = index + 1;
    const identity = resolve(item.url);
    const literal = proposedTopics(item);
    // Summary markup is preserved for display. Match visible prose for review.
    const exact = proposedTopics({ ...item, summary: stripHtml(item.summary) }, { exact: true });
    const current = analyze(item).scope;
    // These phrases also occur outside AI. Send isolated matches to review.
    const hits = exact.flatMap(match => match.matched);
    const ambiguous = hits.length > 0 && hits.every(phrase => ambiguousTerms.has(phrase));
    const reviewReasons = [];
    if (!exact.some(match => match.topic === "recursive-self-improvement") &&
        /\bRSI\b/.test(item.title ?? "") &&
        /\b(?:AI|LLMs?|agents?|models?|simulator)\b/i.test(item.title ?? "")) {
      reviewReasons.push("Possible recursive self-improvement shorthand (RSI) in title");
    }
    if (current.in !== Boolean(exact.length)) reviewReasons.push("Current policy and exact phrases disagree");
    if (JSON.stringify(literal) !== JSON.stringify(exact)) reviewReasons.push("Literal and exact prose matches differ");
    if (ambiguous) reviewReasons.push("Matched phrases can also describe topics outside AI");

    if (identity.key) {
      if (!publications.has(identity.key)) publications.set(identity.key, []);
      publications.get(identity.key).push(id);
    }
    for (const match of ambiguous ? [] : exact) {
      if (!topics.has(match.topic)) topics.set(match.topic, { label: match.label, basis: "Shared phrase in feed metadata", items: [] });
      topics.get(match.topic).items.push(id);
    }
    return {
      id, source, title: item.title, url: item.url, published: item.published ?? null,
      fieldsReviewed: item.summary?.trim() ? ["title", "summary"] : ["title"],
      identity, relevance: {
        current, literal, exact,
        needsReview: reviewReasons.length > 0, reviewReasons,
      },
    };
  });
  return {
    items,
    samePublication: [...publications].filter(([, ids]) => ids.length > 1)
      .map(([key, items]) => ({ key, items })),
    sharedTopic: [...topics].filter(([, topic]) => new Set(topic.items.map(id => items[id - 1].identity.key ?? id)).size > 1)
      .map(([topic, group]) => ({ topic, ...group })),
  };
}

module.exports = { proposedTopics, reviewFeedItems };
