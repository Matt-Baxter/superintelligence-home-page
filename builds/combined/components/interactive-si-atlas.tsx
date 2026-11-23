"use client";

import Link from "next/link";
import { useState } from "react";
import type { TopicCount } from "@/lib/stories";
import { BrandEmblem, InteractiveEmblemPlate } from "./brand-emblem";

export type ReadingLevel = "intuitive" | "technical" | "institutional";

type PillarSpec = {
  id: string;
  topicId: string;
  index: string;
  shortTitle: string;
  title: string;
  horizonX: number; // 0..100 position along phase curve
  capY: number;     // SVG y (lower = higher capability)
  ovY: number;      // SVG y for oversight curve
  keyMetric: string;
  levels: Record<
    ReadingLevel,
    {
      headline: string;
      explanation: string;
      exampleOrMechanism: string;
      openQuestion: string;
    }
  >;
};

const PILLARS: PillarSpec[] = [
  {
    id: "capabilities",
    topicId: "capabilities-agi",
    index: "I",
    shortTitle: "Capabilities & Scaling",
    title: "General Capability & Compute Scaling",
    horizonX: 14,
    capY: 142,
    ovY: 132,
    keyMetric: "METR task horizon · ARC-AGI · Frontier compute (FLOP)",
    levels: {
      intuitive: {
        headline: "From narrow single-task tools to general problem solvers",
        explanation:
          "Early AI systems mastered one game or task at a time, like chess or translation. Frontier systems combine pre-training scale with test-time reasoning so one model can write software, prove theorems, and plan multi-hour workflows.",
        exampleOrMechanism:
          "Everyday analogy: instead of hiring separate calculators for each chore, researchers are training a general apprentice whose uninterrupted work horizon doubles roughly every few months.",
        openQuestion:
          "How do we distinguish genuine out-of-distribution reasoning from memorized benchmark patterns?",
      },
      technical: {
        headline: "Pre-training scaling laws coupled with inference-time search",
        explanation:
          "Capability gains now compound across two axes: Chinchilla-style pre-training compute/data scaling and RL-trained chain-of-thought search over verifiable reward environments (code execution, formal math, multi-step tool trajectories).",
        exampleOrMechanism:
          "Tracked signals: autonomous task-completion half-life on METR horizons, SWE-bench Verified resolution, ARC-AGI sample efficiency, and post-training compute efficiency.",
        openQuestion:
          "Where does jagged generalization flatten when verifiable reward signals become sparse or delayed?",
      },
      institutional: {
        headline: "Empirical capability thresholds trigger governance & safety commitments",
        explanation:
          "Institutions cannot govern vague predictions. By tracking reproducible benchmark jumps, training FLOP thresholds, and autonomous task-length curves across independent evaluators, capability claims are separated from marketing hype.",
        exampleOrMechanism:
          "Audit discipline: our deterministic engine discounts unbacked SOTA adjectives unless accompanied by baseline comparisons, sample sizes, or held-out contamination checks.",
        openQuestion:
          "Which capability evaluations remain informative once frontier models saturate static academic benchmarks?",
      },
    },
  },
  {
    id: "auto-rd",
    topicId: "automating-ai-research",
    index: "II",
    shortTitle: "Automated AI R&D",
    title: "Automating ML Engineering & Scientific Discovery",
    horizonX: 34,
    capY: 118,
    ovY: 112,
    keyMetric: "RE-Bench · MLE-bench · PaperBench replication",
    levels: {
      intuitive: {
        headline: "When AI begins assisting in building the next generation of AI",
        explanation:
          "Designing better AI currently takes thousands of human researchers writing code, running experiments, and debugging failures. Automating AI research measures how much of that scientific loop an AI agent can perform on its own.",
        exampleOrMechanism:
          "Concrete picture: an AI given a research hypothesis writes the training script, runs GPU experiments overnight, reads the error logs, and proposes a cleaner architecture.",
        openQuestion:
          "Can AI agents originate novel scientific paradigms, or mainly optimize within human-designed frameworks?",
      },
      technical: {
        headline: "Closed-loop ML engineering agents under fixed compute budgets",
        explanation:
          "Benchmarks such as RE-Bench, MLE-bench, and PaperBench test whether autonomous coding/research agents can replicate published ML papers from scratch or outperform human engineers on 8-hour kernel and training optimization tasks.",
        exampleOrMechanism:
          "Mechanism: outer-loop harness search (evaluator -> proposer -> verifier) paired with execution trace feedback isolates genuine algorithmic speedups from reward hacking.",
        openQuestion:
          "How do we prevent research agents from exploiting evaluation harness leaks when optimizing validation loss?",
      },
      institutional: {
        headline: "The primary leading indicator for timeline compression",
        explanation:
          "Most frontier safety frameworks (Anthropic ASL, DeepMind Frontier Safety Framework, METR) treat autonomous AI R&D uplift as a critical precursor threshold because internal research acceleration can outpace external regulatory review cycles.",
        exampleOrMechanism:
          "Verification gate: requires multi-seed holdout evaluation and human-baseline uplift studies before crediting 'AI scientist' claims.",
        openQuestion:
          "What internal audit telemetry is necessary inside frontier labs once >50% of R&D throughput is agent-executed?",
      },
    },
  },
  {
    id: "rsi",
    topicId: "recursive-self-improvement",
    index: "III",
    shortTitle: "Recursive Loop",
    title: "Recursive Self-Improvement & Memory",
    horizonX: 54,
    capY: 84,
    ovY: 96,
    keyMetric: "Self-Improvement Memory (M_t) · Sealed Holdout Generalization",
    levels: {
      intuitive: {
        headline: "A feedback loop where smarter systems build even smarter successors",
        explanation:
          "If a system becomes good enough at AI research to improve its own reasoning tools, memory, or training process, each improvement can make the next improvement faster—a compounding cycle known as recursive self-improvement.",
        exampleOrMechanism:
          "Analogy: compound interest applied to problem-solving ability rather than money—powerful if steered wisely, hazardous if small errors compound alongside speed.",
        openQuestion:
          "Do real-world compute, energy, and data bottlenecks naturally dampen software-only feedback loops?",
      },
      technical: {
        headline: "Harness evolution, synthetic curricula & Self-Improvement Memory (M_t)",
        explanation:
          "Modern self-improvement separates frozen-policy outer-loop harness refinement (recording both retained and rejected edits in structured memory M_t) from inner-loop weight updates via verified synthetic trajectories.",
        exampleOrMechanism:
          "Explore this live in our Lab tab: our SIM Outer-Loop Harness tracks H_0 -> H_3 while keeping sealed holdout families strictly outside M_t.",
        openQuestion:
          "Under what conditions does self-generated training data expand capability frontiers rather than collapsing diversity?",
      },
      institutional: {
        headline: "Preventing Goodhart drift across autonomous iteration cycles",
        explanation:
          "Without strict separation between the evolve set and a sealed holdout set, any self-improving loop will eventually game its own proxy metric. Institutional safety demands immutable external verifiers outside the agent's write scope.",
        exampleOrMechanism:
          "Constitutional invariant: selector gates promote H_{t+1} if and only if target failures resolve AND zero regressions occur on sealed holdouts.",
        openQuestion:
          "How do we formally certify goal preservation across multiple generations of self-modified harnesses or weights?",
      },
    },
  },
  {
    id: "alignment",
    topicId: "alignment",
    index: "IV",
    shortTitle: "Alignment & Control",
    title: "Scalable Oversight, Alignment & AI Control",
    horizonX: 70,
    capY: 56,
    ovY: 66,
    keyMetric: "Weak-to-Strong · Debate · Scheming & Control Evals",
    levels: {
      intuitive: {
        headline: "Ensuring systems smarter than us remain honest, helpful, and steerable",
        explanation:
          "It is easy to grade an AI when a human already knows the right answer. The core challenge of superintelligence is 'scalable oversight': how can humans reliably supervise and align a system whose plans are too complex for us to verify unaided?",
        exampleOrMechanism:
          "Intuition: two expert advisors debating a technical flaw in front of a thoughtful judge make hidden mistakes much easier for the judge to spot than reading one dense proposal alone.",
        openQuestion:
          "How do we tell whether an advanced model genuinely shares human constraints or is merely behaving well while observed?",
      },
      technical: {
        headline: "Scalable oversight, deliberative alignment, and adversarial control protocols",
        explanation:
          "Research spans RLHF/Constitutional AI, weak-to-strong generalization, AI debate, and AI Control—testing whether trusted weaker monitors, tripwires, and red-team stress tests catch alignment faking, sandbagging, or reward hacking.",
        exampleOrMechanism:
          "Scope disambiguation: our ontology masks geometric/vision 'image alignment' collocations so only genuine AI safety & value alignment enters this taxonomy.",
        openQuestion:
          "Can weak-to-strong supervision recover full frontier capability on deceptive or non-myopic long-horizon tasks?",
      },
      institutional: {
        headline: "Defense-in-depth safety cases that do not assume perfect alignment",
        explanation:
          "Institutional AI Control treats alignment empirically: labs construct structured safety cases combining behavioral evaluations, untrusted-model monitoring, sandboxing, and formal verification rungs before deployment.",
        exampleOrMechanism:
          "Tracked evidence: empirical scheming evaluations, sleeper-agent persistence studies, monitorability under RL pressure, and formal Lean 4 safety proofs.",
        openQuestion:
          "What evidentiary standard suffices for a high-assurance safety case when chain-of-thought faithfulness degrades?",
      },
    },
  },
  {
    id: "interpretability",
    topicId: "interpretability",
    index: "V",
    shortTitle: "Interpretability",
    title: "Mechanistic Interpretability & Internal Circuits",
    horizonX: 84,
    capY: 40,
    ovY: 42,
    keyMetric: "Sparse Autoencoders · Attribution Graphs · Causal Probes",
    levels: {
      intuitive: {
        headline: "Opening the black box—neuroscience and microscopy for neural networks",
        explanation:
          "Instead of judging an AI only by what it says on the outside, mechanistic interpretability builds microscopes to read its internal concepts and reasoning circuits—catching deception, bias, or confusion before an action is taken.",
        exampleOrMechanism:
          "Landmark example: Anthropic's dictionary learning mapped millions of interpretable internal features inside frontier models—from Golden Gate Bridge concepts to sycophancy and code vulnerabilities.",
        openQuestion:
          "Can internal 'mind-reading' scale fast enough to audit complete multi-step plans in real time?",
      },
      technical: {
        headline: "Overcomplete sparse autoencoders, transcoders & circuit attribution graphs",
        explanation:
          "Because neural activations pack many concepts into superposition, researchers train sparse autoencoders (SAEs) and cross-layer transcoders to decompose polysemantic neurons into monosemantic features and trace causal computation graphs.",
        exampleOrMechanism:
          "Empirical rigor check: causal scrubbing, activation steering interventions, reconstruction variance explained, and feature-splitting ablations.",
        openQuestion:
          "How much dark matter (unexplained reconstruction residual) hides safety-relevant distributed representations?",
      },
      institutional: {
        headline: "White-box auditability for pre-deployment safety verification",
        explanation:
          "Behavioral black-box tests can be gamed by situationally aware models. White-box linear probes and circuit monitors provide an independent physical channel to detect deceptive intent or sandbagging during evaluations.",
        exampleOrMechanism:
          "High-rigor standard: papers reporting causal intervention deltas against random/ablation baselines score in our top credibility band.",
        openQuestion:
          "Can white-box activation monitors become mandatory regulatory instrumentation for frontier training runs?",
      },
    },
  },
  {
    id: "governance",
    topicId: "governance-policy",
    index: "VI",
    shortTitle: "Governance & Proof",
    title: "Frontier Governance, Forecasting & Formal Guarantees",
    horizonX: 95,
    capY: 28,
    ovY: 26,
    keyMetric: "Frontier Safety Frameworks · Compute Governance · Lean 4",
    levels: {
      intuitive: {
        headline: "Shared rules, independent verification, and public accountability",
        explanation:
          "Transformative technologies—like aviation, nuclear energy, and biotechnology—became safe and widely beneficial through transparent standards, independent inspectors, and international treaties. Superintelligence requires the same institutional maturity.",
        exampleOrMechanism:
          "Why this index exists: every story, tag, and score on this site is traceable to open public research feeds with zero opaque social-media noise.",
        openQuestion:
          "How can global institutions coordinate safety standards quickly without stifling open scientific progress?",
      },
      technical: {
        headline: "Hardware-enabled verification, calibrated forecasting & machine-checked proofs",
        explanation:
          "Technical governance bridges policy and engineering: privacy-preserving compute verification, cryptographic model provenance, calibrated probabilistic forecasting (Metaculus/Epoch), and machine-checked safety properties in Lean 4 / Coq.",
        exampleOrMechanism:
          "4-rung formal proof ladder: distinguishes casual mentions of 'formal verification' from actual Lean 4 / Coq / Isabelle machine-checked artifacts.",
        openQuestion:
          "Which safety invariants of neural-symbolic scaffolds can be reduced to small, machine-checkable proof kernels?",
      },
      institutional: {
        headline: "Binding commitments, third-party red-teaming & multi-stakeholder legitimacy",
        explanation:
          "Durable governance combines frontier lab Responsible Scaling Policies, national AI safety institutes, whistleblower protections, incident reporting, and international red-line agreements around autonomous replication and bio/cyber uplift.",
        exampleOrMechanism:
          "Public auditability: open our Method or Queue pages to inspect every filtered-out article and cast community verification verdicts.",
        openQuestion:
          "What treaty and verification architecture keeps race dynamics bounded as frontier capabilities approach ASI?",
      },
    },
  },
];

