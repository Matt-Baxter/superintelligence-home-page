import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props, children }) => <div className="jr-grid" style={{ "--cols": props.columns }}>{children}</div>;
