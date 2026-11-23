import React from "react";

export default ({ props }) => (
  <section className={`jr-verdict tone-${props.tone || "neutral"}`}>
    <span className="k">{props.title} · judged by {props.judge}{props.method === "external" ? " (external model)" : ""}</span>
    <strong className="rec">{props.recommendation}</strong>
    <p>{props.reason}</p>
    {props.agreement && <p className="agree">{props.agreement}</p>}
    {props.warnings?.length > 0 && <ul className="warn">{props.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    <p className="sign">Both partners sign off or override, then log the decision in docs/CONTRACT.md.</p>
  </section>
);
