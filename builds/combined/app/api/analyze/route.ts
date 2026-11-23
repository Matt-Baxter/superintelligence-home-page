import { NextResponse } from "next/server";
import { analyzeStory } from "@/lib/analysis";
import { deterministicScoreFromSignals } from "@/lib/assess";
import { WORKED_EVALUATION_EXAMPLES } from "@/lib/canon-stories";
import { tagText } from "@/lib/ontology";
import { parseAnalysisLabQuery, SourceKindSchema } from "@/lib/schemas";
import { BAKEOFF_FORENSICS_ROWS, getSimOuterLoopReport, SI_BENCHMARK_CASES, runSiHarnessVariant } from "@/lib/sim-loop";
import { computeBestStoryScore } from "@/lib/stories";
import { getCurrentUser } from "@/lib/auth";
import { actorFor, consumeQuota, quotaErrorResponse } from "@/lib/usage";

// Machine-readable JSON twin for `/analysis` (SIM Outer-Loop + Worked Examples + Live Paper Rigor Inspector + Bake-Off Forensics).

function runLivePaperInspection(input: {
  title: string;
  summary: string;
  url: string;
  sourceKind: ReturnType<typeof SourceKindSchema.parse>;
  sourceCount: number;
}) {
  const tagged = tagText(input.title, input.summary);
  const analysis = analyzeStory({
    title: input.title,
    summary: input.summary,
    url: input.url,
    topics: tagged.topics,
    sourceKinds: [input.sourceKind],
    sourceCount: input.sourceCount,
  });
  const calibratedRating = deterministicScoreFromSignals({
    significanceScore: analysis.significanceScore,
    rigorScore: analysis.rigorScore,
    hypeScore: analysis.hypeScore,
    inScope: tagged.inScope,
    promptInjection: analysis.paperRigor.promptInjection.fired,
  });
  const bestComposite = computeBestStoryScore({
    aiScore: calibratedRating,
    significanceScore: analysis.significanceScore,
    rigorScore: analysis.rigorScore,
    hypeScore: analysis.hypeScore,
    sourceCount: input.sourceCount,
  });

  return {
    input,
    scope: {
      inScope: tagged.inScope,
      reason: tagged.scopeReason,
      rootTopics: tagged.rootTopics,
      allTopics: tagged.topics,
      organizations: tagged.orgs,
    },
    scores: {
      calibratedRating10: calibratedRating,
      bestStoryComposite100: bestComposite,
      significanceScore100: analysis.significanceScore,
      rigorScore100: analysis.rigorScore,
      hypeScore100: analysis.hypeScore,
      credibilityBand: analysis.paperRigor.credibilityBand,
      formalRung: analysis.paperRigor.formalProof.rungId,
    },
    whyBreakdown: analysis.why,
    paperRigor: analysis.paperRigor,
    benchmarks: analysis.benchmarks,
    peopleMetadataOnly: analysis.people,
  };
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    raw[k] = v;
  }
  const q = parseAnalysisLabQuery(raw);

  const selectedExample =
    WORKED_EVALUATION_EXAMPLES.find((e) => e.id === q.example) ?? WORKED_EVALUATION_EXAMPLES[0];

  const liveInput = q.title
    ? {
        title: q.title,
        summary: q.summary,
        url: q.url || "https://arxiv.org/abs/2501.00000",
        sourceKind: q.kind,
        sourceCount: q.sources,
      }
    : {
        title: selectedExample.title,
        summary: selectedExample.summary,
        url: selectedExample.url,
        sourceKind: SourceKindSchema.catch("papers").parse(selectedExample.sourceKind),
        sourceCount: selectedExample.sourceCount,
      };

  const simReport = getSimOuterLoopReport(q.track, q.round);
  const liveInspection = runLivePaperInspection(liveInput);

  return NextResponse.json({
    schemaVersion: "si-analysis-lab-v1",
    query: q,
    simOuterLoop: simReport,
    evolveVsHoldoutCases: SI_BENCHMARK_CASES.map((c) => ({
      ...c,
      h0: runSiHarnessVariant(0, c),
      h3: runSiHarnessVariant(3, c),
    })),
    selectedWorkedExample: {
      meta: selectedExample,
      unifiedEvaluation: runLivePaperInspection({
        title: selectedExample.title,
        summary: selectedExample.summary,
        url: selectedExample.url,
        sourceKind: SourceKindSchema.catch("papers").parse(selectedExample.sourceKind),
        sourceCount: selectedExample.sourceCount,
      }),
    },
    liveInspector: liveInspection,
    bakeoffForensics: BAKEOFF_FORENSICS_ROWS,
  });
}

export async function POST(request: Request): Promise<Response> {
  const { actor, tier } = actorFor(await getCurrentUser(), request);
  const quota = await consumeQuota({ actor, tier, action: "analyze" });
  if (!quota.ok) return quotaErrorResponse(quota);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 2000) : "";
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 300) : "https://arxiv.org/abs/2501.00000";
  const sourceKind = SourceKindSchema.catch("papers").parse(body.kind);
  const sourceCount = Math.max(1, Math.min(10, Number(body.sources) || 1));

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  return NextResponse.json({
    schemaVersion: "si-analysis-lab-v1",
    liveInspector: runLivePaperInspection({ title, summary, url, sourceKind, sourceCount }),
  });
}
