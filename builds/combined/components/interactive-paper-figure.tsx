"use client";

import { useMemo, useState } from "react";
import {
  analyzeStory,
  computeBestStoryScore,
  deterministicScoreFromSignals,
} from "@/lib/analysis";
import { tagText } from "@/lib/ontology";
import { SOURCE_KINDS, type SourceKind } from "@/lib/schemas";

type HighlightSpan = {
  start: number;
  end: number;
  kind: "ontology" | "rigor" | "negated" | "hype";
  label: string;
  key: string;
};

const PERTURBATION_EXPERIMENTS: {
  id: string;
  label: string;
  description: string;
  apply: (cur: { title: string; summary: string; url: string; kind: SourceKind; sources: number }) => {
    title: string;
    summary: string;
    url: string;
    kind: SourceKind;
    sources: number;
  };
}[] = [
  {
    id: "add-ci",
    label: "+ Multi-seed 95% CI & OOD",
    description: "Appends uncertainty intervals and held-out OOD transfer metrics",
    apply: (cur) => ({
      ...cur,
      summary: `${cur.summary.replace(/\s+$/, "")} Across 5 random seeds on n = 1,200 held-out OOD tasks, oversight accuracy improves by 18.4% ± 1.2% (95% CI, p < 0.01) compared to the untrusted baseline, with code and weights at https://github.com/safety-evals/oversight-suite.`,
    }),
  },
  {
    id: "negate-baseline",
    label: "+ Test negation (“without baseline”)",
    description: "Demonstrates clause-level negation blocking false rigor points",
    apply: (cur) => ({
      ...cur,
      summary:
        "We discuss alignment and scalable oversight qualitatively without a baseline comparison, without confidence intervals, and never evaluate on held-out tasks.",
    }),
  },
  {
    id: "add-lean4",
    label: "+ Machine-checked Lean 4 proof",
    description: "Triggers the 4-rung formal verification ladder",
    apply: (cur) => ({
      ...cur,
      summary: `${cur.summary.replace(/\s+$/, "")} Core monitor soundness theorems are formalized and machine-checked in Lean 4 with zero sorry axioms.`,
    }),
  },
  {
    id: "inject-hype",
    label: "+ Sweeping hype / Goodhart trap",
    description: "Tests anti-hype discount and adversarial prompt-injection cap",
    apply: (cur) => ({
      ...cur,
      summary: `${cur.summary.replace(/\s+$/, "")} This revolutionary paradigm shift definitively solves AGI alignment forever and guarantees 100% safety across all possible tasks without limitation.`,
    }),
  },
  {
    id: "cv-trap",
    label: "Test CV “image alignment” false-positive trap",
    description: "Proves non-safety modality alignment is masked and rejected ($0 LLM cost)",
    apply: () => ({
      title: "Deformable Patch Alignment for 3D Retinal OCT Medical Segmentation",
      summary:
        "We propose a stereo feature alignment module for medical segmentation across 400 clinical scans, improving Dice score by 3.1% over UNet baselines.",
      url: "https://arxiv.org/abs/2604.09999",
      kind: "papers",
      sources: 1,
    }),
  },
];

function collectHighlights(
  text: string,
  opts: {
    ontologyTerms: { term: string; topicLabel: string }[];
    rigorSnippets: { id: string; label: string; snippet: string }[];
    negatedSnippets: { label: string; snippet: string }[];
    hypeWords: string[];
  },
): HighlightSpan[] {
  const raw: HighlightSpan[] = [];
  const lower = text.toLowerCase();

  const addMatches = (needle: string, kind: HighlightSpan["kind"], label: string, key: string) => {
    const clean = needle.trim().replace(/^\.\.\.|\.\.\.$/g, "").trim();
    if (clean.length < 2) return;
    const target = clean.toLowerCase();
    let idx = lower.indexOf(target);
    while (idx !== -1) {
      raw.push({ start: idx, end: idx + target.length, kind, label, key });
      idx = lower.indexOf(target, idx + target.length);
    }
  };

  for (const neg of opts.negatedSnippets) {
    if (neg.snippet) addMatches(neg.snippet, "negated", `Blocked negation: ${neg.label}`, `neg:${neg.label}`);
  }
  for (const rig of opts.rigorSnippets) {
    if (rig.snippet) addMatches(rig.snippet, "rigor", `Rigor: ${rig.label}`, `rig:${rig.id}`);
  }
  for (const ont of opts.ontologyTerms) {
    addMatches(ont.term, "ontology", `Ontology: ${ont.topicLabel}`, `ont:${ont.term.toLowerCase()}`);
  }
  for (const hw of opts.hypeWords) {
    addMatches(hw, "hype", `Hype signal: "${hw}"`, `hype:${hw.toLowerCase()}`);
  }

  // Priority order when overlapping: negated > rigor > hype > ontology, then longer span wins
  const priority: Record<HighlightSpan["kind"], number> = {
    negated: 4,
    rigor: 3,
    hype: 2,
    ontology: 1,
  };

  raw.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (priority[b.kind] !== priority[a.kind]) return priority[b.kind] - priority[a.kind];
    return b.end - b.start - (a.end - a.start);
  });

  const resolved: HighlightSpan[] = [];
  let cursor = 0;
  for (const span of raw) {
    if (span.start >= cursor) {
      resolved.push(span);
      cursor = span.end;
    }
  }
  return resolved;
}

