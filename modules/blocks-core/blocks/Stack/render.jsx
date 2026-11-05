import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props, children }) => (
      <div className={cx("jr-stack", props.direction === "horizontal" && "row", `gap-${props.gap || "md"}`, props.wrap && "wrap")}>{children}</div>
    );
