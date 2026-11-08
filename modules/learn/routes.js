// Learn routes. Readers (signed in): concepts, graph, teardown. Admins: the job queue.
// Public: the RSS feed of published explainers (Substack and blog readers can import it).
const L = require("./learn");

const STATUSES = ["queued", "running", "needs-agent", "done", "failed", "published"];
const iso = () => new Date().toISOString();
const xml = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

module.exports = function mountLearn(app, { db, auth, admin, wrap, str, bad, notFound }) {
  app.get("/api/learn/glossary", wrap(() => require("./glossary").DATA));
  const parseJob = (j) => j && { ...j, files: JSON.parse(j.files || "[]"), concept: j.concept_id ? (L.BY_ID[j.concept_id]?.name || j.concept_id) : null };

  // Recent in-scope stories that mention a concept (one bounded query, matching done in memory).
  async function storiesFor(id, limit = 8) {
    const c = L.BY_ID[id]; if (!c) return [];
    const rows = await db.all("SELECT id, title, url, summary, published_at FROM stories WHERE COALESCE(in_scope, 0) = 1 AND COALESCE(hidden, 0) = 0 ORDER BY id DESC LIMIT 400");
    return rows.filter((s) => L.conceptsIn(`${s.title}\n${s.summary || ""}`).some((x) => x.id === id)).slice(0, limit).map(({ summary, ...s }) => s);
  }

  app.get("/api/learn/concepts", auth, wrap(async () => ({ relations: L.DATA.relations, concepts: L.list(), edges: L.edges() })));
  app.get("/api/learn/concepts/:id", auth, wrap(async (req) => {
    const c = L.get(str(req.params.id, 60)); if (!c) notFound("That concept");
    const posts = await db.all("SELECT id, published_at FROM learn_jobs WHERE concept_id = ? AND status = 'published' ORDER BY id DESC LIMIT 3", c.id);
    return { concept: c, path: L.path(c.id), stories: await storiesFor(c.id), storyboard: L.storyboard(c.id), posts };
  }));
  // The explainer storyboard is static teaching material, so it's public: explainer links can be shared and recorded.
  app.get("/api/learn/explainer/:id", wrap(async (req) => { const id = str(req.params.id, 60); if (!L.BY_ID[id]) notFound("That concept"); return { storyboard: L.storyboard(id) }; }));
  // Which concepts a story touches (used on the story page and by the teardown).
  app.get("/api/learn/story/:id", auth, wrap(async (req) => {
    const s = await db.get("SELECT title, summary FROM stories WHERE id = ?", Number(req.params.id)); if (!s) notFound("That story");
    return { concepts: L.conceptsIn(`${s.title}\n${s.summary || ""}`) };
  }));
  app.post("/api/learn/teardown", auth, wrap(async (req) => {
    const title = str(req.body?.title, 300), summary = str(req.body?.summary, 1500), url = str(req.body?.url, 500), kind = str(req.body?.kind, 30) || "submitted";
    if (!title) bad("Give the story a title.");
    return L.teardown({ title, summary, url, kind }, (k) => db.get("SELECT s.id, s.title FROM story_keys k JOIN stories s ON s.id = k.story_id WHERE k.key = ?", k));
  }));

  // ---------- admin job queue ----------
  app.get("/api/admin/learn/jobs", auth, admin, wrap(async (req) => {
    const st = str(req.query.status, 20);
    const rows = await db.all(`SELECT * FROM learn_jobs ${STATUSES.includes(st) ? "WHERE status = ?" : ""} ORDER BY id DESC LIMIT 100`, ...(STATUSES.includes(st) ? [st] : []));
    return { kinds: L.JOB_KINDS, statuses: STATUSES, jobs: rows.map(parseJob) };
  }));
  app.post("/api/admin/learn/jobs", auth, admin, wrap(async (req) => {
    const kind = str(req.body?.kind, 30), concept = str(req.body?.concept_id, 60) || null, note = str(req.body?.note, 2000), storyId = Number(req.body?.story_id) || null;
    if (!L.JOB_KINDS.some((k) => k.id === kind)) bad("Unknown job kind.");
    if (concept && !L.BY_ID[concept]) bad("Unknown concept.");
    if (!concept && !storyId && !note) bad("Pick a concept or a story, or describe the job in the note.");
    if (/(twitter\.com|x\.com\/)/i.test(note)) bad("Twitter/X links aren't accepted.");
    if (kind === "lean-proof" && concept && !L.BY_ID[concept].lean) bad("That concept has no formal statement yet.");
    const id = await db.insert("INSERT INTO learn_jobs (kind, concept_id, story_id, note, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)", kind, concept, storyId, note, req.user.id, iso());
    return { job: parseJob(await db.get("SELECT * FROM learn_jobs WHERE id = ?", id)) };
  }));
  app.get("/api/admin/learn/jobs/:id", auth, admin, wrap(async (req) => {
    const j = await db.get("SELECT * FROM learn_jobs WHERE id = ?", Number(req.params.id)); if (!j) notFound("That job");
    return { job: parseJob(j) };
  }));
  // Status changes: requeue, publish (posts only, once done), or record a result by hand.
  app.put("/api/admin/learn/jobs/:id", auth, admin, wrap(async (req) => {
    const j = await db.get("SELECT * FROM learn_jobs WHERE id = ?", Number(req.params.id)); if (!j) notFound("That job");
    const status = str(req.body?.status, 20) || j.status;
    if (!STATUSES.includes(status)) bad("Unknown status.");
    if (status === "published" && (j.kind !== "post" || !["done", "published"].includes(j.status))) bad("Only a finished blog draft can be published.");
    const output = req.body?.output !== undefined ? str(req.body.output, 60000) : j.output;
    await db.run("UPDATE learn_jobs SET status = ?, output = ?, error = ?, updated_at = ?, published_at = ? WHERE id = ?",
      status, output, status === "queued" ? "" : j.error, iso(), status === "published" ? (j.published_at || iso()) : null, j.id);
    return { job: parseJob(await db.get("SELECT * FROM learn_jobs WHERE id = ?", j.id)) };
  }));
  app.delete("/api/admin/learn/jobs/:id", auth, admin, wrap(async (req) => { await db.run("DELETE FROM learn_jobs WHERE id = ?", Number(req.params.id)); return { ok: true }; }));

  // Published explainers as RSS 2.0: a blog reader or Substack's "import from RSS" can pull these (a person sets that up).
  app.get("/api/learn/feed.xml", wrap(async (req, res) => {
    const rows = await db.all("SELECT id, concept_id, output, published_at FROM learn_jobs WHERE status = 'published' AND kind = 'post' ORDER BY published_at DESC LIMIT 30");
    const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const items = rows.map((r) => {
      const title = (r.output.match(/^#\s+(.+)$/m) || [, L.BY_ID[r.concept_id]?.name || "Explainer"])[1];
      const link = `${base}/m/published-explainer?id=${r.id}`;
      return `<item><title>${xml(title)}</title><link>${xml(link)}</link><guid isPermaLink="false">si-learn-${r.id}</guid><pubDate>${new Date(r.published_at).toUTCString()}</pubDate><description>${xml(r.output)}</description></item>`;
    }).join("");
    res.type("application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Superintelligence Homepage: Learn</title><link>${xml(base)}/m/learn</link><description>Concepts behind superintelligence research, in plain words.</description>${items}</channel></rss>`);
    return undefined;
  }));
  app.get("/api/learn/published/:id", wrap(async (req) => {
    const r = await db.get("SELECT id, concept_id, output, published_at FROM learn_jobs WHERE id = ? AND status = 'published' AND kind = 'post'", Number(req.params.id));
    if (!r) notFound("That post"); return { post: r };
  }));
  app.get("/api/learn/posts/:id", auth, wrap(async (req) => {
    const r = await db.get("SELECT id, concept_id, output, published_at FROM learn_jobs WHERE id = ? AND status = 'published' AND kind = 'post'", Number(req.params.id));
    if (!r) notFound("That post"); return { post: r };
  }));
};
