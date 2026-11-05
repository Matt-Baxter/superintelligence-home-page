// Browser bundle: maps each catalog component to React and exposes window.JR.render(el, spec, handlers).
import React from "react";
import { createRoot } from "react-dom/client";
import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react";
import { catalog } from "../views/catalog.mjs";

const cx = (...c) => c.filter(Boolean).join(" ");

const { registry } = defineRegistry(catalog, {
  components: {
    Stack: ({ props, children }) => (
      <div className={cx("jr-stack", props.direction === "horizontal" && "row", `gap-${props.gap || "md"}`, props.wrap && "wrap")}>{children}</div>
    ),
    Grid: ({ props, children }) => <div className="jr-grid" style={{ "--cols": props.columns }}>{children}</div>,
    Card: ({ props, children }) => (
      <section className={cx("jr-card", props.tone && `tone-${props.tone}`)}>
        {(props.title || props.subtitle) && (
          <header>{props.title && <h3>{props.title}</h3>}{props.subtitle && <p className="muted">{props.subtitle}</p>}</header>
        )}
        <div className="jr-stack gap-sm">{children}</div>
      </section>
    ),
    Heading: ({ props }) => (props.level === "3" ? <h3>{props.text}</h3> : <h2>{props.text}</h2>),
    Text: ({ props }) => <p className={cx(props.tone === "muted" && "muted", props.size === "sm" && "small")}>{props.text}</p>,
    Metric: ({ props }) => (
      <div className={cx("jr-metric", props.tone && `tone-${props.tone}`)}>
        <span className="label">{props.label}</span>
        <span className="value">{props.value}</span>
        {props.hint && <span className="hint">{props.hint}</span>}
      </div>
    ),
    Badge: ({ props }) => <span className={cx("jr-badge", `tone-${props.tone || "neutral"}`)}>{props.text}</span>,
    BarList: ({ props }) => (
      <ol className="jr-bars">
        {props.items.map((it, i) => (
          <li key={i} className={it.highlight ? "hl" : ""}>
            <div className="top"><span className="lbl">{it.label}</span><span className="num">{it.display}</span></div>
            <div className="track"><i style={{ width: `${Math.max(0, Math.min(100, (100 * it.value) / (it.max || 1)))}%` }} /></div>
            {it.hint && <span className="hint">{it.hint}</span>}
          </li>
        ))}
      </ol>
    ),
    Table: ({ props }) => (
      <div className="jr-table">
        <table>
          {props.caption && <caption>{props.caption}</caption>}
          <thead><tr>{props.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{props.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    ),
    Callout: ({ props }) => (
      <div className={cx("jr-callout", `tone-${props.tone}`)} role="note">
        <strong>{props.title}</strong>{props.text && <p>{props.text}</p>}
      </div>
    ),
    Quote: ({ props }) => <blockquote className="jr-quote"><p>{props.text}</p>{props.source && <cite>{props.source}</cite>}</blockquote>,
    Button: ({ props, emit }) => (
      <button type="button" className={cx("btn", props.variant === "primary" && "primary")} onClick={() => emit("press")}>{props.label}</button>
    ),
    Divider: () => <hr className="jr-divider" />,
    StoryRow: ({ props, emit }) => (
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
    ),
  },
});

const roots = new WeakMap();
function render(el, spec, handlers = {}) {
  let root = roots.get(el);
  if (!root) { root = createRoot(el); roots.set(el, root); }
  root.render(
    <JSONUIProvider registry={registry} handlers={handlers}>
      <Renderer spec={spec} registry={registry} />
    </JSONUIProvider>,
  );
}
window.JR = { render };
