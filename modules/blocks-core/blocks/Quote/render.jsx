import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => <blockquote className="jr-quote"><p>{props.text}</p>{props.source && <cite>{props.source}</cite>}</blockquote>;
