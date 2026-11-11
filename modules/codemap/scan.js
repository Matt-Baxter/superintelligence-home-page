// Codebase map scanner: parse the repo → a graph schema (nodes + edges) the Map page lays out and agents query.
// No dependencies; regex-based on purpose (the codebase follows a few conventions; see README.md). Runs at build time
// (`node scripts/codemap.js build`) and on demand locally.
const fs = require("node:fs"), path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(p, "utf8");
const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;
const walk = (d, filter) => !fs.existsSync(d) ? [] : fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  // "data" folders hold generated data, except modules/data, which is the data module's code.
  if (e.isDirectory()) return ["node_modules", ".git", "dist", "data", "shots", "m"].includes(e.name) && !(e.name === "data" && path.basename(d) === "modules") ? [] : walk(p, filter);
  return filter(p) ? [p] : [];
});

// Text of a balanced block starting at the first `open` at or after idx (naive: good enough for this codebase's style).
function balanced(src, idx, open = "{", close = "}") {
  const start = src.indexOf(open, idx); if (start < 0) return src.slice(idx, idx + 2000);
  let depth = 0;
  for (let i = start; i < src.length && i < start + 20000; i++) { if (src[i] === open) depth++; else if (src[i] === close && --depth === 0) return src.slice(idx, i + 1); }
  return src.slice(idx, start + 20000);
}

