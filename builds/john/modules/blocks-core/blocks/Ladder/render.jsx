import React from "react";

export default ({ props }) => (
  <div className="jr-ladder">
    {props.label ? <p className="jr-ladder-label">{props.label}</p> : null}
    <div className="jr-ladder-steps" role="img" aria-label={`${props.label ? props.label + ": " : ""}${props.value}`}>
      {props.levels.map((l) => <span key={l} className={l === props.value ? "on" : ""}>{l}</span>)}
    </div>
    {props.hint ? <p className="jr-ladder-hint">{props.hint}</p> : null}
  </div>
);
