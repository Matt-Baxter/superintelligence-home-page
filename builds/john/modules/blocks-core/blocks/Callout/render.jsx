import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => (
      <div className={cx("jr-callout", `tone-${props.tone}`)} role="note">
        <strong>{props.title}</strong>{props.text && <p>{props.text}</p>}
      </div>
    );
