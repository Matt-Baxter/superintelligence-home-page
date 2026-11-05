// Browser bundle: builds the json-render catalog from the enabled modules' blocks (client/blocks.gen.jsx, written by
// `node scripts/modules.js gen` during `npm run build`) and exposes window.JR.render(el, spec, handlers).
import React from "react";
import { createRoot } from "react-dom/client";
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react";
import { actions } from "../views/actions.mjs";
import { blocks } from "./blocks.gen.jsx";

const catalog = defineCatalog(schema, {
  components: Object.fromEntries(blocks.map(({ def }) => [def.name, { props: def.props, description: def.description }])),
  actions,
});
const { registry } = defineRegistry(catalog, { components: Object.fromEntries(blocks.map(({ def, render }) => [def.name, render])) });

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
window.JR = { render, blocks: blocks.map(({ def, module }) => ({ name: def.name, module })) };
