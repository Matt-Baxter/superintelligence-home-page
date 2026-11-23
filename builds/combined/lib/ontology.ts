import {
  AI_ALIGNMENT_CONTEXT_RE,
  CORE_SI_ANCHOR_RE,
  NARROW_APPLIED_AI_RE,
  NON_SAFETY_ALIGNMENT_COLLOCATIONS,
  ONTOLOGY_ORGS,
  ONTOLOGY_TOPICS,
  STOCK_TICKER_NOISE_RE,
  type TopicDefinition,
} from "./ontology-data";
import { ROOT_TOPIC_IDS, type EntityHit, type RootTopicId } from "./schemas";

// Hierarchical Ontology Tagger + Context-Disambiguated Scope & Alignment Gate
// (REQ-003, REQ-005, AT-02, AT-04, AT-13, REQ-C01).

export type MatchedTopic = {
  id: string;
  label: string;
  isRoot: boolean;
  rootId: RootTopicId;
  matched: string[];
  via: string | null;
  centrality: number; // 0.5–1.0: title canonical hit = 1.0, body canonical/multi-hit = 0.85, single sub-topic = 0.65
};

export type TagResult = {
  topics: MatchedTopic[];
  rootTopics: MatchedTopic[];
  orgs: EntityHit[];
  inScope: boolean;
  scopeReason: string;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word Unicode boundary matcher; supports trailing `*` prefix wildcard.
export function compileTermRegex(term: string): RegExp {
  const clean = term.trim();
  const wildcard = clean.endsWith("*");
  const base = wildcard ? clean.slice(0, -1) : clean;
  const body = escapeRegex(base).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])(${body}${wildcard ? "[\\p{L}\\p{N}-]*" : ""})(?![\\p{L}\\p{N}])`, "iu");
}

const TOPIC_MAP = new Map<string, TopicDefinition>(ONTOLOGY_TOPICS.map((t) => [t.id, t]));
const ROOT_ORDER = new Map<string, number>(ROOT_TOPIC_IDS.map((id, idx) => [id, idx]));

function resolveRootId(topicId: string): RootTopicId {
  let current = TOPIC_MAP.get(topicId);
  const visited = new Set<string>();
  while (current?.parent && !visited.has(current.id)) {
    visited.add(current.id);
    current = TOPIC_MAP.get(current.parent);
  }
  return (current?.id ?? topicId) as RootTopicId;
}

type CompiledTopic = {
  def: TopicDefinition;
  rootId: RootTopicId;
  isRoot: boolean;
  canonical: { phrase: string; re: RegExp }[];
  extended: { term: string; re: RegExp }[];
};

const COMPILED_TOPICS: CompiledTopic[] = ONTOLOGY_TOPICS.map((def) => ({
  def,
  rootId: resolveRootId(def.id),
  isRoot: !def.parent,
  canonical: def.canonicalPhrases.map((phrase) => ({ phrase, re: compileTermRegex(phrase) })),
  extended: (def.extendedTerms ?? []).map((term) => ({ term, re: compileTermRegex(term) })),
}));

const COMPILED_ORGS = ONTOLOGY_ORGS.map((org) => ({
  id: org.id,
  label: org.label,
  res: org.terms.map((t) => compileTermRegex(t)),
}));

export const ROOT_TOPICS = COMPILED_TOPICS.filter((t) => t.isRoot).map((t) => ({
  id: t.def.id as RootTopicId,
  label: t.def.label,
}));

export const TOPIC_LABEL_BY_ID = new Map<string, string>(ONTOLOGY_TOPICS.map((t) => [t.id, t.label]));

// Masks geometric/modality/stakeholder "alignment" phrases before testing bare "alignment" so CV/video/enterprise papers
// never masquerade as AI alignment stories (closes Gap B1 from bake-off analysis.json).
export function maskNonSafetyAlignment(text: string): string {
  let masked = text;
  for (const re of NON_SAFETY_ALIGNMENT_COLLOCATIONS) {
    masked = masked.replace(re, " [non_safety_correspondence] ");
  }
  return masked;
}

export function tagText(title: string, summary = ""): TagResult {
  const fullText = `${title}\n${summary}`.slice(0, 6000);
  const alignmentSafeText = maskNonSafetyAlignment(fullText);
  const alignmentSafeTitle = maskNonSafetyAlignment(title);

  // 1. Stock-ticker "AGI" (Alamos Gold Inc.) hard exclusion
  if (STOCK_TICKER_NOISE_RE.test(fullText) && !/\b(?:artificial\s+general\s+intelligence|superintelligen\w*|openai|deepmind|anthropic)\b/i.test(fullText)) {
    return {
      topics: [],
      rootTopics: [],
      orgs: [],
      inScope: false,
      scopeReason: "Excluded: financial/stock-ticker 'AGI' mention unrelated to artificial general intelligence (REQ-003).",
    };
  }

  const narrowApplied = NARROW_APPLIED_AI_RE.test(fullText);
  const hasCoreAnchor = CORE_SI_ANCHOR_RE.test(alignmentSafeText);

  // 2. Narrow applied vertical (photo editing, medical segmentation, sentiment dialogues, streaming avatars, materials, water)
  // without an unambiguous core superintelligence anchor is excluded immediately.
  if (narrowApplied && !hasCoreAnchor) {
    return {
      topics: [],
      rootTopics: [],
      orgs: [],
      inScope: false,
      scopeReason: "Excluded: narrow applied-AI or domain-vertical item without a superintelligence anchor (REQ-003).",
    };
  }

  const directByTopic = new Map<
    string,
    { matched: string[]; canonicalHit: boolean; titleHit: boolean }
  >();

  const hasAiAlignmentContext = AI_ALIGNMENT_CONTEXT_RE.test(alignmentSafeText);

  for (const ct of COMPILED_TOPICS) {
    const targetText = ct.rootId === "alignment" ? alignmentSafeText : fullText;
    const targetTitle = ct.rootId === "alignment" ? alignmentSafeTitle : title;
    const hits: string[] = [];
    let canonicalHit = false;
    let titleHit = false;

    for (const { phrase, re } of ct.canonical) {
      // Bare "alignment" is polysemous across science & business; require AI/model/safety context
      if (phrase.toLowerCase() === "alignment" && !hasAiAlignmentContext) {
        continue;
      }
      if (re.test(targetText)) {
        hits.push(phrase);
        canonicalHit = true;
        if (re.test(targetTitle)) titleHit = true;
      }
    }

    for (const { re } of ct.extended) {
      const m = targetText.match(re);
      if (m?.[1]) {
        const found = m[1];
        if (!hits.some((h) => h.toLowerCase() === found.toLowerCase())) {
          hits.push(found);
        }
        if (re.test(targetTitle)) titleHit = true;
      }
    }

    if (hits.length > 0) {
      directByTopic.set(ct.def.id, { matched: hits.slice(0, 5), canonicalHit, titleHit });
    }
  }

  // Assemble matched topics + roll up child sub-topics to their canonical shared-spec root topic
  const topicsMap = new Map<string, MatchedTopic>();
  let anyCanonicalHit = false;

  for (const ct of COMPILED_TOPICS) {
    const hit = directByTopic.get(ct.def.id);
    if (!hit) continue;
    if (hit.canonicalHit) anyCanonicalHit = true;

    const centrality = hit.titleHit && hit.canonicalHit
      ? 1.0
      : hit.titleHit
        ? 0.92
        : hit.canonicalHit
          ? 0.85
          : hit.matched.length >= 2
            ? 0.78
            : 0.65;

    topicsMap.set(ct.def.id, {
      id: ct.def.id,
      label: ct.def.label,
      isRoot: ct.isRoot,
      rootId: ct.rootId,
      matched: hit.matched,
      via: null,
      centrality,
    });

    if (!ct.isRoot) {
      const existingRoot = topicsMap.get(ct.rootId);
      const rootDef = TOPIC_MAP.get(ct.rootId)!;
      if (!existingRoot) {
        topicsMap.set(ct.rootId, {
          id: ct.rootId,
          label: rootDef.label,
          isRoot: true,
          rootId: ct.rootId,
          matched: [...hit.matched],
          via: ct.def.label,
          centrality: Math.max(0.62, Number((centrality - 0.05).toFixed(2))),
        });
      } else {
        const merged = [...existingRoot.matched];
        for (const m of hit.matched) {
          if (!merged.some((x) => x.toLowerCase() === m.toLowerCase()) && merged.length < 6) {
            merged.push(m);
          }
        }
        existingRoot.matched = merged;
        existingRoot.centrality = Math.max(existingRoot.centrality, centrality);
        if (!existingRoot.via && !directByTopic.has(ct.rootId)) {
          existingRoot.via = ct.def.label;
        }
      }
    }
  }

  const allTopics = [...topicsMap.values()].sort((a, b) => {
    if (a.isRoot !== b.isRoot) return a.isRoot ? -1 : 1;
    if (b.centrality !== a.centrality) return b.centrality - a.centrality;
    return (ROOT_ORDER.get(a.rootId) ?? 99) - (ROOT_ORDER.get(b.rootId) ?? 99);
  });

  const rootTopics = allTopics.filter((t) => t.isRoot);

  const orgs: EntityHit[] = COMPILED_ORGS.filter((o) => o.res.some((r) => r.test(fullText))).map((o) => ({
    id: o.id,
    label: o.label,
  }));

  if (rootTopics.length === 0) {
    return {
      topics: [],
      rootTopics: [],
      orgs,
      inScope: false,
      scopeReason: "Excluded: matched zero superintelligence topics (REQ-003).",
    };
  }

  // High-precision dedicated roots
  const highPrecisionRoots = new Set<RootTopicId>([
    "automating-ai-research",
    "recursive-self-improvement",
    "alignment",
    "interpretability",
    "safety-risk",
    "forecasting-timelines",
    "governance-policy",
  ]);

  const hasDedicatedRoot = rootTopics.some((t) => highPrecisionRoots.has(t.rootId));
  const inScope =
    anyCanonicalHit ||
    hasCoreAnchor ||
    rootTopics.length >= 2 ||
    hasDedicatedRoot ||
    (orgs.length > 0 && rootTopics.some((t) => t.centrality >= 0.78));

  const scopeReason = inScope
    ? anyCanonicalHit
      ? `In scope: matched canonical spec phrase (${rootTopics.map((t) => t.label).join(", ")}).`
      : rootTopics.length >= 2
        ? `In scope: spans ${rootTopics.length} superintelligence domains (${rootTopics.map((t) => t.label).join(", ")}).`
        : `In scope: grounded in ${rootTopics[0].label} (${rootTopics[0].matched.join(", ")}).`
    : `Excluded: weak single sub-topic signal (${rootTopics[0].matched.join(", ")}) without frontier context (Constitution I).`;

  return {
    topics: allTopics,
    rootTopics,
    orgs,
    inScope,
    scopeReason,
  };
}

// Deterministic ontology query expansion: searching "RLHF", "mesa-optimization", or "monosemanticity" surfaces its canonical topic ID.
export function expandSearchToTopicIds(query: string): string[] {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = tagText(`${q} in frontier AI models`, "");
  const ids = new Set<string>(res.topics.map((t) => t.id));
  for (const t of ONTOLOGY_TOPICS) {
    if (t.label.toLowerCase().includes(q.toLowerCase())) {
      ids.add(t.id);
    }
  }
  return [...ids].slice(0, 5);
}
