import type { Metadata } from "next";
import Link from "next/link";
import { CopyLinkButton } from "@/components/copy-link-button";
import { InteractivePaperFigure } from "@/components/interactive-paper-figure";
import { WORKED_EVALUATION_EXAMPLES } from "@/lib/canon-stories";
import {
  parseAnalysisLabQuery,
  serializeAnalysisLabQuery,
  SourceKindSchema,
  type AnalysisTab,
} from "@/lib/schemas";
import {
  BAKEOFF_FORENSICS_ROWS,
  getSimOuterLoopReport,
  runSiHarnessVariant,
  SI_BENCHMARK_CASES,
} from "@/lib/sim-loop";

export const metadata: Metadata = {
  title: "Analysis & Self-Improvement Memory Lab",
  description:
    "Interactive Self-Improvement Memory (SIM) outer-loop harness lab, token-attributed 8-marker paper rigor inspector, worked evaluation examples, and Build A vs Build B synthesis.",
};

export const dynamic = "force-dynamic";

const TAB_SPECS: { id: AnalysisTab; idx: string; label: string; sub: string }[] = [
  {
    id: "sim-loop",
    idx: "01",
    label: "SIM Outer-Loop Harness",
    sub: "Frozen policy · Memory ledger · Sealed holdouts",
  },
  {
    id: "worked-examples",
    idx: "02",
    label: "Worked Paper & Noise Cases",
    sub: "10 canonical calibrations & interactive spans",
  },
  {
    id: "live-inspector",
    idx: "03",
    label: "Interactive Rigor Figure",
    sub: "Token attribution · Negations · Perturbations",
  },
  {
    id: "forensics",
    idx: "04",
    label: "Bake-Off Architecture",
    sub: "Build A + Build B empirical synthesis",
  },
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

  return (
    <>
      <div className="feed-banner">
        <div className="feed-banner-copy">
          <div className="banner-eyebrow-row">
            <span className="editorial-section-tag">Methodology &amp; Rigor Workbench</span>
            <span className="atlas-divider-dot" aria-hidden="true">/</span>
            <span className="editorial-section-meta">Reproducible · URL-Stateful · JSON Twin</span>
          </div>
          <h1 className="feed-heading">Analysis, Paper Rigor &amp; Self-Improvement Memory Lab</h1>
          <p className="feed-subtitle">
            Improve the evaluation harness first under a frozen policy, record both retained and rejected edits in Self-Improvement Memory (
            <span className="math-sym">
              <i>M</i>
              <sub>t</sub>
            </span>
            ), isolate sealed holdout families outside the loop, and inspect every paper&apos;s inline feature attributions.
          </p>
        </div>

        <div className="utility-group">
          {hasCustomState && (
            <Link href="/analysis" className="btn-secondary btn-small">
              Reset
            </Link>
          )}
          <CopyLinkButton relativeHref={currentHref} />
          <a href={jsonTwinHref} className="btn-secondary btn-small" title="Machine-readable JSON twin for /analysis">
            JSON Twin
          </a>
        </div>
      </div>

      {/* Architectural 4-Column Lab Navigation */}
      <nav className="lab-tabs-architectural" aria-label="Analysis lab sections">
        {TAB_SPECS.map((t) => (
          <Link
            key={t.id}
            href={serializeAnalysisLabQuery({ ...q, tab: t.id })}
            className="lab-arch-tab"
            aria-current={q.tab === t.id ? "true" : undefined}
          >
            <span className="lab-arch-idx">FIG. {t.idx}</span>
            <strong className="lab-arch-title">{t.label}</strong>
            <span className="lab-arch-sub">{t.sub}</span>
          </Link>
        ))}
      </nav>

      {q.tab === "sim-loop" && (
        <section aria-labelledby="sim-heading">
          <div className="workspace-toolbar slot-mb-lg">
            <div className="toolbar-top-bar">
              <div className="view-lenses" role="group" aria-label="Select SIM outer-loop domain track">
                <Link
                  href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", track: "si-curation", round: 3 })}
                  className="lens-tab"
                  aria-current={q.track === "si-curation" ? "true" : undefined}
                >
                  Track A · Curation Harness (H₀ → H₃)
                </Link>
                <Link
                  href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", track: "gemma-decoder", round: 1 })}
                  className="lens-tab"
                  aria-current={q.track === "gemma-decoder" ? "true" : undefined}
                >
                  Track B · Gemma v6 Tool-Decoder Replay
                </Link>
              </div>

              <div className="utility-group" role="group" aria-label="Select outer-loop round">
                <span className="mono-kicker">Iteration:</span>
                {[0, 1, 2, 3].map((r) => (
                  <Link
                    key={r}
                    href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", round: r })}
                    className="taxonomy-chip"
                    aria-current={simReport.activeRound === r ? "true" : undefined}
                  >
                    <span>
                      Round {r} (H<sub>{r}</sub>)
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="sim-figure-intro">
              <div>
                <h2 id="sim-heading" className="atlas-heading sim-intro-title">
                  {simReport.title}
                </h2>
                <p className="sim-intro-sub">{simReport.subtitle}</p>
              </div>
            </div>

            {/* Clean Mathematical Architecture Diagram */}
            <div className="sim-loop-diagram" aria-label="SIM in the agentic outer loop architecture">
              <div className="sim-node">
                <span className="sim-node-step">STAGE 01 · EVALUATOR</span>
                <strong className="sim-node-heading">
                  Frozen Policy <i>M</i> in <i>H</i>
                  <sub>t</sub>
                </strong>
                <span className="sim-node-sub">
                  Executes frozen policy <i>M</i> inside harness <i>H</i>
                  <sub>t</sub> on evolve-set tasks; emits feedback <i>F</i>
                  <sub>t</sub> and execution trace <i>D</i>
                  <sub>t</sub>.
                </span>
              </div>

              <div className="sim-node">
                <span className="sim-node-step">STAGE 02 · PROPOSER</span>
                <strong className="sim-node-heading">
                  Reads <i>D</i>
                  <sub>t</sub> + Memory <i>M</i>
                  <sub>t</sub>
                </strong>
                <span className="sim-node-sub">
                  Consults <i>M</i>
                  <sub>t</sub> so previously falsified edits are never repeated; synthesizes <i>k</i> candidate harnesses{" "}
                  <i>H</i>
                  <sub>t</sub>
                  <sup>(1..k)</sup>.
                </span>
              </div>

              <div className="sim-node">
                <span className="sim-node-step">STAGE 03 · SELECTOR</span>
                <strong className="sim-node-heading">
                  Verify &amp; Gate <i>H</i>
                  <sub>t+1</sub>
                </strong>
                <span className="sim-node-sub">
                  Promotes <i>H</i>
                  <sub>t+1</sub> if and only if the target failure is resolved AND all prior regression gates hold.
                </span>
              </div>

              <div className="sim-node memory-node">
                <span className="sim-node-step">STAGE 04 · INVARIANT LEDGER</span>
                <strong className="sim-node-heading">
                  Self-Improvement Memory <i>M</i>
                  <sub>t</sub>
                </strong>
                <span className="sim-node-sub">
                  Records root cause, decisive signal trace, predicted vs. observed deltas, and rejected candidates—strictly isolated from sealed holdouts.
                </span>
              </div>
            </div>
          </div>

          {/* Active Round Inspection Plate */}
          <article className="panel-card elevated-plate slot-mb-lg">
            <div className="story-header-row slot-mb-sm">
              <div className="story-kicker">
                <span className="landmark-seal">
                  Round {activeEntry.round} · {activeEntry.retainedHarnessId}
                </span>
                <span>{activeEntry.checkpointOrPolicy}</span>
                <span className="kicker-sep">·</span>
                <span>{activeEntry.benchmarkSplit}</span>
              </div>
            </div>

            <h3 className="sim-root-heading">Diagnosed Root Cause &amp; Decisive Signal Trace</h3>
            <p className="sim-root-copy">
              <strong>Root cause:</strong> {activeEntry.rootCause}
            </p>
            <div className="ai-assessment sim-trace-box">
              <span className="ai-score-chip">Decisive Trace</span>
              <span className="ai-reason-text">{activeEntry.decisiveSignalTrace}</span>
            </div>

            <h4 className="mono-kicker sim-kicker-spaced">
              PROPOSER CANDIDATES SCREENED BY SELECTOR ({activeEntry.candidatesEvaluated.length})
            </h4>
            <div className="candidate-grid">
              {activeEntry.candidatesEvaluated.map((cand) => (
                <div key={cand.id} className={`candidate-card ${cand.selected ? "selected" : "rejected"}`}>
                  <div className="candidate-card-head">
                    <strong className="candidate-card-label">{cand.label}</strong>
                    <span className={cand.selected ? "landmark-seal sage" : "hype-seal"}>
                      {cand.selected ? "✓ Retained" : "✕ Rejected → Logged in M_t"}
                    </span>
                  </div>

                  <p className="candidate-edit-copy">
                    <strong>Proposed edit:</strong> {cand.proposedEdit}
                  </p>
                  <p className="candidate-pred-copy">
                    <strong>Predicted:</strong> {cand.predictedEffect}
                  </p>
                  <p className="candidate-obs-copy">
                    <strong>Observed:</strong> {cand.observedOutcome}
                  </p>

                  <div className="candidate-metrics-row">
                    <span className="metric-pill">
                      <span className="metric-pill-label">Evolve</span>
                      <strong className="metric-pill-val">{cand.evolveScore}%</strong>
                    </span>
                    <span className="metric-pill">
                      <span className="metric-pill-label">Precision</span>
                      <strong className="metric-pill-val">{cand.precisionPct}%</strong>
                    </span>
                    <span className="metric-pill">
                      <span className="metric-pill-label">Recall</span>
                      <strong className="metric-pill-val">{cand.recallPct}%</strong>
                    </span>
                    <span className="metric-pill">
                      <span className="metric-pill-label">Gates</span>
                      <strong className="metric-pill-val">{cand.regressionCheckPassed ? "PASS" : "HOLD"}</strong>
                    </span>
                  </div>

                  <p className="candidate-rationale-copy">
                    <strong>Selector rationale:</strong> {cand.selectorRationale}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <div className="panel-grid">
            <section className="panel-card" aria-labelledby="holdout-heading">
              <span className="mono-kicker brass-dot">GOODHART CONTAINMENT</span>
              <h3 id="holdout-heading" className="holdout-card-heading">
                Sealed Held-Out Generalization (Outside Loop &amp; <i>M</i>
                <sub>t</sub>)
              </h3>
              <p className="holdout-rule-copy">{simReport.sealedHoldoutSummary.isolationRule}</p>

              {/* Native Accessible Slotted Progress Comparison: Baseline H_0 vs Retained H_3 */}
              <div className="waterfall-list holdout-bars">
                <div className="waterfall-row">
                  <div className="waterfall-meta">
                    <span>Baseline Harness (H₀)</span>
                    <span className="mono-num">{simReport.sealedHoldoutSummary.baselinePct}%</span>
                  </div>
                  <progress
                    className="slot-progress soft"
                    value={simReport.sealedHoldoutSummary.baselinePct}
                    max={100}
                    aria-label="Baseline harness sealed holdout score"
                  />
                </div>
                <div className="waterfall-row">
                  <div className="waterfall-meta">
                    <strong>Retained Unified Harness (H₃)</strong>
                    <strong className="mono-num">{simReport.sealedHoldoutSummary.retainedPct}%</strong>
                  </div>
                  <progress
                    className="slot-progress"
                    value={simReport.sealedHoldoutSummary.retainedPct}
                    max={100}
                    aria-label="Retained unified harness sealed holdout score"
                  />
                </div>
              </div>

              <p className="holdout-detail-copy">{simReport.sealedHoldoutSummary.detail}</p>
            </section>

            <section className="panel-card" aria-labelledby="allrounds-heading">
              <span className="mono-kicker">CUMULATIVE MEMORY LEDGER</span>
              <h3 id="allrounds-heading" className="ledger-card-heading">
                Iteration History (<i>M</i>
                <sub>0</sub> → <i>M</i>
                <sub>3</sub>)
              </h3>
              <ul className="stack-list">
                {simReport.memoryLedger.map((entry) => {
                  const isCurrent = entry.round === simReport.activeRound;
                  return (
                    <li key={entry.round} className={`stack-row ledger-stack-row${isCurrent ? " highlighted" : ""}`}>
                      <div className="ledger-row-inner">
                        <Link
                          href={serializeAnalysisLabQuery({ ...q, tab: "sim-loop", round: entry.round })}
                          className={`ledger-round-link${isCurrent ? " is-current" : ""}`}
                        >
                          Round {entry.round} · {entry.retainedHarnessId}
                        </Link>
                        <span className="mono-kicker">
                          {entry.candidatesEvaluated.length} candidate{entry.candidatesEvaluated.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <h3 className="section-heading">When to Train After Fixing the Harness (Residual Error Curriculum)</h3>
          <p className="section-lede">
            Lock the deterministic harness before comparing model checkpoints so weight updates or judge prompts earn credit solely for irreducible reasoning improvements.
          </p>
          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Residual Failure Class</th>
                  <th>Contrastive Curriculum Examples</th>
                  <th>Causal Isolation Mechanism</th>
                  <th>Executable Verification Gate</th>
                </tr>
              </thead>
              <tbody>
                {simReport.residualTrainingRules.map((rule, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{rule.whenToTrain}</strong>
                    </td>
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
                Live Evolve vs. Sealed Holdout Execution Trace (<i>H</i>
                <sub>0</sub> Build A vs. <i>H</i>
                <sub>3</sub> Unified)
              </h3>
              <div className="matrix-table-wrap">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Split &amp; Family</th>
                      <th>Benchmark Paper / Adversarial Noise Case</th>
                      <th>H₀ (Build A Baseline)</th>
                      <th>H₃ (Unified Engine)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SI_BENCHMARK_CASES.map((c) => {
                      const h0 = runSiHarnessVariant(0, c);
                      const h3 = runSiHarnessVariant(3, c);
                      return (
                        <tr key={c.id}>
                          <td>
                            <span className={c.split === "sealed-holdout" ? "landmark-seal" : "era-seal"}>{c.split}</span>
                            <div className="bench-family-sub">
                              {c.family} ({c.publishedYear})
                            </div>
                          </td>
                          <td>
                            <strong>{c.title}</strong>
                            <div className="bench-expected-sub">
                              Expected: {c.expectedInScope ? `In-scope (${c.expectedRootTopic ?? "SI"})` : "Excluded (out-of-scope)"}
                              {c.expectedHighRank === false ? " · Low rank (hype/injected)" : ""}
                            </div>
                          </td>
                          <td className="bench-cell-muted">
                            <strong>{h0.inScope ? (h0.highRank ? "KEPT (8.0+)" : "KEPT (low)") : "DROPPED"}</strong>
                            <div>{h0.note}</div>
                          </td>
                          <td className="bench-cell">
                            <strong>{h3.inScope ? (h3.highRank ? "KEPT (8.0+)" : "CAPPED / REJECTED") : "BLOCKED ($0)"}</strong>
                            <div className="slot-text-secondary">{h3.note}</div>
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
          <div className="workspace-toolbar slot-mb-lg">
            <span className="mono-kicker">SELECT CANONICAL PAPER OR ADVERSARIAL NOISE CASE (10 GOLD CALIBRATIONS)</span>
            <div className="taxonomy-strip taxonomy-strip-flush" role="group" aria-label="Worked evaluation examples">
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
                  className="taxonomy-chip"
                  aria-current={selectedExample.id === ex.id ? "true" : undefined}
                >
                  <span>{ex.shortLabel}</span>
                </Link>
              ))}
            </div>
          </div>

          <article className="panel-card elevated-plate slot-mb-lg">
            <div className="story-kicker worked-kicker-row">
              <span className="landmark-seal">{selectedExample.category}</span>
            </div>
            <h2 id="examples-heading" className="worked-heading">
              {selectedExample.title}
            </h2>

            <div className="candidate-grid">
              <div className="candidate-card">
                <span className="mono-kicker">BUILD A (MATT)</span>
                <p className="worked-note">{selectedExample.buildANote}</p>
              </div>
              <div className="candidate-card">
                <span className="mono-kicker">BUILD B (JOHN)</span>
                <p className="worked-note">{selectedExample.buildBNote}</p>
              </div>
              <div className="candidate-card selected">
                <span className="mono-kicker brass-dot">UNIFIED ENGINE RESOLUTION</span>
                <p className="worked-note-primary">{selectedExample.unifiedResolution}</p>
              </div>
            </div>
          </article>

          <InteractivePaperFigure
            initialTitle={selectedExample.title}
            initialSummary={selectedExample.summary}
            initialUrl={selectedExample.url}
            initialKind={SourceKindSchema.catch("papers").parse(selectedExample.sourceKind)}
            initialSources={selectedExample.sourceCount}
            editable={true}
          />
        </section>
      )}

      {q.tab === "live-inspector" && (
        <section aria-labelledby="inspector-heading">
          <h2 id="inspector-heading" className="sr-only">
            Interactive Paper Rigor &amp; Feature Attribution Figure
          </h2>
          <InteractivePaperFigure
            initialTitle={inspectorInput.title}
            initialSummary={inspectorInput.summary}
            initialUrl={inspectorInput.url}
            initialKind={inspectorInput.kind}
            initialSources={inspectorInput.sources}
            editable={true}
          />
        </section>
      )}

      {q.tab === "forensics" && (
        <section aria-labelledby="forensics-heading">
          <div className="panel-card elevated-plate forensics-plate">
            <span className="mono-kicker brass-dot">ARCHITECTURAL SYNTHESIS</span>
            <h2 id="forensics-heading" className="forensics-heading">
              Empirical Bake-Off Forensics: Build A (Matt) vs. Build B (John) → Combined Engine
            </h2>
            <p className="forensics-lede">
              Every subsystem below was evaluated against shared acceptance tests and adversarial arXiv edge cases—retaining Build A&apos;s clean editorial restraint and calibrated 8.0+ auditability alongside Build B&apos;s hierarchical ontology, 8-family rigor detector, and negation-aware verification.
            </p>
          </div>

          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Subsystem</th>
                  <th>Build A (builds/matt)</th>
                  <th>Build B (builds/john)</th>
                  <th>Pruned Failure Mode</th>
                  <th>Unified Architecture</th>
                </tr>
              </thead>
              <tbody>
                {BAKEOFF_FORENSICS_ROWS.map((row) => (
                  <tr key={row.subsystem}>
                    <td>
                      <strong>{row.subsystem}</strong>
                    </td>
                    <td>{row.mattBuildA}</td>
                    <td>{row.johnBuildB}</td>
                    <td className="slot-text-muted">{row.prunedWhatWeDropped}</td>
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
