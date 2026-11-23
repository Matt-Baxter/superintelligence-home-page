import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => (
      <ol className="jr-bars">
        {props.items.map((it, i) => (
          <li key={i} className={it.highlight ? "hl" : ""}>
            <div className="top"><span className="lbl">{it.label}</span><span className="num">{it.display}</span></div>
            <div className="track"><i style={{ width: `${Math.max(0, Math.min(100, (100 * it.value) / (it.max || 1)))}%` }} /></div>
            {it.hint && <span className="hint">{it.hint}</span>}
          </li>
        ))}
      </ol>
    );