function AnnotatedPassage({
  text,
  spans,
  focusedKey,
  onFocusKey,
}: {
  text: string;
  spans: HighlightSpan[];
  focusedKey: string | null;
  onFocusKey: (k: string | null) => void;
}) {
  if (!text) return <span className="muted">No abstract text provided.</span>;
  if (spans.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach((span, idx) => {
    if (span.start > pos) {
      nodes.push(<span key={`t-${idx}`}>{text.slice(pos, span.start)}</span>);
    }
    const isFocused = focusedKey === span.key;
    nodes.push(
      <mark
        key={`m-${idx}`}
        className={`ms-mark ms-${span.kind}${isFocused ? " is-focused" : ""}`}
        title={span.label}
        onMouseEnter={() => onFocusKey(span.key)}
        onMouseLeave={() => onFocusKey(null)}
        onClick={() => onFocusKey(isFocused ? null : span.key)}
      >
        {text.slice(span.start, span.end)}
      </mark>,
    );
    pos = span.end;
  });
  if (pos < text.length) {
    nodes.push(<span key="t-end">{text.slice(pos)}</span>);
  }
  return <>{nodes}</>;
}

export function InteractivePaperFigure({
  initialTitle,
  initialSummary,
  initialUrl,
  initialKind,
  initialSources,
  editable = true,
}: {
  initialTitle: string;
  initialSummary: string;
  initialUrl: string;
  initialKind: SourceKind;
  initialSources: number;
  editable?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [url, setUrl] = useState(initialUrl);
  const [kind, setKind] = useState<SourceKind>(initialKind);
  const [sources, setSources] = useState<number>(initialSources);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Sync if server-provided example changes via URL navigation
  const propSignature = `${initialTitle}::${initialSummary}::${initialUrl}::${initialKind}::${initialSources}`;
  const [lastPropSig, setLastPropSig] = useState(propSignature);
  if (propSignature !== lastPropSig) {
    setLastPropSig(propSignature);
    setTitle(initialTitle);
    setSummary(initialSummary);
    setUrl(initialUrl);
    setKind(initialKind);
    setSources(initialSources);
    setFocusedKey(null);
  }

  const evaluation = useMemo(() => {
    const tag = tagText(title, summary);
    const analysis = analyzeStory({
      title,
      summary,
      url,
      topics: tag.topics,
      sourceKinds: [kind],
      sourceCount: sources,
    });
    const calibrated10 = deterministicScoreFromSignals({
      significanceScore: analysis.significanceScore,
      rigorScore: analysis.rigorScore,
      hypeScore: analysis.hypeScore,
      inScope: tag.inScope,
      promptInjection: analysis.paperRigor.promptInjection.fired,
    });
    const best100 = computeBestStoryScore({
      aiScore: calibrated10,
      significanceScore: analysis.significanceScore,
      rigorScore: analysis.rigorScore,
      hypeScore: analysis.hypeScore,
      sourceCount: sources,
    });

    const ontologyTerms: { term: string; topicLabel: string }[] = [];
    for (const t of tag.topics) {
      for (const m of t.matched) {
        ontologyTerms.push({ term: m, topicLabel: t.label });
      }
    }

    const highlightOpts = {
      ontologyTerms,
      rigorSnippets: analysis.paperRigor.presentMarkers,
      negatedSnippets: analysis.paperRigor.negatedMarkers,
      hypeWords: analysis.paperRigor.hypeWords,
    };

    return {
      tag,
      analysis,
      calibrated10,
      best100,
      titleSpans: collectHighlights(title, highlightOpts),
      summarySpans: collectHighlights(summary, highlightOpts),
    };
  }, [title, summary, url, kind, sources]);

  const { tag, analysis, calibrated10, best100, titleSpans, summarySpans } = evaluation;

  return (
    <div className="paper-figure-shell">
      {/* Top Figure Header & Perturbation Bar */}
      <div className="paper-figure-topbar">
        <div>
          <span className="mono-kicker brass-dot">
            INTERACTIVE FEATURE ATTRIBUTION · DETERMINISTIC ENGINE (ZERO LLM LATENCY)
          </span>
          <p className="paper-figure-sub">
            Hover or click highlighted spans in the manuscript—or trigger a counterfactual perturbation below—to watch scope disambiguation, clause negation, and score calibration respond in real time.
          </p>
        </div>

        {editable && (
          <div className="paper-figure-actions">
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => setShowEditor((v) => !v)}
            >
              {showEditor ? "Close raw text editor" : "Edit title & abstract live"}
            </button>
            {(title !== initialTitle || summary !== initialSummary || kind !== initialKind || sources !== initialSources) && (
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => {
                  setTitle(initialTitle);
                  setSummary(initialSummary);
                  setUrl(initialUrl);
                  setKind(initialKind);
                  setSources(initialSources);
                  setFocusedKey(null);
                }}
              >
                Reset text
              </button>
            )}
          </div>
        )}
      </div>

      {/* 1-Click Counterfactual Perturbation Chips */}
      {editable && (
        <div className="perturbation-bar" role="group" aria-label="Counterfactual text perturbations">
          <span className="mono-kicker">Perturbations:</span>
          {PERTURBATION_EXPERIMENTS.map((exp) => (
            <button
              key={exp.id}
              type="button"
              className="perturb-chip"
              title={exp.description}
              onClick={() => {
                const next = exp.apply({ title, summary, url, kind, sources });
                setTitle(next.title);
                setSummary(next.summary);
                setUrl(next.url);
                setKind(next.kind);
                setSources(next.sources);
              }}
            >
              {exp.label}
            </button>
          ))}
        </div>
      )}

      {/* Optional Live Instant Editor + Permalink Form */}
      {editable && showEditor && (
        <form method="get" action="/analysis" className="live-inline-editor">
          <input type="hidden" name="tab" value="live-inspector" />
          <div className="primary-controls-grid">
            <label className="control-field search-field">
              <span className="field-caption">Title (updates attributions as you type)</span>
              <input
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
              />
            </label>
            <label className="control-field">
              <span className="field-caption">Source Kind</span>
              <select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as SourceKind)}
              >
                {SOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="control-field control-field-narrow">
              <span className="field-caption">Corroborating Feeds</span>
              <input
                type="number"
                name="sources"
                min={1}
                max={10}
                value={sources}
                onChange={(e) => setSources(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              />
            </label>
          </div>

          <label className="control-field slot-mt-sm">
            <span className="field-caption">Abstract / Passage</span>
            <textarea
              name="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={1500}
            />
          </label>

          <div className="editor-permalink-row">
            <input type="hidden" name="url" value={url} />
            <span className="field-hint">
              Scores &amp; highlights update instantaneously above; submit to lock into shareable URL query parameters.
            </span>
            <button type="submit" className="btn-primary btn-small">
              Sync to Permalink URL
            </button>
          </div>
        </form>
      )}

      {/* Color Legend */}
      <div className="attribution-legend" aria-label="Highlight color key">
        <span className="legend-item">
          <span className="legend-swatch ontology" /> Ontology anchor
        </span>
        <span className="legend-item">
          <span className="legend-swatch rigor" /> Empirical rigor evidence
        </span>
        <span className="legend-item">
          <span className="legend-swatch negated" /> Blocked negated clause
        </span>
        <span className="legend-item">
          <span className="legend-swatch hype" /> Hype / unbacked claim
        </span>
      </div>

      {/* Main Split: Annotated Manuscript (Left) + Quantitative Margin Ledger (Right) */}
      <div className="manuscript-split">
        <div className="manuscript-sheet">
          <div className="manuscript-scope-banner" data-in-scope={tag.inScope ? "true" : "false"}>
            <span className="scope-pill">{tag.inScope ? "✓ IN SCOPE" : "✕ REJECTED OUT OF SCOPE"}</span>
            <span className="scope-reason-inline">{tag.scopeReason}</span>
          </div>

          <h3 className="manuscript-title">
            <AnnotatedPassage
              text={title}
              spans={titleSpans}
              focusedKey={focusedKey}
              onFocusKey={setFocusedKey}
            />
          </h3>

          <p className="manuscript-abstract">
            <AnnotatedPassage
              text={summary}
              spans={summarySpans}
              focusedKey={focusedKey}
              onFocusKey={setFocusedKey}
            />
          </p>

          <div className="manuscript-meta-footer">
            <span>Artifact class: <strong>{analysis.paperRigor.paperKind.label}</strong></span>
            <span>·</span>
            <span>Credibility band: <strong>{analysis.paperRigor.credibilityBand}</strong></span>
            <span>·</span>
            <span>Formal proof: <strong>{analysis.paperRigor.formalProof.label}</strong></span>
          </div>
        </div>

        {/* Margin Telemetry & Interactive Attribution Rail */}
        <aside className="manuscript-margin" aria-label="Live score decomposition and attribution margin">
          <div className="margin-score-grid">
            <div className="margin-stat">
              <span className="mono-kicker">Tier-0 Rating</span>
              <strong className="margin-stat-val">
                {tag.inScope ? `${calibrated10.toFixed(1)}` : "2.4"}
                <small>/10</small>
              </strong>
            </div>
            <div className="margin-stat">
              <span className="mono-kicker">Significance</span>
              <strong className="margin-stat-val">
                {analysis.significanceScore}
                <small>/100</small>
              </strong>
            </div>
            <div className="margin-stat">
              <span className="mono-kicker">Empirical Rigor</span>
              <strong className="margin-stat-val">
                {analysis.rigorScore}
                <small>/100</small>
              </strong>
            </div>
            <div className="margin-stat">
              <span className="mono-kicker">Best Composite</span>
              <strong className="margin-stat-val">
                {best100}
                <small>/100</small>
              </strong>
            </div>
          </div>

          {/* Interactive Marker Attribution Buttons */}
          <div className="margin-block">
            <div className="audit-col-head">
              <span className="mono-kicker">EMPIRICAL MARKERS ({analysis.paperRigor.presentMarkers.length}/8)</span>
            </div>
            {analysis.paperRigor.presentMarkers.length === 0 ? (
              <p className="margin-empty">No empirical markers active in passage.</p>
            ) : (
              <ul className="margin-chip-list">
                {analysis.paperRigor.presentMarkers.map((m) => {
                  const k = `rig:${m.id}`;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={`margin-attr-btn rigor${focusedKey === k ? " is-focused" : ""}`}
                        onMouseEnter={() => setFocusedKey(k)}
                        onMouseLeave={() => setFocusedKey(null)}
                        onClick={() => setFocusedKey(focusedKey === k ? null : k)}
                      >
                        <span>{m.label}</span>
                        <strong className="mono-num">+{m.points}</strong>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {analysis.paperRigor.negatedMarkers.length > 0 && (
              <div className="margin-negated-box">
                <span className="mono-kicker clay-text">CLAUSE NEGATION GUARD BLOCKED:</span>
                {analysis.paperRigor.negatedMarkers.map((n) => {
                  const k = `neg:${n.label}`;
                  return (
                    <button
                      key={n.label}
                      type="button"
                      className={`margin-attr-btn negated${focusedKey === k ? " is-focused" : ""}`}
                      onMouseEnter={() => setFocusedKey(k)}
                      onMouseLeave={() => setFocusedKey(null)}
                    >
                      <span>✕ {n.label}</span>
                      <span className="mono-num">0 pts</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ontology Lineage */}
          <div className="margin-block">
            <div className="audit-col-head">
              <span className="mono-kicker">ONTOLOGY LINEAGE ({tag.topics.length})</span>
            </div>
            {tag.topics.length === 0 ? (
              <p className="margin-empty">Zero in-scope superintelligence topics matched.</p>
            ) : (
              <ul className="margin-chip-list">
                {tag.topics.map((t) => {
                  const firstTerm = t.matched[0]?.toLowerCase() ?? "";
                  const k = `ont:${firstTerm}`;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`margin-attr-btn ontology${focusedKey === k ? " is-focused" : ""}`}
                        onMouseEnter={() => firstTerm && setFocusedKey(k)}
                        onMouseLeave={() => setFocusedKey(null)}
                      >
                        <span>{t.label}</span>
                        <span className="mono-num">{t.isRoot ? "Root" : "Child"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Point-by-Point Waterfall */}
          <div className="margin-block">
            <div className="audit-col-head">
              <span className="mono-kicker">SIGNIFICANCE LEDGER</span>
            </div>
            <ul className="waterfall-list compact">
              {analysis.why.map((w) => (
                <li key={w.factor} className="waterfall-row">
                  <div className="waterfall-meta">
                    <span>{w.factor}</span>
                    <span className={`mono-num${w.points < 0 ? " clay-text" : ""}`}>
                      {w.points > 0 ? `+${w.points}` : w.points}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
