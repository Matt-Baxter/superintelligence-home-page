// The site bundle (public/js/agent-ui.js, built by npm run build): the components plus a mount helper for the plain
// HTML pages. AgentUI.mount(el, "AgentInbox", props) renders into el (and re-renders on a second call); the page
// passes plain data and callbacks. Pages add class "aui-inherit" so the site's own theme tokens apply.
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import * as C from "./registry/agent-ui";

const roots = new WeakMap<Element, Root>();
function mount(el: Element | null, name: keyof typeof C, props: Record<string, unknown>) {
  if (!el) return;
  const Comp = C[name] as unknown as React.ComponentType<any>;
  if (typeof Comp !== "function") throw new Error(`agent-ui has no component ${String(name)}`);
  let root = roots.get(el); if (!root) { root = createRoot(el); roots.set(el, root); }
  root.render(React.createElement(Comp, { className: "aui-inherit", ...props }));
}
function unmount(el: Element | null) { const r = el && roots.get(el); if (r) { r.unmount(); roots.delete(el!); } }
(window as any).AgentUI = { mount, unmount, components: Object.keys(C) };
