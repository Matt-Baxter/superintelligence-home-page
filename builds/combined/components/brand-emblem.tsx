"use client";

import { useState } from "react";
import { EMBLEM_LAYERS } from "@/lib/theme";

/**
 * Symmetrical 3-primitive Euclidean Bounded Intelligence Mark:
 * 01. Containment Ring — outer circular governance boundary
 * 02. Verification Frame — inscribed 45° four-axis diamond ("squaring the circle")
 * 03. Aligned Core — poised central brass focal point
 * Purely consumes slotted CSS tokens (`currentColor` -> `--text` / `--aui-ink`, `var(--brass)` -> `--aui-accent`).
 */
export function BrandEmblem({
  size = 26,
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
  const ringStroke = size <= 28 ? 1.75 : 1.55;
  const frameStroke = size <= 28 ? 1.5 : 1.35;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`brand-emblem-svg ${className}`.trim()}
    >
      <g className={layerClass("containment-ring")}>
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke={highlight("containment-ring") ? "var(--brass)" : "currentColor"}
          strokeWidth={highlight("containment-ring") ? ringStroke + 0.3 : ringStroke}
        />
      </g>

      <g className={layerClass("alignment-horizon")}>
        <path
          d="M 12 5 L 19 12 L 12 19 L 5 12 Z"
          stroke={highlight("alignment-horizon") ? "var(--brass)" : "currentColor"}
          strokeWidth={highlight("alignment-horizon") ? frameStroke + 0.3 : frameStroke}
          strokeLinejoin="round"
        />
      </g>

      <g className={layerClass("zenith-point")}>
        <circle
          cx="12"
          cy="12"
          r={highlight("zenith-point") ? 2.4 : 2.05}
          fill="var(--brass)"
        />
      </g>
    </svg>
  );
}

/**
 * Interactive Brand Mark Plate — isolates each of the 3 Euclidean primitives.
 */
export function EmblemAnatomyExplorer() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  return (
    <div className="emblem-anatomy-grid">
      <div className="emblem-stage" onMouseLeave={() => setActiveLayer(null)}>
        <div className="emblem-medallion">
          <BrandEmblem size={132} activeLayer={activeLayer} />
        </div>
        <p className="emblem-stage-caption">
          Three-primitive Euclidean mark · Hover or select a layer to isolate
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
              onClick={() => setActiveLayer((prev) => (prev) === layer.id ? null : layer.id)}
              aria-pressed={isSelected}
            >
              <div className="emblem-layer-head">
                <span className="mono-kicker">{layer.index}</span>
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
