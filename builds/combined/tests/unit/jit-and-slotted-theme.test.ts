import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildStoryAuditPayload,
  clearAllJitCaches,
  getOrComputeJit,
  invalidateJitSchema,
  scopedJitKey,
  StoryAuditPayloadSchema,
} from "../../lib/jit";
import { evaluatePaperRigor } from "../../lib/paper-rigor";
import type { StoryView } from "../../lib/stories";
import {
  EMBLEM_LAYERS,
  nextThemeMode,
  normalizeTheme,
  SLOTTED_CSS_TOKENS,
  THEME_MODES,
  THEME_SPECS,
} from "../../lib/theme";

describe("BrandEmblem 3-primitive ontology & slotted theme contract", () => {
  it("defines exactly three clean geometric layers for the Bounded Horizon mark", () => {
    assert.equal(EMBLEM_LAYERS.length, 3);
    assert.deepEqual(
      EMBLEM_LAYERS.map((l) => l.id),
      ["containment-ring", "alignment-horizon", "zenith-point"],
    );
    for (const layer of EMBLEM_LAYERS) {
      assert.ok(layer.name.length > 3);
      assert.ok(layer.geometry.length > 5);
      assert.ok(layer.meaning.length > 20);
    }
  });

  it("supports tri-theme Paper / Obsidian / Atelier cycling and slotted --aui-* tokens", () => {
    assert.deepEqual(THEME_MODES, ["light", "dark", "atelier"]);
    assert.equal(normalizeTheme(undefined), "light");
    assert.equal(normalizeTheme("dark"), "dark");
    assert.equal(normalizeTheme("atelier"), "atelier");
    assert.equal(normalizeTheme("tactical"), "atelier");
    assert.equal(nextThemeMode("light"), "dark");
    assert.equal(nextThemeMode("dark"), "atelier");
    assert.equal(nextThemeMode("atelier"), "light");

    assert.equal(THEME_SPECS.light.isDarkScheme, false);
    assert.equal(THEME_SPECS.dark.isDarkScheme, true);
    assert.equal(THEME_SPECS.atelier.isDarkScheme, true);
    assert.ok(SLOTTED_CSS_TOKENS.includes("--aui-panel"));
    assert.ok(SLOTTED_CSS_TOKENS.includes("--aui-accent"));
    assert.ok(SLOTTED_CSS_TOKENS.includes("--aui-landmark-bg"));
  });

  it("enforces zero hardcoded hex colors and zero inline style={{}} across all 25 slotted UI surfaces", () => {
    const slottedFiles = [
      "components/auth-form.tsx",
      "components/brand-emblem.tsx",
      "components/command-wayfinding.tsx",
      "components/copy-link-button.tsx",
      "components/feed-toolbar.tsx",
      "components/interactive-paper-figure.tsx",
      "components/interactive-si-atlas.tsx",
      "components/nav-links.tsx",
      "components/site-header.tsx",
      "components/story-actions-bar.tsx",
      "components/story-audit-drawer.tsx",
      "components/story-card.tsx",
      "components/theme-toggle.tsx",
      "app/page.tsx",
      "app/analysis/page.tsx",
      "app/brief/page.tsx",
      "app/compare/page.tsx",
      "app/limits/page.tsx",
      "app/queue/page.tsx",
      "app/review/page.tsx",
      "app/saved/page.tsx",
      "app/signin/page.tsx",
      "app/signup/page.tsx",
      "app/sources/page.tsx",
      "app/stories/[id]/page.tsx",
    ];

    for (const rel of slottedFiles) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      assert.equal(
        /#[0-9a-fA-F]{3,8}\b/.test(src),
        false,
        `Expected zero hardcoded hex colors in ${rel}`,
      );
      assert.equal(
        src.includes("style={{"),
        false,
        `Expected zero inline style={{}} in ${rel}`,
      );
    }
  });
});

