// zod (v4) schemas as an ES module for Node and the browser: import { Tag } from "./schema/gen/zod.mjs".
module.exports = {
  id: "zod", file: "zod.mjs", about: "zod v4 schemas (ES module)",
  generate(m, { ordered, header }) {
    const scalar = { string: "z.string()", int: "z.number().int()", float: "z.number()", bool: "z.boolean()", datetime: "z.string().datetime({ offset: true })", json: "z.unknown()" };
    const field = (f) => { let s = f.scalar ? scalar[f.base] : f.base; if (f.pattern) s += `.regex(new RegExp(${JSON.stringify(f.pattern)}))`; if (f.list) s = `z.array(${s})`; if (f.optional) s += ".nullable().optional()"; if (f.about) s += `.describe(${JSON.stringify(f.about)})`; return s; };
    const L = [header("//"), 'import { z } from "zod";', ""];
    for (const e of m.enums) L.push(`/** ${e.about} */`, `export const ${e.name} = z.enum(${JSON.stringify(e.values)});`, "");
    for (const t of ordered) L.push(`/** ${t.about} */`, `export const ${t.name} = z.object({`, ...t.fields.map((f) => `  ${JSON.stringify(f.name)}: ${field(f)},`), "}).strict();", "");
    L.push(`export const types = { ${[...m.enums.map((e) => e.name), ...ordered.map((t) => t.name)].join(", ")} };`, "");
    return L.join("\n");
  },
};
