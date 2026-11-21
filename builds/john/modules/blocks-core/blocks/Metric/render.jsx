import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => (
      <div className={cx("jr-metric", props.tone && `tone-${props.tone}`)}>
        <span className="label">{props.label}</span>
        <span className="value">{props.value}</span>
        {props.hint && <span className="hint">{props.hint}</span>}
      </div>
    );
