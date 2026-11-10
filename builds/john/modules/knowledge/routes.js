// Knowledge routes (docs/NAMING.md: /api/knowledge/* for signed-in users, /api/admin/knowledge/* for admins).
const path = require("path"), fs = require("fs");
const K = require("./knowledge");
const taggers = require("../../lib/taggers");
const expr = require("../../lib/expr");
const ids = require("../../lib/ids");

const GEN = path.join(__dirname, "..", "..", "schema", "gen");
const iso = () => new Date().toISOString();
let zodP; const zod = () => (zodP ||= import(path.join(GEN, "zod.mjs")));

module.exports = function mountKnowledge(app, { db, auth, admin, wrap, str, bad, notFound }) {
  const embedder = K.embedders.create("hash-256");
  function inputId(value, name, optional = false) {
    if (optional && (value == null || value === "")) return "";
    if (typeof value !== "string" || value.trim().length > 320) bad(`${name} must be a qualified id of at most 320 characters`);
    const node = ids.parse(value); if (!node) bad(`${name} must be a canonical qualified id`);
    return node.qid;
  }

  const admitted = "COALESCE(s.in_scope, 0) = 1 AND COALESCE(s.hidden, 0) = 0";
  const staleIndex = async () => !!(await db.get(`SELECT c.story_id FROM knowledge_chunks c JOIN stories s ON s.id = c.story_id WHERE NOT (${admitted}) LIMIT 1`));
  // Build or refresh the index: chunk recent in-scope stories, tag and embed changed chunks, rebuild the graph.
  async function build(limit = 200) {
    const stories = await db.all("SELECT id, title, summary FROM stories WHERE COALESCE(in_scope, 0) = 1 AND COALESCE(hidden, 0) = 0 ORDER BY id DESC LIMIT ?", Math.min(2000, limit));
    let changed = 0, kept = 0;
    for (const s of stories) {
      const have = Object.fromEntries((await db.all("SELECT ord, hash, tags, model FROM knowledge_chunks WHERE story_id = ?", s.id)).map((r) => [r.ord, r]));
      const chunks = K.chunk(s);
      await db.tx(async (t) => {
        for (const c of chunks) {
          const tags = taggers.tagAll(c.text), serializedTags = JSON.stringify(tags), cached = have[c.ord];
          if (cached?.hash === c.hash && cached.tags === serializedTags && cached.model === embedder.id) { kept++; continue; }
          await t.run("DELETE FROM knowledge_chunks WHERE story_id = ? AND ord = ?", s.id, c.ord);
          await t.run("INSERT INTO knowledge_chunks (story_id, ord, text, hash, tags, model, vector, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            s.id, c.ord, c.text, c.hash, serializedTags, embedder.id, JSON.stringify(embedder.embed(c.text)), iso());
          changed++;
        }
        await t.run("DELETE FROM knowledge_chunks WHERE story_id = ? AND ord >= ?", s.id, chunks.length);
      });
    }
    let edgeCount = 0;
    await db.tx(async (t) => {
      // Lock participating Postgres story rows during finalization, so concurrent moderation
      // cannot remove cache rows while their old contributions are written into a fresh graph.
      const all = (await t.all(`SELECT c.story_id, c.ord, c.tags FROM knowledge_chunks c JOIN stories s ON s.id = c.story_id WHERE ${admitted}${db.engine === "pg" ? " FOR SHARE OF s" : ""}`)).map(r => ({ ...r, tags: JSON.parse(r.tags) }));
      const edges = [...K.coOccurrence(all), ...taggers.curatedEdges()]; edgeCount = edges.length;
      await t.run("DELETE FROM knowledge_chunks WHERE story_id NOT IN (SELECT id FROM stories WHERE COALESCE(in_scope, 0) = 1 AND COALESCE(hidden, 0) = 0)");
      await t.run("DELETE FROM knowledge_edges WHERE src NOT LIKE 'doc:%' AND src NOT LIKE 'event:%'");
      for (const e of edges) await t.run("INSERT INTO knowledge_edges (src, rel, dst, weight, evidence, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (src, rel, dst) DO UPDATE SET weight = excluded.weight, evidence = excluded.evidence",
        e.src, e.rel, e.dst, e.weight, JSON.stringify(e.evidence), iso());
    });
    return { stories: stories.length, chunks_changed: changed, chunks_kept: kept, edges: edgeCount, taggers: taggers.registry.ids(), embedder: embedder.id };
  }
  app.post("/api/admin/knowledge/build", auth, admin, wrap(async (req) => build(Number(req.body?.limit) || 200)));
  app.get("/api/admin/knowledge/stats", auth, admin, wrap(async () => ({
    chunks: (await db.get("SELECT COUNT(*) AS n FROM knowledge_chunks")).n, edges: (await db.get("SELECT COUNT(*) AS n FROM knowledge_edges")).n,
    taggers: taggers.registry.list().map(({ id, about, namespace, module }) => ({ id, about, namespace, module: module || "core" })),
    embedders: K.embedders.list().map(({ id, about }) => ({ id, about })),
  })));

  const edgeRow = (r) => { const edge = { src: r.src, rel: r.rel, dst: r.dst, weight: Number(r.weight), evidence: JSON.parse(r.evidence || "[]") }; return { ...edge, meaning: K.explainEdge(edge) }; };
  // Graph: one node's neighbourhood, or the best-connected nodes when no qid is given.
  app.get("/api/knowledge/graph", auth, wrap(async (req) => {
    const stale = await staleIndex();
    const q = inputId(req.query.qid, "qid", true), requestedLimit = Number(req.query.limit), limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(60, Math.trunc(requestedLimit || 25))) : 25;
    if (q) {
      const rows = (await db.all(`SELECT * FROM knowledge_edges WHERE (src = ? OR dst = ?)${stale ? " AND rel <> 'co-occurs'" : ""} ORDER BY weight DESC LIMIT ?`, q, q, limit)).map(edgeRow);
      return { qid: q, stale, edges: rows.map((e) => ({ ...e, other: e.src === q ? e.dst : e.src })) };
    }
    if (stale) return { nodes: [], stale: true };
    const deg = await db.all("SELECT qid, SUM(w) AS weight, COUNT(*) AS degree FROM (SELECT src AS qid, weight AS w FROM knowledge_edges WHERE rel = 'co-occurs' UNION ALL SELECT dst AS qid, weight AS w FROM knowledge_edges WHERE rel = 'co-occurs') x GROUP BY qid ORDER BY weight DESC LIMIT ?", limit);
    return { stale: false, nodes: deg.map((d) => ({ qid: d.qid, weight: Number(d.weight), degree: Number(d.degree) })) };
  }));
  // Chunks carrying a tag (qualified id).
  app.get("/api/knowledge/chunks", auth, wrap(async (req) => {
    const q = inputId(req.query.tag, "tag");
    const rows = await db.all(`SELECT c.story_id, c.ord, c.text, c.tags, s.title FROM knowledge_chunks c JOIN stories s ON s.id = c.story_id WHERE ${admitted} AND c.tags LIKE ? ORDER BY c.story_id DESC LIMIT 50`, `%"qid":"${q.replace(/[%_"]/g, "")}"%`);
    return { tag: q, chunks: rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) })).filter((r) => r.tags.some((t) => t.qid === q)) };
  }));
  // Nearest chunks to a query (cosine over the stored vectors; bounded scan for the free tier).
  app.get("/api/knowledge/similar", auth, wrap(async (req) => {
    const q = str(req.query.q, 300); if (!q) bad("Give a query.");
    const v = embedder.embed(q);
    const rows = await db.all(`SELECT c.story_id, c.ord, c.text, c.vector, s.title FROM knowledge_chunks c JOIN stories s ON s.id = c.story_id WHERE ${admitted} AND c.model = ? ORDER BY c.story_id DESC LIMIT 2000`, embedder.id);
    return { model: embedder.id, results: rows.map((r) => ({ story_id: r.story_id, ord: r.ord, title: r.title, text: r.text, score: Math.round(K.cosine(v, JSON.parse(r.vector)) * 1000) / 1000 })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 10) };
  }));
  // Linked data: the generated JSON-LD context, and the graph as JSON-LD.
  app.get("/api/knowledge/context.jsonld", wrap(async (req, res) => { res.type("application/ld+json").send(fs.readFileSync(path.join(GEN, "context.jsonld"), "utf8")); return undefined; }));
  app.get("/api/knowledge/export.jsonld", auth, wrap(async (req, res) => {
    const chunks = (await db.all(`SELECT c.story_id, c.ord, c.text, c.hash, c.tags FROM knowledge_chunks c JOIN stories s ON s.id = c.story_id WHERE ${admitted} ORDER BY c.story_id DESC, c.ord LIMIT 500`)).map((r) => ({ ...r, tags: JSON.parse(r.tags) }));
    const stale = await staleIndex();
    const edges = (await db.all(`SELECT * FROM knowledge_edges${stale ? " WHERE rel <> 'co-occurs'" : ""} ORDER BY weight DESC LIMIT 2000`)).map(edgeRow);
    res.type("application/ld+json").send(JSON.stringify(K.toJsonLd({ chunks, edges, base: `${req.protocol}://${req.get("host")}` })));
    return undefined;
  }));

  // JSON-RPC 2.0 (schema/gen/openrpc.json). Params are checked with the zod schemas generated from schema/types.json.
  const METHODS = {
    "knowledge.tag": { input: "TagRequest", run: async (p) => {
      const text = [p.title, p.summary].filter(Boolean).join("\n");
      const tags = taggers.tagAll(text, (p.taggers || []).filter((id) => taggers.registry.has(id)));
      const tops = [...new Set(tags.filter((t) => t.qid.startsWith("topic:") && !t.via).map((t) => t.qid.slice(6)))];
      return { tags, scope: require("../../lib/analysis").scope(text, tops.map((id) => ({ id }))) };
    } },
    "knowledge.evaluate": { input: "EvalRequest", run: async (p) => ({ value: typeof p.rule === "string" ? expr.run(p.rule, p.data ?? {}) : expr.evaluate(p.rule, p.data ?? {}) }) },
  };
  async function call(msg) {
    const id = msg && Object.prototype.hasOwnProperty.call(msg, "id") ? msg.id : null;
    const err = (code, message, data) => ({ jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } });
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(-32600, "Invalid request");
    const m = METHODS[msg.method]; if (!m) return err(-32601, `Method not found: ${msg.method}`);
    const z = await zod(); const parsed = z[m.input].safeParse(msg.params ?? {});
    if (!parsed.success) return err(-32602, "Invalid params", parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`));
    try { return { jsonrpc: "2.0", id, result: await m.run(parsed.data) }; } catch (e) { return err(-32000, String(e.message || e).slice(0, 300)); }
  }
  app.post("/api/knowledge/rpc", auth, wrap(async (req) => {
    if (JSON.stringify(req.body || {}).length > 20000) bad("Request too large.");
    return Array.isArray(req.body) ? Promise.all(req.body.slice(0, 20).map(call)) : call(req.body);
  }));
};
