import type { Metadata } from "next";
import Link from "next/link";
import { CopyLinkButton } from "@/components/copy-link-button";
import { analyzeStory } from "@/lib/analysis";
import { deterministicScoreFromSignals } from "@/lib/assess";
import { WORKED_EVALUATION_EXAMPLES } from "@/lib/canon-stories";
import { tagText } from "@/lib/ontology";
import {
  parseAnalysisLabQuery,
  serializeAnalysisLabQuery,
  SOURCE_KINDS,
  SourceKindSchema,
  type AnalysisTab,
} from "@/lib/schemas";
import {
  BAKEOFF_FORENSICS_ROWS,
  getSimOuterLoopReport,
  runSiHarnessVariant,
  SI_BENCHMARK_CASES,
} from "@/lib/sim-loop";
import { computeBestStoryScore } from "@/lib/stories";

export const metadata: Metadata = {
  title: "Analysis & Self-Improvement Memory Lab",
  description:
    "Interactive Self-Improvement Memory (SIM) outer-loop harness lab, 8-marker paper rigor inspector, worked evaluation examples, and Build A vs Build B synthesis.",
};

export const dynamic = "force-dynamic";

const TAB_LABELS: { id: AnalysisTab; label: string }[] = [
  { id: "sim-loop", label: "1. SIM Outer-Loop Harness Lab" },
  { id: "worked-examples", label: "2. Worked Paper & Noise Examples (10)" },
  { id: "live-inspector", label: "3. Live Paper Rigor Inspector" },
  { id: "forensics", label: "4. Matt vs John Bake-Off Synthesis" },
];

