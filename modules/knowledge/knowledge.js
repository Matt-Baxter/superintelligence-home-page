// Knowledge layer: chunks of story text, tags per chunk (from every registered tagger), embeddings, and a graph of
// qualified ids (topic:, org:, concept:, benchmark:, person:) linked by co-occurrence and by curated relations.
// Pure functions here; routes.js and scripts/knowledge.js do the database work. Free tier: nothing runs on a timer.
const crypto = require("crypto");
const { createRegistry } = require("../../lib/registry");

// ---------- chunking (we only hold titles and summaries; full article text is never stored, REQ-007) ----------
function chunk(story, { max = 420 } = {}) {
  const text = [story.title, story.summary].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
  const sentences = text.match(/[^.!?]+[.!?]*(\s+|$)/g) || [text];
  const out = []; let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) { out.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((t, ord) => ({ story_id: story.id, ord, text: t, hash: crypto.createHash("sha1").update(t).digest("hex").slice(0, 16) }));
}

// ---------- embedders (adapters + factory) ----------
const embedders = createRegistry("embedder", { required: ["id", "about", "make"] });
// Free, local and deterministic: signed feature hashing of words and word pairs, L2-normalised. Good enough to find
// near-duplicates and related chunks; swap in a neural model through another adapter when one is available.
embedders.register({
  id: "hash-256", about: "Feature hashing of words and word pairs into 256 signed buckets (free, no model download)",
  make: ({ dims = 256 } = {}) => ({
    id: `hash-${dims}`, dims,
    embed(text) {
      const v = new Float64Array(dims);
      const words = String(text).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
      const STOP = new Set(["the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with", "is", "are", "be", "by", "as", "at", "it", "this", "that", "from", "we", "our"]);
      const feats = []; for (let i = 0; i < words.length; i++) { if (!STOP.has(words[i])) feats.push(words[i]); if (i + 1 < words.length) feats.push(`${words[i]} ${words[i + 1]}`); }
      for (const f of feats) { const h = crypto.createHash("md5").update(f).digest(); const idx = h.readUInt32LE(0) % dims; v[idx] += h[4] & 1 ? 1 : -1; }
      const n = Math.hypot(...v) || 1;
      return Array.from(v, (x) => Math.round((x / n) * 1e4) / 1e4);
    },
  }),
});
// Optional neural embeddings, run locally with transformers.js when someone installs it (npm i @huggingface/transformers).
embedders.register({
  id: "minilm", about: "all-MiniLM-L6-v2 via transformers.js, run locally (optional; not installed by default)",
  make: () => {
    let pipe;
    return { id: "minilm-384", dims: 384, async: true,
      async embed(text) {
        if (!pipe) { let tf; try { tf = await import("@huggingface/transformers"); } catch { throw new Error("Install @huggingface/transformers to use the minilm embedder"); } pipe = await tf.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2"); }
        const out = await pipe(text, { pooling: "mean", normalize: true }); return Array.from(out.data);
      } };
  },
});
// EmbeddingGemma (Google's small embedding model) served locally by Ollama: `ollama pull embeddinggemma`. Free; 768 dims.
embedders.register({
  id: "embeddinggemma", about: "EmbeddingGemma via a local Ollama (Mac mini or any machine); free, needs `ollama pull embeddinggemma`",
  make: ({ base = process.env.OLLAMA_BASE_URL || "http://localhost:11434", model = "embeddinggemma" } = {}) => ({ id: "embeddinggemma-768", dims: 768, async: true,
    async embed(text) {
      const r = await fetch(`${base.replace(/\/v1$/, "")}/api/embed`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, input: String(text) }) });
      if (!r.ok) throw new Error(`Ollama embed ${r.status}: is Ollama running with ${model} pulled?`);
      return (await r.json()).embeddings[0];
    } }),
});
const cosine = (a, b) => { let s = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i]; return s; };

// ---------- graph ----------
// Co-occurrence: two tags on the same chunk are linked; weight = number of chunks, evidence = story ids (up to 5).
function coOccurrence(chunks) {
  const edges = new Map();
  for (const c of chunks) {
    const qids = [...new Set((c.tags || []).filter((t) => !t.via).map((t) => t.qid))].sort();
    for (let i = 0; i < qids.length; i++) for (let j = i + 1; j < qids.length; j++) {
      const k = `${qids[i]}|${qids[j]}`; const e = edges.get(k) || { src: qids[i], rel: "co-occurs", dst: qids[j], weight: 0, evidence: [] };
      e.weight++; const ev = `story:${c.story_id}`; if (!e.evidence.includes(ev) && e.evidence.length < 5) e.evidence.push(ev); edges.set(k, e);
    }
  }
  return [...edges.values()];
}
// Neighbourhood of one node: edges touching it, strongest first.
function neighbours(edges, qid, limit = 25) {
  return edges.filter((e) => e.src === qid || e.dst === qid).sort((a, b) => b.weight - a.weight).slice(0, limit)
    .map((e) => ({ ...e, other: e.src === qid ? e.dst : e.src }));
}

// JSON-LD export with the generated context (schema/gen/context.jsonld).
function toJsonLd({ chunks = [], edges = [], base = "" }) {
  return {
    "@context": `${base}/api/knowledge/context.jsonld`,
    "@graph": [
      ...chunks.map((c) => ({ "@id": `chunk:${c.story_id}:${c.ord}`, "@type": "Chunk", story_id: c.story_id, ord: c.ord, text: c.text, hash: c.hash, tags: (c.tags || []).map((t) => ({ "@type": "Tag", qid: t.qid, label: t.label, matched: t.matched, method: t.method })) })),
      ...edges.map((e) => ({ "@type": "Edge", src: e.src, rel: e.rel, dst: e.dst, weight: e.weight, evidence: e.evidence })),
    ],
  };
}

module.exports = { chunk, embedders, cosine, coOccurrence, neighbours, toJsonLd };