describe("JIT single-flight cache & Zod-validated StoryAuditPayload", () => {
  it("coalesces concurrent readers (single-flight) and isolates by schema", async () => {
    clearAllJitCaches();
    let computeCalls = 0;

    const key = scopedJitKey("test-ns", "alpha");
    const [r1, r2, r3] = await Promise.all([
      getOrComputeJit(key, 5_000, async () => {
        computeCalls += 1;
        await new Promise((r) => setTimeout(r, 15));
        return { count: 42 };
      }),
      getOrComputeJit(key, 5_000, async () => {
        computeCalls += 1;
        return { count: 99 };
      }),
      getOrComputeJit(key, 5_000, async () => {
        computeCalls += 1;
        return { count: 100 };
      }),
    ]);

    assert.equal(computeCalls, 1);
    assert.deepEqual(r1, { count: 42 });
    assert.deepEqual(r2, { count: 42 });
    assert.deepEqual(r3, { count: 42 });

    invalidateJitSchema();
    const afterInvalidation = await getOrComputeJit(key, 5_000, async () => {
      computeCalls += 1;
      return { count: 43 };
    });
    assert.equal(computeCalls, 2);
    assert.deepEqual(afterInvalidation, { count: 43 });
  });

  it("synthesizes a valid StoryAuditPayload across all 3 audience altitudes", () => {
    const rigor = evaluatePaperRigor({
      title: "Scalable Oversight with Verifiable Debate Protocols",
      summary:
        "We run an ablation study across 5 random seeds with 95% confidence intervals against human baseline on GPQA Diamond (78.4%), releasing open-source code at github.com/example/debate-eval and Lean 4 machine-checked statements.",
      url: "https://arxiv.org/abs/2501.00001",
      sourceKinds: ["papers"],
    });

    const mockStory: StoryView = {
      id: "101",
      title: "Scalable Oversight with Verifiable Debate Protocols",
      url: "https://arxiv.org/abs/2501.00001",
      summary:
        "We run an ablation study across 5 random seeds with 95% confidence intervals against human baseline on GPQA Diamond (78.4%).",
      authors: "A. Researcher",
      publishedAt: new Date("2026-02-01T00:00:00Z"),
      firstSeenAt: new Date("2026-02-01T01:00:00Z"),
      inScope: true,
      scopeReason: "Matched alignment & scalable oversight.",
      significanceScore: 76,
      rigorScore: rigor.rigorScore,
      hypeScore: rigor.hypeScore,
      credibilityBand: rigor.credibilityBand,
      formalRung: rigor.formalProof.rungId,
      paperRigor: rigor,
      bestScore: 82,
      updateType: "Research paper",
      evidenceLevel: "Peer-reviewed / arXiv",
      why: [{ factor: "Primary research artifact", points: 20, detail: "arXiv preprint with open protocol" }],
      orgs: [{ id: "anthropic", label: "Anthropic" }],
      benchmarks: [
        {
          id: "gpqa",
          label: "GPQA Diamond",
          measures: "PhD-level science reasoning",
          matched: "GPQA",
          score: { value: 78.4, unit: "%", raw: "78.4%" },
        },
      ],
      people: [],
      codeUrls: ["https://github.com/example/debate-eval"],
      aiScore: 9.1,
      aiReason: "Strong empirical scalable-oversight result with reproducible code.",
      aiModel: "tier0-ontology",
      aiTier: 0,
      aiVerdict: "accept",
      aiConfidence: 0.92,
      aiTrail: [],
      sources: [
        {
          sourceId: "arxiv-ai",
          name: "arXiv cs.AI",
          kind: "papers",
          url: "https://arxiv.org/abs/2501.00001",
          outlet: null,
          roleLabel: "Preprint server",
          reviewLabel: "Open preprint",
          independence: "Independent archive",
          firstSeenAt: new Date("2026-02-01T01:00:00Z"),
          lagMinutes: 0,
        },
      ],
      topics: [
        { id: "alignment", label: "Alignment & Control", isRoot: true, matched: ["scalable oversight"], via: null },
      ],
      rootTopics: [
        { id: "alignment", label: "Alignment & Control", isRoot: true, matched: ["scalable oversight"], via: null },
      ],
      votes: 5,
      voted: false,
      saved: false,
    };

    const payload = buildStoryAuditPayload(mockStory);
    const verified = StoryAuditPayloadSchema.parse(payload);
    assert.equal(verified.storyId, "101");
    assert.ok(verified.levels.intuitive.includes("Landmark tier"));
    assert.ok(verified.levels.technical.includes("GPQA Diamond"));
    assert.ok(verified.levels.institutional.includes(rigor.credibilityBand.toUpperCase()));
    assert.ok(verified.presentMarkers.length >= 1);
  });
});