const LEVEL_META: { id: ReadingLevel; badge: string; label: string; desc: string }[] = [
  {
    id: "intuitive",
    badge: "Level I",
    label: "Public & Intuitive",
    desc: "Clear mental models, everyday analogies & societal stakes",
  },
  {
    id: "technical",
    badge: "Level II",
    label: "Technical Research",
    desc: "Empirical benchmarks, mechanisms, circuits & outer-loop evals",
  },
  {
    id: "institutional",
    badge: "Level III",
    label: "Institutional & Audit",
    desc: "Safety cases, Goodhart resistance, governance & formal invariants",
  },
];

export function InteractiveSiAtlas({
  topicCounts,
  defaultCollapsed = false,
}: {
  topicCounts: TopicCount[];
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mode, setMode] = useState<"atlas" | "emblem">("atlas");
  const [level, setLevel] = useState<ReadingLevel>("intuitive");
  const [activePillarIdx, setActivePillarIdx] = useState<number>(0);

  const pillar = PILLARS[activePillarIdx] ?? PILLARS[0];
  const content = pillar.levels[level];
  const countMap = new Map(topicCounts.map((t) => [t.id, t.count]));
  const matchingCount = countMap.get(pillar.topicId) ?? 0;

  if (collapsed) {
    return (
      <section className="atlas-collapsed-bar" aria-label="Interactive Superintelligence Field Guide">
        <div className="atlas-collapsed-left">
          <BrandEmblem size={24} />
          <span className="mono-kicker">FIG. 01 · INTERACTIVE FIELD GUIDE</span>
          <span className="atlas-collapsed-summary">
            Explore superintelligence across 3 reading levels (Public · Technical · Institutional) &amp; emblem geometry
          </span>
        </div>
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => setCollapsed(false)}
          aria-expanded="false"
        >
          Open interactive guide
        </button>
      </section>
    );
  }

  // Exact cubic Bezier evaluator so every stage anchor sits directly on C(t) and V(t)
  const bezier = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };
  const AXIS_SHORT = ["Scaling", "Auto R&D", "Recursive", "Alignment", "Circuits", "Governance"];
  const stagePoint = (idx: number) => {
    const t = idx / (PILLARS.length - 1);
    return {
      x: Math.round(bezier(84, 220, 368, 534, t) * 10) / 10,
      capY: Math.round(bezier(194, 186, 132, 38, t) * 10) / 10,
      ovY: Math.round(bezier(200, 194, 158, 78, t) * 10) / 10,
    };
  };
  const activePt = stagePoint(activePillarIdx);

  return (
    <section className="atlas-plate" aria-labelledby="atlas-figure-title">
      {/* Top Figure Masthead */}
      <div className="atlas-plate-header">
        <div className="atlas-plate-title-group">
          <div className="atlas-kicker-row">
            <span className="mono-kicker brass-dot">FIGURE 01 · INTERACTIVE RESEARCH PRIMER</span>
            <span className="atlas-divider-dot" aria-hidden="true">·</span>
            <span className="mono-kicker muted">EXPLAINED AT THREE INSTITUTIONAL LEVELS</span>
          </div>
          <h2 id="atlas-figure-title" className="atlas-heading">
            The Architecture of Bounded Superintelligence
          </h2>
        </div>

        <div className="atlas-header-controls">
          <div className="segmented-control" role="tablist" aria-label="Primer view mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "atlas"}
              className={`seg-btn${mode === "atlas" ? " is-active" : ""}`}
              onClick={() => setMode("atlas")}
            >
              6-Pillar Interactive Atlas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "emblem"}
              className={`seg-btn${mode === "emblem" ? " is-active" : ""}`}
              onClick={() => setMode("emblem")}
            >
              Brand Mark
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setCollapsed(true)}
            aria-expanded="true"
            title="Collapse primer to jump straight to feed"
          >
            Minimize
          </button>
        </div>
      </div>

      {mode === "emblem" ? (
        <InteractiveEmblemPlate />
      ) : (
        <>
          {/* Reading Altitude Selector */}
          <div className="altitude-bar" role="radiogroup" aria-label="Explanation depth level">
            <span className="altitude-label">Explanation Lens:</span>
            <div className="altitude-options">
              {LEVEL_META.map((item) => {
                const active = level === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`altitude-card${active ? " is-active" : ""}`}
                    onClick={() => setLevel(item.id)}
                  >
                    <span className="altitude-badge">{item.badge}</span>
                    <span className="altitude-name">{item.label}</span>
                    <span className="altitude-desc">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6-Pillar Interactive Selector Rail */}
          <div className="pillar-rail" role="tablist" aria-label="Six pillars of superintelligence">
            {PILLARS.map((p, idx) => {
              const isSelected = idx === activePillarIdx;
              const cnt = countMap.get(p.topicId) ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`pillar-step${isSelected ? " is-active" : ""}`}
                  onClick={() => setActivePillarIdx(idx)}
                >
                  <span className="pillar-num">{p.index}</span>
                  <span className="pillar-name">{p.shortTitle}</span>
                  <span className="pillar-count">{cnt} papers</span>
                </button>
              );
            })}
          </div>

          {/* Split Anthropic-Style Figure + Annotated Explanation */}
          <div className="atlas-body-grid">
            {/* Left: Interactive SVG Phase Curve + Horizon Scrubber */}
            <div className="atlas-figure-box">
              <div className="figure-box-top">
                <span className="mono-kicker">PHASE DIAGRAM · CAPABILITY C(t) VS. VERIFIABLE OVERSIGHT V(t)</span>
                <span className="figure-metric-tag">{pillar.keyMetric}</span>
              </div>

              <svg
                viewBox="0 0 580 256"
                className="phase-svg"
                role="img"
                aria-label={`Capability and alignment phase diagram highlighting ${pillar.shortTitle} (stage ${pillar.index} of VI)`}
              >
                {/* Horizontal Reference Lines */}
                {[48, 92, 136, 180].map((y, idx) => (
                  <g key={y}>
                    <line
                      x1="64"
                      y1={y}
                      x2="554"
                      y2={y}
                      stroke="var(--border)"
                      strokeDasharray={idx === 1 ? "3 3" : "1 4"}
                    />
                  </g>
                ))}

                {/* Y-axis semantic labels */}
                <text x="56" y="183" textAnchor="end" className="svg-step-label">Narrow</text>
                <text x="56" y="139" textAnchor="end" className="svg-step-label">Frontier</text>
                <text x="56" y="95" textAnchor="end" className="svg-step-label">AGI</text>
                <text x="56" y="51" textAnchor="end" className="svg-step-label">ASI</text>

                {/* Safety Margin Shaded Envelope */}
                <path
                  d="M 84 194 C 220 186, 368 132, 534 38 L 534 78 C 368 158, 220 194, 84 200 Z"
                  fill="var(--brass-soft)"
                />

                {/* Capability Curve (Solid Ink) */}
                <path
                  d="M 84 194 C 220 186, 368 132, 534 38"
                  fill="none"
                  stroke="var(--text)"
                  strokeWidth="2"
                />

                {/* Alignment Verification Envelope (Dashed Brass) */}
                <path
                  d="M 84 200 C 220 194, 368 158, 534 78"
                  fill="none"
                  stroke="var(--brass)"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />

                {/* Active Stage Vertical Cursor */}
                <g>
                  <line
                    x1={activePt.x}
                    y1="30"
                    x2={activePt.x}
                    y2="212"
                    stroke="var(--brass)"
                    strokeWidth="1.25"
                  />
                  <line
                    x1={activePt.x}
                    y1={activePt.capY}
                    x2={activePt.x}
                    y2={activePt.ovY}
                    stroke="var(--status-warn)"
                    strokeWidth="2.5"
                  />
                  <circle cx={activePt.x} cy={activePt.capY} r="4.5" fill="var(--text)" />
                  <circle cx={activePt.x} cy={activePt.ovY} r="4.5" fill="var(--brass)" />
                </g>

                {/* 6 Interactive Pillar Anchors Along the Trajectory */}
                {PILLARS.map((p, idx) => {
                  const pt = stagePoint(idx);
                  const active = idx === activePillarIdx;
                  return (
                    <g
                      key={p.id}
                      onClick={() => setActivePillarIdx(idx)}
                      className="svg-interactive-node"
                    >
                      {active && (
                        <circle
                          cx={pt.x}
                          cy={pt.capY}
                          r="11"
                          fill="var(--brass-soft)"
                          stroke="var(--brass)"
                          strokeWidth="1.2"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.capY}
                        r={active ? "5" : "3.5"}
                        fill={active ? "var(--brass)" : "var(--surface)"}
                        stroke={active ? "var(--brass)" : "var(--text-secondary)"}
                        strokeWidth="1.5"
                      />
                      <text
                        x={pt.x}
                        y="232"
                        textAnchor="middle"
                        className={`svg-axis-label${active ? " active" : ""}`}
                      >
                        {p.index}
                      </text>
                      <text
                        x={pt.x}
                        y="246"
                        textAnchor="middle"
                        className={`svg-step-label${active ? " active" : ""}`}
                      >
                        {AXIS_SHORT[idx] ?? p.index}
                      </text>
                    </g>
                  );
                })}

                {/* Curve Legend inside SVG */}
                <g>
                  <line x1="72" y1="22" x2="90" y2="22" stroke="var(--text)" strokeWidth="2" />
                  <text x="96" y="25" textAnchor="start" className="svg-legend-label">
                    Capability C(t)
                  </text>
                  <line
                    x1="210"
                    y1="22"
                    x2="228"
                    y2="22"
                    stroke="var(--brass)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <text x="234" y="25" textAnchor="start" className="svg-legend-label">
                    Verifiable oversight V(t)
                  </text>
                </g>
              </svg>

              <div className="scrubber-row">
                <label htmlFor="pillar-scrubber" className="mono-kicker">
                  Scrub Stage ({pillar.index} / VI):
                </label>
                <input
                  id="pillar-scrubber"
                  type="range"
                  min={0}
                  max={PILLARS.length - 1}
                  step={1}
                  value={activePillarIdx}
                  onChange={(e) => setActivePillarIdx(Number(e.target.value))}
                  className="atlas-range"
                />
              </div>
            </div>

            {/* Right: 3-Level Annotated Manuscript Card */}
            <div className="atlas-reading-card">
              <div className="reading-card-kicker">
                <span className="pillar-badge-pill">Pillar {pillar.index} · {pillar.title}</span>
                <span className="mono-kicker muted">
                  {LEVEL_META.find((l) => l.id === level)?.badge} — {LEVEL_META.find((l) => l.id === level)?.label}
                </span>
              </div>

              <h3 className="reading-card-headline">{content.headline}</h3>
              <p className="reading-card-body">{content.explanation}</p>

              <div className="reading-callout">
                <span className="mono-kicker">
                  {level === "intuitive"
                    ? "MENTAL MODEL & INTUITION"
                    : level === "technical"
                      ? "EMPIRICAL MECHANISM & BENCHMARKS"
                      : "INSTITUTIONAL & AUDIT INVARIANT"}
                </span>
                <p>{content.exampleOrMechanism}</p>
              </div>

              <div className="reading-question-row">
                <span className="mono-kicker">OPEN FRONTIER QUESTION</span>
                <p>{content.openQuestion}</p>
              </div>

              <div className="reading-card-footer">
                <Link
                  href={`/?topic=${encodeURIComponent(pillar.topicId)}`}
                  className="btn-primary btn-small"
                >
                  Filter feed to {pillar.shortTitle} ({matchingCount}) →
                </Link>
                <Link href="/analysis?tab=live-inspector" className="btn-secondary btn-small">
                  Test a paper in Live Rigor Lab
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
