import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => <span className={cx("jr-badge", `tone-${props.tone || "neutral"}`)}>{props.text}</span>;