export default async function AnalysisLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = parseAnalysisLabQuery(raw);
  const currentHref = serializeAnalysisLabQuery(q);
  const jsonTwinHref = `/api/analyze${currentHref === "/analysis" ? "" : currentHref.slice("/analysis".length)}`;
  const hasCustomState = currentHref !== "/analysis";

  const selectedExample =
    WORKED_EVALUATION_EXAMPLES.find((e) => e.id === q.example) ?? WORKED_EVALUATION_EXAMPLES[0];

  const inspectorInput = q.title
    ? {
        title: q.title,
        summary: q.summary,
        url: q.url || "https://arxiv.org/abs/2501.00000",
        kind: q.kind,
        sources: q.sources,
      }
    : {
        title: selectedExample.title,
        summary: selectedExample.summary,
        url: selectedExample.url,
        kind: SourceKindSchema.catch("papers").parse(selectedExample.sourceKind),
        sources: selectedExample.sourceCount,
      };

  const simReport = getSimOuterLoopReport(q.track, q.round);
  const activeEntry =
    simReport.memoryLedger.find((m) => m.round === simReport.activeRound) ??
    simReport.memoryLedger[simReport.memoryLedger.length - 1];

  // Live deterministic evaluation for Worked Examples / Live Inspector
  const liveTag = tagText(inspectorInput.title, inspectorInput.summary);
  const liveAnalysis = analyzeStory({
    title: inspectorInput.title,
    summary: inspectorInput.summary,
    url: inspectorInput.url,
    topics: liveTag.topics,
    sourceKinds: [inspectorInput.kind],
    sourceCount: inspectorInput.sources,
  });
  const liveCalibrated10 = deterministicScoreFromSignals({
    significanceScore: liveAnalysis.significanceScore,
    rigorScore: liveAnalysis.rigorScore,
    hypeScore: liveAnalysis.hypeScore,
    inScope: liveTag.inScope,
    promptInjection: liveAnalysis.paperRigor.promptInjection.fired,
  });
  const liveBest100 = computeBestStoryScore({
    aiScore: liveCalibrated10,
    significanceScore: liveAnalysis.significanceScore,
    rigorScore: liveAnalysis.rigorScore,
    hypeScore: liveAnalysis.hypeScore,
    sourceCount: inspectorInput.sources,
  });

  return (
    <>
      <div className="feed-banner">
        <div>
          <h1 className="feed-heading">Analysis, Paper Rigor &amp; Self-Improvement Memory Lab</h1>
          <p className="feed-subtitle">
            Improve the harness first with frozen policies, record both retained and rejected edits in Self-Improvement Memory (<em>M_t</em>), keep sealed holdout families outside the loop, and inspect every paper&apos;s empirical evidence, claim backing, and scope disambiguation.
          </p>
        </div>

        <div className="utility-group">
          {hasCustomState && (
            <Link href="/analysis" className="btn-secondary">
              Reset
            </Link>
          )}
          <CopyLinkButton relativeHref={currentHref} />
          <a href={jsonTwinHref} className="btn-secondary" title="Machine-readable JSON twin for /analysis">
            JSON Twin
          </a>
        </div>
      </div>

      <nav className="lab-tabs" aria-label="Analysis lab sections">
        {TAB_LABELS.map((t) => (
          <Link
            key={t.id}
            href={serializeAnalysisLabQuery({ ...q, tab: t.id })}
            className="preset-pill"
            aria-current={q.tab === t.id ? "true" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {q.tab === "sim-loop" && (
        <section aria-labelledby="sim-heading">
          <div className="toolbar-shell">
            <div className="preset-row">
              <div className="preset-group" role="group" aria-label="Select SIM outer-loop domain track">
                <span className="eyebrow-label">Harness Track</span>
                <Link
                  href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", track: "si-curation", round: 3 })}
                  className="preset-pill"
                  aria-current={q.track === "si-curation" ? "true" : undefined}
                >
                  Track A: Superintelligence Curation Harness (H_0 → H_3)
                </Link>
                <Link
                  href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", track: "gemma-decoder", round: 1 })}
                  className="preset-pill"
                  aria-current={q.track === "gemma-decoder" ? "true" : undefined}
                >
                  Track B: Gemma v6 Tool-Decoder Replay (7/7 Penalty Fix → Residual Spec)
                </Link>
              </div>

              <div className="preset-group" role="group" aria-label="Select outer-loop round">
                <span className="eyebrow-label">Round</span>
                {[0, 1, 2, 3].map((r) => (
                  <Link
                    key={r}
                    href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", round: r })}
                    className="topic-pill"
                    aria-current={simReport.activeRound === r ? "true" : undefined}
                  >
                    Round {r}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 id="sim-heading" style={{ margin: "0 0 0.25rem", fontSize: "1.1rem" }}>
                {simReport.title}
              </h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>{simReport.subtitle}</p>
            </div>

            <div className="sim-loop-diagram" aria-label="SIM in the agentic outer loop architecture">
              <div className="sim-node">
                <span className="sim-node-title">1. Evaluator (Frozen Policy M)</span>
                <span className="sim-node-sub">
                  Runs M in H_t on evolve-set tasks; emits Feedback F_t &amp; logs History D_t (code, traces, diffs).
                </span>
              </div>
              <div className="sim-node">
                <span className="sim-node-title">2. Proposer (reads D_t + SIM)</span>
                <span className="sim-node-sub">
                  Consults M_t so rejected edits are never repeated; proposes k candidate harnesses H_t^(1)..H_t^(k).
                </span>
              </div>
              <div className="sim-node">
                <span className="sim-node-title">3. Selector (Verify + Screen)</span>
                <span className="sim-node-sub">
                  Consults M_t; promotes H_&#123;t+1&#125; only if target failure is fixed AND full regression gates pass (else keeps H_t).
                </span>
              </div>
              <div className="sim-node memory-node">
                <span className="sim-node-title">4. Self-Improvement Memory M_t</span>
                <span className="sim-node-sub">
                  Stores checkpoint/settings, root cause, decisive token/signal, predicted vs observed outcome &amp; rejected candidates.
                </span>
              </div>
            </div>
          </div>

          <article className="panel-card" style={{ marginBottom: "1.25rem" }}>
            <div className="story-top-meta">
              <span className="sig-badge landmark">Round {activeEntry.round}</span>
              <span className="sig-badge">{activeEntry.retainedHarnessId}</span>
              <span>{activeEntry.checkpointOrPolicy}</span>
              <span>·</span>
              <span>{activeEntry.benchmarkSplit}</span>
            </div>

            <h3 style={{ margin: "0.4rem 0 0.35rem", fontSize: "1.05rem" }}>
              Diagnosed Root Cause &amp; Decisive Signal Trace
            </h3>
            <p style={{ margin: "0 0 0.45rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              <strong>Root cause:</strong> {activeEntry.rootCause}
            </p>
            <p className="ai-assessment" style={{ margin: "0 0 0.85rem" }}>
              <strong className="ai-score">Decisive trace: </strong>
              {activeEntry.decisiveSignalTrace}
            </p>

            <h4 style={{ margin: "0 0 0.35rem", fontSize: "0.95rem" }}>
              Proposer Candidates Screened by Selector ({activeEntry.candidatesEvaluated.length})
            </h4>
            <div className="candidate-grid">
              {activeEntry.candidatesEvaluated.map((cand) => (
                <div
                  key={cand.id}
                  className={`candidate-card ${cand.selected ? "selected" : "rejected"}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{cand.label}</strong>
                    <span className={`sig-badge ${cand.selected ? "landmark" : "warn"}`}>
                      {cand.selected ? "RETAINED" : "REJECTED → LOGGED IN M_t"}
                    </span>
                  </div>
                  <p style={{ margin: "0.45rem 0 0.35rem", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                    <strong>Proposed edit:</strong> {cand.proposedEdit}
                  </p>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.825rem", color: "var(--muted)" }}>
                    <strong>Predicted:</strong> {cand.predictedEffect}
                  </p>
                  <p style={{ margin: "0 0 0.45rem", fontSize: "0.825rem", color: "var(--text)" }}>
                    <strong>Observed:</strong> {cand.observedOutcome}
                  </p>
                  <div className="story-top-meta" style={{ marginBottom: "0.35rem" }}>
                    <span className="sig-badge">Score {cand.evolveScore}%</span>
                    <span className="sig-badge">Precision {cand.precisionPct}%</span>
                    <span className="sig-badge">Recall {cand.recallPct}%</span>
                    <span className="sig-badge">
                      Gates: {cand.regressionCheckPassed ? "PASS" : "HOLD"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                    <strong>Selector rationale:</strong> {cand.selectorRationale}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <div className="panel-grid">
            <section className="panel-card" aria-labelledby="holdout-heading">
              <h3 id="holdout-heading" style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>
                Sealed Held-Out Evaluation (Strictly Outside Loop &amp; M_t)
              </h3>
              <p style={{ margin: "0 0 0.6rem", fontSize: "0.83rem", color: "var(--muted)" }}>
                {simReport.sealedHoldoutSummary.isolationRule}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
                <span className="sig-badge">Baseline H_0: {simReport.sealedHoldoutSummary.baselinePct}%</span>
                <span className="sig-badge landmark">
                  Retained H_3: {simReport.sealedHoldoutSummary.retainedPct}%
                </span>
                <span className="sig-badge">Precision: {simReport.sealedHoldoutSummary.precisionPct}%</span>
                <span className="sig-badge">Recall: {simReport.sealedHoldoutSummary.recallPct}%</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {simReport.sealedHoldoutSummary.detail}
              </p>
            </section>

            <section className="panel-card" aria-labelledby="allrounds-heading">
              <h3 id="allrounds-heading" style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>
                Cumulative Self-Improvement Memory Ledger (M_0 → M_3)
              </h3>
              <ul className="stack-list">
                {simReport.memoryLedger.map((entry) => (
                  <li key={entry.round} className="stack-row" style={{ padding: "0.55rem 0.7rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <Link
                        href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", round: entry.round })}
                        style={{ fontWeight: 600, fontSize: "0.85rem" }}
                      >
                        Round {entry.round}: {entry.retainedHarnessId}
                      </Link>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {entry.candidatesEvaluated.length} candidate(s)
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <h3 className="section-heading">
            When to Train After Fixing the Harness (Residual Error Curriculum)
          </h3>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "var(--muted)" }}>
            Lock the decoder / curation harness before comparing checkpoints so weight updates or judge prompts get credit only for genuine improvements in generated calls and executed results.
          </p>
          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>When to Train (Residual Failure)</th>
                  <th>Contrastive Examples to Prioritize</th>
                  <th>Why It Isolates the Mechanism</th>
                  <th>Executable Verification Gate</th>
                </tr>
              </thead>
              <tbody>
                {simReport.residualTrainingRules.map((rule, idx) => (
                  <tr key={idx}>
                    <td><strong>{rule.whenToTrain}</strong></td>
                    <td>{rule.examplesToPrioritize}</td>
                    <td>{rule.whyItWorks}</td>
                    <td>{rule.verificationGate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {q.track === "si-curation" && (
            <>
              <h3 className="section-heading">
                Live Evolve vs. Sealed Holdout Execution Trace (H_0 Build A vs. H_3 Unified)
              </h3>
              <div className="matrix-table-wrap">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Split &amp; Family</th>
                      <th>Benchmark Paper / Noise Item</th>
                      <th>H_0 (Build A)</th>
                      <th>H_3 (Unified Combined)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SI_BENCHMARK_CASES.map((c) => {
                      const h0 = runSiHarnessVariant(0, c);
                      const h3 = runSiHarnessVariant(3, c);
                      return (
                        <tr key={c.id}>
                          <td>
                            <span className={`sig-badge ${c.split === "sealed-holdout" ? "landmark" : ""}`}>
                              {c.split}
                            </span>
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                              {c.family} ({c.publishedYear})
                            </div>
                          </td>
                          <td>
                            <strong>{c.title}</strong>
                            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                              Expected: {c.expectedInScope ? `In-scope (${c.expectedRootTopic ?? "SI"})` : "Excluded (out-of-scope)"}
                              {c.expectedHighRank === false ? " · Low rank (hype/injected)" : ""}
                            </div>
                          </td>
                          <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                            <strong>{h0.inScope ? (h0.highRank ? "KEPT (8.0+)" : "KEPT (low)") : "DROPPED"}</strong>
                            <div>{h0.note}</div>
                          </td>
                          <td style={{ fontSize: "0.8rem" }}>
                            <strong>{h3.inScope ? (h3.highRank ? "KEPT (8.0+)" : "CAPPED / REJECTED") : "BLOCKED ($0)"}</strong>
                            <div style={{ color: "var(--text-secondary)" }}>{h3.note}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {q.tab === "worked-examples" && (
        <section aria-labelledby="examples-heading">
          <div className="toolbar-shell">
            <span className="eyebrow-label">Select Worked Paper or Noise Case (10 Gold Examples)</span>
            <div className="preset-group" role="group" aria-label="Worked evaluation examples">
              {WORKED_EVALUATION_EXAMPLES.map((ex) => (
                <Link
                  key={ex.id}
                  href={serializeAnalysisLabQuery({
                    ...q,
                    tab: "worked-examples",
                    example: ex.id,
                    title: "",
                    summary: "",
                  })}
                  className="preset-pill"
                  aria-current={selectedExample.id === ex.id ? "true" : undefined}
                >
                  {ex.shortLabel}
                </Link>
              ))}
            </div>
          </div>

          <article className="panel-card" style={{ marginBottom: "1.25rem" }}>
            <div className="story-top-meta">
              <span className="sig-badge landmark">{selectedExample.category}</span>
              <span className="sig-badge">Calibrated {liveCalibrated10.toFixed(1)}/10</span>
              <span className="sig-badge">Best Composite {liveBest100}/100</span>
              <span className="sig-badge">Significance {liveAnalysis.significanceScore}/100</span>
              <span className="sig-badge">Rigor {liveAnalysis.rigorScore}/100</span>
              {liveAnalysis.hypeScore > 0 && (
                <span className={`sig-badge ${liveAnalysis.hypeScore >= 35 ? "warn" : ""}`}>
                  Hype {liveAnalysis.hypeScore}/100
                </span>
              )}
            </div>

            <h2 id="examples-heading" style={{ margin: "0.35rem 0 0.45rem", fontSize: "1.25rem" }}>
              {selectedExample.title}
            </h2>
            <p className="summary">{selectedExample.summary}</p>

            <div className="candidate-grid" style={{ marginTop: "0.85rem" }}>
              <div className="candidate-card">
                <strong style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  Matt&apos;s Build A (builds/matt)
                </strong>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>{selectedExample.buildANote}</p>
              </div>
              <div className="candidate-card">
                <strong style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  John&apos;s Build B (builds/john)
                </strong>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>{selectedExample.buildBNote}</p>
              </div>
              <div className="candidate-card selected">
                <strong style={{ fontSize: "0.85rem" }}>
                  Unified Engine (builds/combined)
                </strong>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>{selectedExample.unifiedResolution}</p>
              </div>
            </div>

            <div style={{ marginTop: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <Link
                href={serializeAnalysisLabQuery({
                  tab: "live-inspector",
                  title: selectedExample.title,
                  summary: selectedExample.summary,
                  url: selectedExample.url,
                  kind: SourceKindSchema.catch("papers").parse(selectedExample.sourceKind),
                  sources: selectedExample.sourceCount,
                })}
                className="btn-primary"
              >
                Edit &amp; Perturb in Live Inspector →
              </Link>
            </div>
          </article>

          <div className="panel-grid">
            <div className="panel-card">
              <h3 style={{ margin: "0 0 0.45rem", fontSize: "1rem" }}>
                Live Scope &amp; Topic Lineage Output
              </h3>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.84rem", color: "var(--muted)" }}>
                <strong>{liveTag.inScope ? "IN SCOPE" : "OUT OF SCOPE"}:</strong> {liveTag.scopeReason}
              </p>
              {liveTag.topics.length > 0 && (
                <ul className="stack-list">
                  {liveTag.topics.map((t) => (
                    <li key={t.id} className="stack-row" style={{ padding: "0.45rem 0.65rem", fontSize: "0.825rem" }}>
                      <strong>{t.label}</strong> ({t.isRoot ? "Root" : "Sub-topic"}) — matched:{" "}
                      {t.matched.join(", ")}
                      {t.via ? ` · via ${t.via}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel-card">
              <h3 style={{ margin: "0 0 0.45rem", fontSize: "1rem" }}>
                Live Significance &amp; Rigor Breakdown
              </h3>
              <ul className="stack-list">
                {liveAnalysis.why.map((w) => (
                  <li key={w.factor} className="stack-row" style={{ padding: "0.45rem 0.65rem", fontSize: "0.825rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <strong>{w.factor}</strong>
                      <span className={`sig-badge ${w.points < 0 ? "warn" : ""}`}>
                        {w.points > 0 ? `+${w.points}` : w.points} pts
                      </span>
                    </div>
                    <div style={{ color: "var(--muted)", marginTop: "0.15rem" }}>{w.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {q.tab === "live-inspector" && (
        <section aria-labelledby="inspector-heading">
          <form method="get" action="/analysis" className="toolbar-shell" aria-label="Live paper rigor and ontology inspector">
            <input type="hidden" name="tab" value="live-inspector" />
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <h2 id="inspector-heading" style={{ margin: 0, fontSize: "1.05rem" }}>
                Evaluate Any Paper Title &amp; Abstract Deterministically
              </h2>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Zero LLM cost · URL-shareable · Negation &amp; prompt-injection aware
              </span>
            </div>

            <label className="control-field" style={{ flex: "1 1 100%" }}>
              Paper or Article Title
              <input
                type="text"
                name="title"
                defaultValue={inspectorInput.title}
                maxLength={300}
                required
              />
            </label>

            <label className="control-field" style={{ flex: "1 1 100%" }}>
              Abstract / Summary Snippet (test negations like &ldquo;without a baseline&rdquo;, benchmarks, or Lean 4 proofs)
              <textarea
                name="summary"
                defaultValue={inspectorInput.summary}
                maxLength={1500}
              />
            </label>

            <div className="controls-form">
              <label className="control-field search-field">
                Source URL
                <input type="text" name="url" defaultValue={inspectorInput.url} maxLength={300} />
              </label>

              <label className="control-field">
                Source Kind
                <select name="kind" defaultValue={inspectorInput.kind}>
                  {SOURCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>

              <label className="control-field">
                Independent Sources
                <input
                  type="number"
                  name="sources"
                  min={1}
                  max={10}
                  defaultValue={inspectorInput.sources}
                />
              </label>

              <button type="submit" className="btn-primary">
                Run Engine
              </button>
            </div>
          </form>

          <section className="panel-grid" aria-label="Inspector scores">
            <div className="stat-card">
              <div className="stat-value">{liveTag.inScope ? `${liveCalibrated10.toFixed(1)}/10` : "Rejected"}</div>
              <div className="stat-label">Calibrated Tier-0 Score ({liveTag.inScope ? "In scope" : "Out of scope"})</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{liveBest100}/100</div>
              <div className="stat-label">Best-Story Composite</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{liveAnalysis.rigorScore}/100</div>
              <div className="stat-label">Empirical Rigor ({liveAnalysis.paperRigor.credibilityBand})</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{liveAnalysis.hypeScore}/100</div>
              <div className="stat-label">
                Hype / Unbacked Risk {liveAnalysis.paperRigor.promptInjection.fired ? "(INJECTION FIRED)" : ""}
              </div>
            </div>
          </section>

          <div className="panel-grid">
            <div className="panel-card">
              <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>
                8-Family Empirical Markers ({liveAnalysis.paperRigor.presentMarkers.length} present)
              </h3>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                Kind: <strong>{liveAnalysis.paperRigor.paperKind.label}</strong> · Formal proof:{" "}
                <strong>{liveAnalysis.paperRigor.formalProof.label}</strong>
              </p>
              <ul className="stack-list">
                {liveAnalysis.paperRigor.presentMarkers.map((m) => (
                  <li key={m.id} className="stack-row" style={{ padding: "0.45rem 0.65rem", fontSize: "0.82rem" }}>
                    <strong>{m.label}</strong> (+{m.points}) — <span style={{ color: "var(--muted)" }}>&ldquo;{m.snippet}&rdquo;</span>
                  </li>
                ))}
              </ul>
              {liveAnalysis.paperRigor.negatedMarkers.length > 0 && (
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.82rem", color: "var(--status-warn)" }}>
                  Blocked negated markers:{" "}
                  {liveAnalysis.paperRigor.negatedMarkers.map((n) => `${n.label} ("${n.snippet}")`).join("; ")}
                </p>
              )}
            </div>

            <div className="panel-card">
              <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>
                Point-by-Point Significance Ledger ({liveAnalysis.significanceScore}/100)
              </h3>
              <ul className="stack-list">
                {liveAnalysis.why.map((w) => (
                  <li key={w.factor} className="stack-row" style={{ padding: "0.45rem 0.65rem", fontSize: "0.82rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{w.factor}</strong>
                      <span className={`sig-badge ${w.points < 0 ? "warn" : ""}`}>
                        {w.points > 0 ? `+${w.points}` : w.points}
                      </span>
                    </div>
                    <div style={{ color: "var(--muted)", marginTop: "0.15rem" }}>{w.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {q.tab === "forensics" && (
        <section aria-labelledby="forensics-heading">
          <div className="panel-card" style={{ marginBottom: "1rem" }}>
            <h2 id="forensics-heading" style={{ margin: "0 0 0.35rem", fontSize: "1.15rem" }}>
              Empirical Bake-Off Forensics: Matt (builds/matt) vs. John (builds/john) → Combined Build
            </h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Matt&apos;s earlier snapshot was evaluated against an older static cut without topic filtering or pre-2023 arXiv/GraphQL backfills, while John&apos;s live build had richer ontology and paper rigor modules in JS that weren&apos;t yet disambiguated against CV/medical arXiv noise. Below is exactly what we audited, what we pruned, and what we unified.
            </p>
          </div>

          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Subsystem</th>
                  <th>Build A (builds/matt)</th>
                  <th>Build B (builds/john)</th>
                  <th>Pruned (What We Cut)</th>
                  <th>Unified Best in builds/combined</th>
                </tr>
              </thead>
              <tbody>
                {BAKEOFF_FORENSICS_ROWS.map((row) => (
                  <tr key={row.subsystem}>
                    <td><strong>{row.subsystem}</strong></td>
                    <td>{row.mattBuildA}</td>
                    <td>{row.johnBuildB}</td>
                    <td style={{ color: "var(--muted)" }}>{row.prunedWhatWeDropped}</td>
                    <td>{row.unifiedBestPicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
