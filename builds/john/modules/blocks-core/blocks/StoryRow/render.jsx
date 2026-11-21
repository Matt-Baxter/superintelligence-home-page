import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props, emit }) => (
      <div className="jr-story">
        <a className="t" href={props.url} target="_blank" rel="noopener noreferrer">{props.title}</a>
        <div className="m">
          <span>{props.meta}</span>
          {props.sources > 1 && <span className="jr-badge tone-accent">{props.sources} sources</span>}
          {props.topics.map((t, i) => <span key={i} className="jr-badge">{t}</span>)}
          <span>▲ {props.votes}</span>
          <button type="button" className="linkish" onClick={() => emit("open")}>Discuss</button>
        </div>
      </div>
    );
