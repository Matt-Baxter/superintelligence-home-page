// The json-render catalog: the only components (blocks) and actions a view spec may use.
// Blocks are plug-ins: every enabled module may ship blocks/<Name>/block.mjs (props schema + description, headless)
// and blocks/<Name>/render.jsx (the React view, bundled into public/js/jr.js by `npm run build`).
// The server reads the block definitions here; catalog.prompt() is the system prompt for generating UI with an LLM.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { actions } from "./actions.mjs";

const require = createRequire(import.meta.url);
const { readEnabled, MODULES_DIR } = require("../kernel/kernel.js");

export async function loadBlocks(enabled = readEnabled()) {
  const out = [];
  for (const id of enabled) {
    const dir = path.join(MODULES_DIR, id, "blocks");
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "block.mjs"))).sort()) {
      const def = (await import(pathToFileURL(path.join(dir, name, "block.mjs")).href)).default;
      if (def.name !== name) throw new Error(`modules/${id}/blocks/${name}/block.mjs must export name "${name}"`);
      if (out.some((b) => b.def.name === name)) throw new Error(`Block "${name}" is defined twice (modules ${out.find((b) => b.def.name === name).module} and ${id})`);
      out.push({ module: id, def, hasRender: fs.existsSync(path.join(dir, name, "render.jsx")) });
    }
  }
  return out;
}

export const blocks = await loadBlocks();
export const catalog = defineCatalog(schema, {
  components: Object.fromEntries(blocks.map(({ def }) => [def.name, { props: def.props, description: def.description }])),
  actions,
});
