// Studio bindings (REQ-064, proposed): a json-render spec may carry
//   "bindings": { "/state/path": { "source": "module.name", "params": { ... } } }
// Each binding runs as the viewer (the source's own permission and the feature flags apply), and its result is
// written into the spec's state at that path. A binding the viewer can't read leaves the path empty and records why
// under /_errors, so the rest of the view still renders.
const MAX = 12;
function setAt(obj, ptr, value) {
  const parts = String(ptr).split("/").slice(1).map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (!parts.length || parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype")) throw new Error(`Bad state path ${ptr}`);
  let o = obj; for (const p of parts.slice(0, -1)) { if (!o[p] || typeof o[p] !== "object") o[p] = {}; o = o[p]; }
  o[parts[parts.length - 1]] = value;
}
async function resolve(spec, req, runSource) {
  if (!spec || !spec.bindings || typeof spec.bindings !== "object") return spec;
  const out = { ...spec, state: JSON.parse(JSON.stringify(spec.state || {})) }, entries = Object.entries(spec.bindings).slice(0, MAX);
  for (const [ptr, b] of entries) {
    try {
      if (!/^\/[A-Za-z0-9_~/-]+$/.test(ptr)) throw Object.assign(new Error(`State path "${ptr}" must look like /name or /a/b`), { status: 400 });
      if (!b || typeof b.source !== "string") throw Object.assign(new Error("A binding needs a source"), { status: 400 });
      setAt(out.state, ptr, await runSource(b.source, b.params || {}, req));
    } catch (e) {
      try { setAt(out.state, ptr, null); } catch {} // a bad path stays unset
      out.state._errors = out.state._errors || {}; out.state._errors[ptr.slice(1).replace(/\//g, ".")] = e.status === 404 ? "not found or switched off" : String(e.message).slice(0, 200);
    }
  }
  return out;
}
module.exports = { resolve, setAt };
