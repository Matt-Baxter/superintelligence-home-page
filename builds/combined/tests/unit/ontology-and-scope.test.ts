import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandSearchToTopicIds, ROOT_TOPICS, tagText } from "../../lib/ontology.ts";

describe("Unified Ontology & Context-Disambiguated Scope Gate (REQ-003, REQ-005, REQ-C01)", () => {
  it("exposes all 9 canonical shared-spec superintelligence topics", () => {
    assert.equal(ROOT_TOPICS.length, 9);
    const labels = ROOT_TOPICS.map((t) => t.label);
    assert.deepEqual(labels, [
      "Capabilities & AGI progress",
      "Automating AI research",
      "Recursive self improvement",
      "Alignment",
      "Interpretability",
      "Safety & risk",
      "Forecasting & timelines",
      "Compute & scaling",
      "Governance & policy",
    ]);
  });

  it('AT-04: tags "AGI timelines" under Forecasting & timelines with exact matched phrase', () => {
    const res = tagText(
      "Sample Survey on AGI Timelines",
      "Researchers updated median estimates for AGI timelines and transformative AI.",
    );
    assert.equal(res.inScope, true);
    const topic = res.rootTopics.find((t) => t.id === "forecasting-timelines");
    assert.ok(topic, "expected forecasting-timelines topic");
    assert.ok(topic.matched.includes("AGI timelines"), `matched was ${topic.matched.join(", ")}`);
  });

  it("AT-02: excludes general AI product items like an AI photo-editing app", () => {
    const res = tagText(
      "Sample Launch: Instant AI Photo-Editing App for Smartphones",
      "A consumer AI photo-editing app removes backgrounds and adjusts lighting in one tap.",
    );
    assert.equal(res.inScope, false);
    assert.equal(res.rootTopics.length, 0);
  });

  it("AT-C1: blocks geometric/modality 'alignment' & narrow applied-ML false positives caught in bake-off", () => {
    const falsePositives = [
      [
        "HiUni: Harmonizing Understanding and Generation with Cross-Modal Alignment",
        "We propose visual alignment and modality alignment of embeddings for video generation.",
      ],
      [
        "292P Towards self-improving neural networks: LLM-guided evolution of medical image models",
        "Automated hyperparameter search for medical image segmentation datasets.",
      ],
      [
        "A hybrid self-improvable meta-learning network for utterance-level Sentiment classification in scripted dialogues",
        "Improves sentiment F1 on dialogue benchmarks.",
      ],
      [
        "AURA: Audio-Driven Streaming Avatar for Real-Time Portrait Animation",
        "Generates lip-synced avatars from speech.",
      ],
      [
        "Democratizing Cross-Project Knowledge for Transforming Water Governance and Climate Resilience",
        "Municipal water governance dashboard.",
      ],
    ];

    for (const [title, summary] of falsePositives) {
      const res = tagText(title, summary);
      assert.equal(res.inScope, false, `Expected out-of-scope for false positive: "${title}"`);
    }
  });

  it("AT-C2: captures sub-topic breakthroughs that flat phrase lists missed and rolls up via lineage", () => {
    const concepts = tagText(
      "Extracting Concepts from GPT-4",
      "Using sparse autoencoders and monosemanticity to map internal features in frontier language models.",
    );
    assert.equal(concepts.inScope, true);
    assert.ok(concepts.rootTopics.some((t) => t.id === "interpretability"));

    const cot = tagText(
      "Reasoning models struggle to control their chains of thought",
      "Evaluating chain-of-thought monitoring and reasoning faithfulness on frontier tasks.",
    );
    assert.equal(cot.inScope, true);
    const interp = cot.rootTopics.find((t) => t.id === "interpretability");
    assert.ok(interp, "CoT monitoring should roll up to Interpretability");
    assert.equal(interp.via, "Chain-of-thought monitoring");
  });

  it("expands domain search queries like RLHF to canonical topic IDs", () => {
    const expanded = expandSearchToTopicIds("RLHF");
    assert.ok(expanded.includes("alignment"));
  });
});
