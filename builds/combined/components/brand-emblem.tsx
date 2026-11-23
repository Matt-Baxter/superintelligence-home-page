"use client";

import { useState } from "react";
import { EMBLEM_LAYERS } from "@/lib/theme";

/**
 * The Bounded Asymptote Colophon (`viewBox="0 0 32 32"`):
 * 01. Containment Seal (`containment-ring`) — Lamé superellipse architectural frame
 * 02. Bounded Asymptote (`alignment-horizon`) — horizontal verification ceiling + logistic S-curve converging cleanly beneath it
 * 03. Equilibrium Beacon (`zenith-point`) — burnished brass focal node anchoring the horizon datum
 * Consumes exclusively slotted CSS tokens (`currentColor` -> `--text` / `--aui-ink`, `var(--brass)` -> `--aui-accent`).
 */
export function BrandEmblem({
  size = 24,
  activeLayer = null,
  className = "",
}: {
  size?: number;
  activeLayer?: string | null;
  className?: string;
}) {
  const layerClass = (id: string) =>
    `emblem-layer-group${activeLayer && activeLayer !== id ? " is-dimmed" : ""}`;
  const highlight = (id: string) => activeLayer === id;

  const isCompact = size <= 28;
  const frameWeight = isCompact ? 1.95 : 1.6;
  const curveWeight = isCompact ? 2.05 : 1.75;
  const datumWeight = isCompact ? 1.4 : 1.2;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`brand-emblem-svg ${className}`.trim()}
    >
      {/* 01 · Lamé Superellipse Containment Seal */}
      <g className={layerClass("containment-ring")}>
        <path
          d="M16 3C24.8 3 29 7.2 29 16C29 24.8 24.8 29 16 29C7.2 29 3 24.8 3 16C3 7.2 7.2 3 16 3Z"
          stroke={highlight("containment-ring") ? "var(--brass)" : "currentColor"}
          strokeWidth={highlight("containment-ring") ? frameWeight + 0.35 : frameWeight}
        />
      </g>

      {/* 02 · Bounded Horizon Ceiling + Logistic S-Trajectory + Phase Baseline */}
      <g className={layerClass("alignment-horizon")}>
        <path
          d="M8.2 22.4H24.2"
          stroke={highlight("alignment-horizon") ? "var(--brass)" : "currentColor"}
          strokeOpacity={highlight("alignment-horizon") ? 0.65 : 0.28}
          strokeWidth={datumWeight}
          strokeLinecap="round"
        />
        <path
          d="M8.2 10.5H19.4"
          stroke={highlight("alignment-horizon") ? "var(--brass)" : "currentColor"}
          strokeWidth={highlight("alignment-horizon") ? curveWeight + 0.3 : curveWeight}
          strokeLinecap="round"
        />
        <path
          d="M8.2 22.4C13.8 22.4 14.8 14.8 24.2 14.8"
          stroke={highlight("alignment-horizon") ? "var(--brass)" : "currentColor"}
          strokeWidth={highlight("alignment-horizon") ? curveWeight + 0.3 : curveWeight}
          strokeLinecap="round"
        />
      </g>

      {/* 03 · Burnished Brass Equilibrium Beacon on the Horizon */}
      <g className={layerClass("zenith-point")}>
        <circle
          cx="23.2"
          cy="10.5"
          r={highlight("zenith-point") ? 2.55 : isCompact ? 2.2 : 2.05}
          fill="var(--brass)"
        />
      </g>
    </svg>
  );
}

/**
 * Architectural Colophon Specimen — demonstrates optical scaling from 16px seal to 116px plate
 * and isolates each of the 3 structural layers without nested card clutter.
 */
export function EmblemAnatomyExplorer() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  return (
    <div className="emblem-anatomy-grid">
      <div className="emblem-stage" onMouseLeave={() => setActiveLayer(null)}>
        <div className="emblem-drafting-frame">
          <BrandEmblem size={112} activeLayer={activeLayer} />
        </div>

        <div className="emblem-scale-row" aria-label="Optical scale specimens">
          <span className="emblem-scale-item">
            <BrandEmblem size={16} activeLayer={activeLayer} />
            <span className="mono">16px</span>
          </span>
          <span className="emblem-scale-item">
            <BrandEmblem size={24} activeLayer={activeLayer} />
            <span className="mono">24px</span>
          </span>
          <span className="emblem-scale-item">
            <BrandEmblem size={36} activeLayer={activeLayer} />
            <span className="mono">36px</span>
          </span>
        </div>

        <p className="emblem-stage-caption">
          Optical colophon · Select a structural layer to inspect its geometry
        </p>
      </div>

      <div className="emblem-layers-list" role="list">
        {EMBLEM_LAYERS.map((layer) => {
          const isSelected = activeLayer === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              role="listitem"
              className={`emblem-layer-card${isSelected ? " active" : ""}`}
              onMouseEnter={() => setActiveLayer(layer.id)}
              onFocus={() => setActiveLayer(layer.id)}
              onClick={() => setActiveLayer((prev) => (prev === layer.id ? null : layer.id))}
              aria-pressed={isSelected}
            >
              <div className="emblem-layer-head">
                <span className="emblem-layer-idx">{layer.index}</span>
                <span className="emblem-layer-geom">{layer.geometry}</span>
              </div>
              <div className="emblem-layer-title">{layer.name}</div>
              <p className="emblem-layer-desc">{layer.meaning}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const InteractiveEmblemPlate = EmblemAnatomyExplorer;
