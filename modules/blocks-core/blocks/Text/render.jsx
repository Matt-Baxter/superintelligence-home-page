import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => <p className={cx(props.tone === "muted" && "muted", props.size === "sm" && "small")}>{props.text}</p>;
