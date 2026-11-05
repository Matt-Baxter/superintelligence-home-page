import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => (props.level === "3" ? <h3>{props.text}</h3> : <h2>{props.text}</h2>);
