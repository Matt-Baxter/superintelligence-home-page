import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props, children }) => (
      <section className={cx("jr-card", props.tone && `tone-${props.tone}`)}>
        {(props.title || props.subtitle) && (
          <header>{props.title && <h3>{props.title}</h3>}{props.subtitle && <p className="muted">{props.subtitle}</p>}</header>
        )}
        <div className="jr-stack gap-sm">{children}</div>
      </section>
    );
