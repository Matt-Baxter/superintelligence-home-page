// Graph algorithms over the app graph (REQ-066, proposed): DAG check with a topological order, quantified path
// patterns (bounded, returning the paths), BFS and A* with a landmark lower bound. Plain JS over { nodes, edges }.
function index({ nodes, edges }) {
  const out = new Map(), inn = new Map(), ids = new Set(nodes.map((n) => n.id));
  for (const id of ids) { out.set(id, []); inn.set(id, []); }
  for (const e of edges) { if (!out.has(e.s)) { out.set(e.s, []); inn.set(e.s, []); } if (!out.has(e.o)) { out.set(e.o, []); inn.set(e.o, []); } out.get(e.s).push(e); inn.get(e.o).push(e); }
  return { out, inn, byId: new Map(nodes.map((n) => [n.id, n])) };
}

// Kahn's algorithm on the edges with relation `rel`. Returns { dag, order } or { dag: false, cycle: [ids...] }.
function dag(g, rel) {
  const es = g.edges.filter((e) => e.p === rel), ids = new Set(es.flatMap((e) => [e.s, e.o])), indeg = new Map([...ids].map((i) => [i, 0])), adj = new Map([...ids].map((i) => [i, []]));
  for (const e of es) { adj.get(e.s).push(e.o); indeg.set(e.o, indeg.get(e.o) + 1); }
  const q = [...ids].filter((i) => !indeg.get(i)).sort(), order = [];
  while (q.length) { const n = q.shift(); order.push(n); for (const m of adj.get(n)) { indeg.set(m, indeg.get(m) - 1); if (!indeg.get(m)) q.push(m); } }
  if (order.length === ids.size) return { dag: true, order };
  // Find one cycle among the remaining nodes (DFS with a stack).
  const left = new Set([...ids].filter((i) => !order.includes(i))), seen = new Set(), stack = [];
  const dfs = (n) => { if (stack.includes(n)) return [...stack.slice(stack.indexOf(n)), n]; if (seen.has(n)) return null; seen.add(n); stack.push(n); for (const m of adj.get(n)) if (left.has(m)) { const c = dfs(m); if (c) return c; } stack.pop(); return null; };
  for (const n of left) { const c = dfs(n); if (c) return { dag: false, cycle: c }; }
  return { dag: false, cycle: [...left] };
}

// Quantified path pattern: from `start`, follow `rel` (or any of rels; "^rel" walks it backwards) between min and max
// times, without revisiting a node, ending where `end(node)` is true. Returns the paths (node id lists).
function qpp(g, { start, rel, min = 1, max = 3, end = () => true, limit = 500 }) {
  const I = g._i || (g._i = index(g)), rels = [].concat(rel), paths = [];
  const step = (id) => rels.flatMap((r) => r.startsWith("^") ? I.inn.get(id).filter((e) => e.p === r.slice(1)).map((e) => e.s) : I.out.get(id).filter((e) => e.p === r).map((e) => e.o));
  const walk = (path) => {
    if (paths.length >= limit) return;
    const hops = path.length - 1, last = path[path.length - 1];
    if (hops >= min && end(I.byId.get(last) || { id: last })) paths.push(path);
    if (hops === max) return;
    for (const n of step(last) || []) if (!path.includes(n)) walk([...path, n]);
  };
  walk([start]);
  return paths;
}

// Undirected neighbours (paths between any two elements, whatever the edge direction), for BFS and A*.
const nbrs = (I, id) => [...(I.out.get(id) || []).map((e) => e.o), ...(I.inn.get(id) || []).map((e) => e.s)];
function bfs(g, from, to) {
  const I = g._i || (g._i = index(g)), prev = new Map([[from, null]]), q = [from]; let expanded = 0;
  while (q.length) { const n = q.shift(); expanded++; if (n === to) break; for (const m of nbrs(I, n)) if (!prev.has(m)) { prev.set(m, n); q.push(m); } }
  if (!prev.has(to)) return { path: null, expanded };
  const path = []; for (let n = to; n !== null; n = prev.get(n)) path.unshift(n);
  return { path, expanded };
}
function distancesFrom(I, src) { const d = new Map([[src, 0]]), q = [src]; while (q.length) { const n = q.shift(); for (const m of nbrs(I, n)) if (!d.has(m)) { d.set(m, d.get(n) + 1); q.push(m); } } return d; }
// Landmarks: the k highest-degree nodes. h(n) = max over landmarks of |d(L, goal) - d(L, n)|: by the triangle
// inequality it never overestimates the hops left, so A* returns a shortest path.
function landmarks(g, k = 4) {
  const I = g._i || (g._i = index(g));
  if (g._lm && g._lm.k === k) return g._lm;
  const top = [...I.out.keys()].sort((a, b) => nbrs(I, b).length - nbrs(I, a).length || (a < b ? -1 : 1)).slice(0, k);
  return (g._lm = { k, dists: top.map((L) => distancesFrom(I, L)) });
}
function astar(g, from, to, { k = 4 } = {}) {
  const I = g._i || (g._i = index(g)), lm = landmarks(g, k);
  const h = (n) => lm.dists.reduce((b, d) => (d.has(n) && d.has(to) ? Math.max(b, Math.abs(d.get(to) - d.get(n))) : b), 0);
  const gS = new Map([[from, 0]]), prev = new Map([[from, null]]), open = [[h(from), from]], closed = new Set(); let expanded = 0;
  while (open.length) {
    open.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)); const [, n] = open.shift();
    if (closed.has(n)) continue; closed.add(n); expanded++;
    if (n === to) { const path = []; for (let x = to; x !== null; x = prev.get(x)) path.unshift(x); return { path, expanded }; }
    for (const m of nbrs(I, n)) { const t = gS.get(n) + 1; if (!gS.has(m) || t < gS.get(m)) { gS.set(m, t); prev.set(m, n); open.push([t + h(m), m]); } }
  }
  return { path: null, expanded };
}
module.exports = { index, dag, qpp, bfs, astar, landmarks };
