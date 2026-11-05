import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props, emit }) => (
      <button type="button" className={cx("btn", props.variant === "primary" && "primary")} onClick={() => emit("press")}>{props.label}</button>
    );