function build() {
  const nodes = new Map(), edges = [], problems = [];
  const node = (id, kind, label, extra = {}) => { if (!nodes.has(id)) nodes.set(id, { id, kind, label, ...extra }); else Object.assign(nodes.get(id), extra); return id; };
  const edge = (from, to, kind) => { if (from && to && from !== to && !edges.some((e) => e.from === from && e.to === to && e.kind === kind)) edges.push({ from, to, kind }); };

  // ---- modules and extension points (kernel) ----
  const { createKernel } = require(path.join(ROOT, "kernel", "kernel.js"));
  const kernel = createKernel();
  for (const p of kernel.describe().points) node(`point:${p.id}`, "point", p.id, { owner: p.owner });
  for (const m of kernel.describe().modules) {
    node(`module:${m.id}`, "module", m.id, { detail: m.description, version: m.version, file: `modules/${m.id}/module.js` });
    for (const r of m.requires) edge(`module:${m.id}`, `module:${r}`, "requires");
    for (const c of m.contributes) edge(`module:${m.id}`, `point:${c.point}`, "contributes");
  }
  for (const [id, p] of kernel.points) if (p.owner !== "kernel") edge(`module:${p.owner}`, `point:${id}`, "declares");
  for (const v of kernel.store.views.values()) { node(`view:${v.name}`, "view", v.title, { detail: v.description }); edge(`module:${v.module}`, `view:${v.name}`, "contributes"); }
  const decision = kernel.modules.find((m) => m.id === "decision");
  if (decision) for (const j of decision.judges.values()) { node(`judge:${j.id}`, "judge", j.name, { detail: j.description }); edge(`module:${j.module}`, `judge:${j.id}`, "contributes"); }

  // ---- source files and their requires ----
  const codeFiles = [path.join(ROOT, "server.js"), ...walk(path.join(ROOT, "lib"), (p) => p.endsWith(".js")), ...walk(path.join(ROOT, "kernel"), (p) => p.endsWith(".js")),
    ...walk(path.join(ROOT, "modules"), (p) => /\.(js|mjs)$/.test(p) && !p.includes(`${path.sep}blocks${path.sep}`)), ...walk(path.join(ROOT, "views"), (p) => p.endsWith(".mjs"))];
  for (const f of codeFiles) {
    const r = rel(f), mod = r.match(/^modules\/([^/]+)\//)?.[1];
    node(`file:${r}`, "file", r, { file: r, module: mod || "core" });
    if (mod) edge(`module:${mod}`, `file:${r}`, "owns");
    const src = read(f);
    for (const m of src.matchAll(/(?:require\(|from\s+|import\()\s*["'`](\.{1,2}\/[^"'`]+)["'`]/g)) {
      let t = path.resolve(path.dirname(f), m[1]); if (!/\.(js|mjs|json|jsx)$/.test(t)) t += fs.existsSync(t + ".js") ? ".js" : "";
      if (fs.existsSync(t) && /\.(js|mjs)$/.test(t)) edge(`file:${r}`, `file:${rel(t)}`, "requires");
    }
  }

  // ---- tables ----
  const tableRe = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([^;]*?)\);/g;
  for (const f of codeFiles) {
    const src = read(f), r = rel(f);
    for (const m of src.matchAll(tableRe)) {
      const cols = m[2].split(/,(?![^(]*\))/).map((c) => c.trim().split(/\s+/)[0]).filter((c) => /^[a-z_]+$/.test(c) && !["PRIMARY", "UNIQUE", "FOREIGN"].includes(c.toUpperCase()));
      node(`table:${m[1]}`, "table", m[1], { file: r, line: lineOf(src, m.index), columns: cols });
    }
  }
  const tables = [...nodes.values()].filter((n) => n.kind === "table").map((n) => n.label);
  const tablesIn = (text) => {
    const out = { reads: new Set(), writes: new Set() };
    for (const t of tables) {
      if (new RegExp(`\\b(INSERT(?: OR IGNORE)? INTO|UPDATE|DELETE FROM)\\s+${t}\\b`, "i").test(text)) out.writes.add(t);
      if (new RegExp(`\\b(FROM|JOIN)\\s+${t}\\b`, "i").test(text)) out.reads.add(t);
    }
    return out;
  };

  // ---- routes (handler-level SQL, plus one level of same-file helper functions) ----
  const routeRe = /app\.(get|post|put|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  for (const f of codeFiles) {
    const src = read(f), r = rel(f);
    const matches = [...src.matchAll(routeRe)];
    const ranges = matches.map((m) => [m.index, m.index + balanced(src, m.index, "(", ")").length]);
    // Helpers: functions defined outside any route handler that run SQL themselves (e.g. storyRows in server.js).
    const helpers = {};
    for (const m of src.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)) {
      if (ranges.some(([a, b]) => m.index > a && m.index < b)) continue;
      const name = m[1] || m[2];
      const arrowExpr = !m[1] && !/^\s*\{/.test(src.slice(src.indexOf("=>", m.index) + 2, src.indexOf("=>", m.index) + 6));
      // Skip the parameter list (it may contain `{ … } = {}` defaults), then take the body.
      const afterParams = m.index + balanced(src, m.index, "(", ")").length;
      const h = arrowExpr ? src.slice(m.index, src.indexOf("\n", m.index + 1)) : src.slice(m.index, afterParams) + balanced(src, afterParams);
      if (/app\.(get|post|put|delete|use)\(/.test(h)) continue; // a wrapper that mounts routes, not a SQL helper
      if (/\b(SELECT|INSERT|UPDATE|DELETE)\b/.test(h)) helpers[name] = h;
    }
    matches.forEach((m, i) => {
      const method = m[1].toUpperCase(), p = m[2], id = `route:${method} ${p}`;
      const body = balanced(src, m.index, "(", ")");
      const guards = { auth: /\bauth\b/.test(body.slice(0, 200)), admin: /\badmin\b/.test(body.slice(0, 200)) };
      node(id, "route", `${method} ${p}`, { file: r, line: lineOf(src, m.index), method, path: p, ...guards, module: r.match(/^modules\/([^/]+)\//)?.[1] || "core" });
      edge(id, `file:${r}`, "defined-in");
      const t = tablesIn(body);
      for (const [name, h] of Object.entries(helpers)) if (new RegExp(`\\b${name}\\(`).test(body)) { const ht = tablesIn(h); ht.reads.forEach((x) => t.reads.add(x)); ht.writes.forEach((x) => t.writes.add(x)); }
      // A helper given the table name (toggle("votes", …)) writes whichever table it's handed.
      for (const c of body.matchAll(/\b(\w+)\(\s*["'`](\w+)["'`]/g)) if (helpers[c[1]] && tables.includes(c[2]) && /(INSERT|DELETE|UPDATE)[^`]*\$\{/.test(helpers[c[1]])) t.writes.add(c[2]);
      t.writes.forEach((x) => edge(id, `table:${x}`, "writes"));
      t.reads.forEach((x) => { if (!t.writes.has(x)) edge(id, `table:${x}`, "reads"); });
    });
  }
  const routes = [...nodes.values()].filter((n) => n.kind === "route");
  const segs = (p) => p.split("?")[0].replace(/\/+$/, "").split("/");
  const matchRoute = (method, url) => {
    const u = segs(url);
    return routes.filter((rt) => (!method || rt.method === method) && (() => { const s = segs(rt.path); return s.length === u.length && s.every((x, i) => x.startsWith(":") || u[i] === ":p" || x === u[i]); })());
  };

  // ---- pages and the routes they call ----
  const pageFiles = [...walk(path.join(ROOT, "public"), (p) => p.endsWith(".html")), ...walk(path.join(ROOT, "modules"), (p) => p.endsWith(".html") && p.includes(`${path.sep}pages${path.sep}`))];
  for (const f of pageFiles) {
    const r = rel(f), src = read(f), mod = r.match(/^modules\/([^/]+)\//)?.[1];
    const url = mod ? `/m/${path.basename(f, ".html")}` : `/${path.basename(f, ".html")}`.replace(/^\/index$/, "/");
    const id = node(`page:${url}`, "page", url, { file: r, module: mod || "core", title: src.match(/<title>([^<·]+)/)?.[1]?.trim() || url });
    if (mod) edge(`module:${mod}`, id, "owns");
    // Every page that loads api.js signs in through it (GET /api/me) and can sign out (POST /api/logout).
    const viaShared = src.includes("/js/api.js") ? '\napi("/api/me")\napi("/api/logout", { body: {} })' : "";
    callsIn(src + viaShared, r).forEach(({ method, url: u }) => {
      const hits = matchRoute(method, u);
      if (!hits.length) problems.push({ kind: "dangling-call", page: url, file: r, call: `${method || "GET"} ${u}`, message: `${r} calls ${method || "GET"} ${u.replace(/:p/g, "…")}, but no route matches` });
      hits.forEach((h) => edge(id, h.id, "calls"));
    });
  }
  function callsIn(text) {
    const out = [];
    for (const m of text.matchAll(/\bapi\(\s*([`"'])(\/api\/[^`"']*)\1\s*(,\s*\{([^}]*)\})?/g)) {
      const u = m[2].replace(/\$\{[^}]*\}/g, ":p").replace(/\?.*$/, "").replace(/:p:p/g, ":p");
      const opts = m[4] || "", method = (opts.match(/method:\s*["'](\w+)["']/)?.[1] || (/\bbody\b/.test(opts) ? "POST" : "GET")).toUpperCase();
      out.push({ method, url: u });
    }
    for (const m of text.matchAll(/\bfetch\(\s*([`"'])(\/api\/[^`"']*)\1/g)) out.push({ method: null, url: m[2].replace(/\$\{[^}]*\}/g, ":p").replace(/\?.*$/, "") });
    return out;
  }

  // ---- blocks (json-render) ----
  for (const d of walk(path.join(ROOT, "modules"), (p) => p.endsWith(`${path.sep}block.mjs`))) {
    const r = rel(d), name = path.basename(path.dirname(d)), mod = r.split("/")[1];
    const desc = read(d).match(/description:\s*"([^"]+)"/)?.[1] || "";
    node(`block:${name}`, "block", name, { file: r, module: mod, detail: desc });
    edge(`module:${mod}`, `block:${name}`, "contributes"); edge(`block:${name}`, "point:ui.blocks", "implements");
  }
  if ([...nodes.values()].some((n) => n.kind === "block")) node("point:ui.blocks", "point", "ui.blocks", { owner: "kernel" });

  // ---- spec requirements, the trace, and tests ----
  const specFile = path.join(ROOT, "specs", "001-superintelligence-homepage", "spec.md");
  const testNames = [...read(path.join(ROOT, "test", "e2e.js")).matchAll(/\bok\([^;]*?,\s*(["'`])((?:(?!\1).)+)\1\s*\)/g)].map((m) => m[2]);
  if (fs.existsSync(specFile)) {
    const spec = read(specFile);
    for (const m of spec.matchAll(/\*\*(REQ-\d{3})\*\*:\s*([^\n]+(?:\n {2}[^\n]+)*)/g)) node(`req:${m[1]}`, "req", m[1], { detail: m[2].replace(/\s+/g, " ").trim(), file: "specs/001-superintelligence-homepage/spec.md", line: lineOf(spec, m.index) });
    const traceFile = path.join(ROOT, "docs", "SPEC_TRACE.md");
    if (fs.existsSync(traceFile)) for (const row of read(traceFile).split("\n").filter((l) => /^\| REQ-/.test(l))) {
      const [, reqCell, , where = "", checked = ""] = row.split("|").map((c) => c.trim());
      const ids = []; for (const m of reqCell.matchAll(/REQ-(\d{3})(?:[–-](\d{3}))?/g)) for (let i = +m[1]; i <= +(m[2] || m[1]); i++) ids.push(`REQ-${String(i).padStart(3, "0")}`);
      const files = [...where.matchAll(/`([^`]+)`/g)].map((m) => m[1]).flatMap((x) => [...nodes.values()].filter((n) => n.kind === "file" && (n.label === x || n.label.endsWith("/" + x) || (x.includes(".") && n.label.endsWith(x)))).map((n) => n.id));
      const checks = [...checked.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      for (const id of ids) {
        files.forEach((f) => edge(`req:${id}`, f, "met-in"));
        for (const c of checks) for (const t of testNames.filter((t) => t.startsWith(c) || t.includes(c))) { node(`test:${t}`, "test", t, { file: "test/e2e.js" }); edge(`req:${id}`, `test:${t}`, "checked-by"); }
      }
    }
  }

  const out = { generated: new Date().toISOString(), nodes: [...nodes.values()], edges, problems };
  out.counts = out.nodes.reduce((a, n) => ((a[n.kind] = (a[n.kind] || 0) + 1), a), {});
  return out;
}

// ---- queries (used by the API, the CLI and the MCP tool) ----
function neighbors(graph, id, dir = "both") {
  return graph.edges.filter((e) => (dir !== "in" && e.from === id) || (dir !== "out" && e.to === id));
}
// Everything connected to a node, upstream and downstream (bounded), so "trace" can light up a whole path.
function trace(graph, id, depth = 4) {
  const seen = new Set([id]), frontier = [[id, 0]];
  const keep = (e) => !["owns", "requires"].includes(e.kind) || graph.nodes.find((n) => n.id === id)?.kind === "module";
  while (frontier.length) {
    const [cur, d] = frontier.shift(); if (d >= depth) continue;
    for (const e of graph.edges) {
      if (!keep(e)) continue;
      const next = e.from === cur ? e.to : e.to === cur ? e.from : null;
      if (next && !seen.has(next)) { seen.add(next); frontier.push([next, d + 1]); }
    }
  }
  return [...seen];
}
function search(graph, q) {
  const terms = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const score = (n) => terms.reduce((s, t) => s + (n.label.toLowerCase().includes(t) ? 3 : 0) + (String(n.detail || "").toLowerCase().includes(t) ? 1 : 0) + ((n.columns || []).some((c) => c.includes(t)) ? 1 : 0), 0);
  return graph.nodes.map((n) => [n, score(n)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([n]) => n);
}
// One-paragraph answer an agent can use: matching nodes and what they connect to.
function answer(graph, q) {
  const hits = search(graph, q);
  return hits.slice(0, 8).map((n) => {
    const ins = neighbors(graph, n.id, "in").map((e) => `${e.kind} ← ${e.from}`), outs = neighbors(graph, n.id, "out").map((e) => `${e.kind} → ${e.to}`);
    return { id: n.id, kind: n.kind, where: n.file ? `${n.file}${n.line ? ":" + n.line : ""}` : "", detail: n.detail || "", links: [...outs, ...ins].slice(0, 20) };
  });
}

module.exports = { build, trace, search, neighbors, answer };
