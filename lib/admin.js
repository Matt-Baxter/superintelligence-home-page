// Admin layer: every route here requires a signed-in admin. Mounted by server.js.
// Covers harvesting (sources, catalog, discovery, test fetches, runs, OPML), users, moderation, ontology and the audit log.
const db = require("./db");
const feeds = require("./feeds");
const tagger = require("./tagger");

module.exports = function mountAdmin(app, { auth, admin, wrap, str, bad, notFound, bool, KINDS, FORMAT_IDS, harvester, audit }) {
  const A = [auth, admin];
  const now = () => db.now();
  const kindOk = (k) => KINDS.includes(k) && k !== "submitted";
  const num = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };
  const noTwitter = (url) => { if (/(^|\/\/|\.)(twitter\.com|x\.com|nitter\.)/i.test(url)) bad("This homepage doesn't track Twitter/X. Use the person's blog or newsletter instead."); };

  /* ---------------------------------------------------------------- overview */
  app.get("/api/admin/overview", ...A, wrap(async () => {
    const c = async (sql, ...a) => (await db.get(sql, ...a)).n;
    const dayAgo = new Date(Date.now() - 864e5).toISOString(), weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const sources = await db.all("SELECT status, COUNT(*) AS n FROM sources GROUP BY status");
    const failing = await db.all("SELECT id, name, kind, last_error, failures, last_fetched FROM sources WHERE status = 'active' AND COALESCE(failures, 0) > 0 ORDER BY failures DESC, name LIMIT 20");
    const kinds = await db.all(`SELECT COALESCE(src.kind, 'submitted') AS kind, COUNT(DISTINCT l.story_id) AS n FROM story_links l LEFT JOIN sources src ON src.id = l.source_id
      WHERE l.seen_at >= ? GROUP BY COALESCE(src.kind, 'submitted') ORDER BY n DESC`, weekAgo);
    const lastRuns = await db.all(`SELECT r.trigger, MIN(r.started_at) AS started, MAX(r.finished_at) AS finished, COUNT(*) AS sources,
      SUM(CASE WHEN r.status = 'error' THEN 1 ELSE 0 END) AS errors, SUM(r.stored) AS stored FROM fetch_runs r
      WHERE r.started_at >= ? GROUP BY r.trigger, SUBSTR(r.started_at, 1, 16) ORDER BY started DESC LIMIT 10`, weekAgo);
    return {
      engine: db.engine, harvesting: harvester.isRunning(), schedule: process.env.VERCEL ? "Vercel Cron, daily at 12:00 UTC" : Number(process.env.FETCH_MINUTES ?? 30) > 0 ? `checks every ${process.env.FETCH_MINUTES ?? 30} min (local)` : "off; harvest from this page",
      cronConfigured: !!process.env.CRON_SECRET,
      counts: {
        users: await c("SELECT COUNT(*) AS n FROM users"), admins: await c("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1"),
        stories: await c("SELECT COUNT(*) AS n FROM stories"), storiesToday: await c("SELECT COUNT(*) AS n FROM stories WHERE first_seen >= ?", dayAgo),
        hidden: await c("SELECT COUNT(*) AS n FROM stories WHERE COALESCE(hidden, 0) = 1"),
        untagged: await c("SELECT COUNT(*) AS n FROM stories WHERE topics = '[]'"),
        votes: await c("SELECT COUNT(*) AS n FROM votes"), notes: await c("SELECT COUNT(*) AS n FROM notes"), lists: await c("SELECT COUNT(*) AS n FROM lists"),
        agentLog: await c("SELECT COUNT(*) AS n FROM agent_log WHERE status = 'submitted'"),
      },
      sources: Object.fromEntries(sources.map((r) => [r.status, r.n])), failing, kindsThisWeek: kinds, lastRuns,
    };
  }));

  /* ----------------------------------------------------------------- sources */
  app.get("/api/admin/sources", ...A, wrap(async () => {
    const rows = await db.all(`SELECT s.*, u.display_name AS suggested_by_name,
      (SELECT COUNT(DISTINCT story_id) FROM story_links l WHERE l.source_id = s.id) AS stories,
      (SELECT COUNT(*) FROM fetch_runs r WHERE r.source_id = s.id) AS runs
      FROM sources s LEFT JOIN users u ON u.id = s.suggested_by ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, s.kind, s.name`);
    return { sources: rows.map((r) => ({ ...r, verified: bool(r.verified), from_catalog: bool(r.from_catalog) })), kinds: KINDS.filter(kindOk), formats: Object.entries(feeds.FORMATS).map(([id, f]) => ({ id, label: f.label })) };
  }));
  // Try a feed without saving it: shows what would be stored and how it would be tagged.
  app.post("/api/admin/sources/test", ...A, wrap(async (req) => {
    const url = str(req.body.url, 800), format = FORMAT_IDS.includes(req.body.format) ? req.body.format : "rss";
    if (!url) bad("Enter a feed URL."); noTwitter(url);
    try {
      const items = await feeds.fetchSource({ url, format, max_items: 50 });
      return { ok: true, count: items.length, preview: items.slice(0, 6).map((i) => ({ ...i, topics: tagger.tag(i.title, i.summary).topics.filter((t) => !t.via).map((t) => t.label) })) };
    } catch (e) { return { ok: false, error: String(e.cause?.code || e.message) }; }
  }));
  app.post("/api/admin/sources/discover", ...A, wrap(async (req) => {
    const url = str(req.body.url, 800); if (!url) bad("Enter the site's address."); noTwitter(url);
    try { return { page: url, feeds: await feeds.discoverFeeds(url) }; } catch (e) { return { feeds: [], error: String(e.cause?.code || e.message) }; }
  }));
  app.post("/api/admin/sources", ...A, wrap(async (req) => {
    const b = req.body, name = str(b.name, 100), url = str(b.url, 800), kind = str(b.kind, 30);
    const format = FORMAT_IDS.includes(b.format) ? b.format : "rss";
    if (!name || !/^(https?|fixture):\/\//.test(url)) bad("Give the source a name and its feed URL.");
    if (!kindOk(kind)) bad("Pick what kind of source it is."); noTwitter(url);
    if (await db.get("SELECT 1 AS x FROM sources WHERE url = ?", url)) bad("That feed is already listed.");
    const id = await db.insert(`INSERT INTO sources (name, kind, format, url, home, status, suggested_by, interval_minutes, max_items, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      name, kind, format, url, str(b.home, 800), req.user.id, num(b.interval_minutes, 15, 10080, 360), num(b.max_items, 1, 200, 50), now());
    await audit.log(req.user.id, "source.add", `source:${id}`, `${name} (${url})`);
    const run = b.fetchNow === false ? null : await harvester.harvestSource(await db.get("SELECT * FROM sources WHERE id = ?", id), { trigger: "admin", conditional: false });
    return { id, run };
  }));
  app.put("/api/admin/sources/:id", ...A, wrap(async (req) => {
    const s = await db.get("SELECT * FROM sources WHERE id = ?", Number(req.params.id)); if (!s) notFound("That source");
    const b = req.body;
    const status = ["active", "paused", "pending", "rejected"].includes(b.status) ? b.status : s.status;
    const url = b.url !== undefined ? str(b.url, 800) : s.url; if (url !== s.url) noTwitter(url);
    const kind = b.kind !== undefined && kindOk(b.kind) ? b.kind : s.kind;
    const format = FORMAT_IDS.includes(b.format) ? b.format : s.format;
    await db.run(`UPDATE sources SET name = ?, url = ?, home = ?, kind = ?, format = ?, status = ?, interval_minutes = ?, max_items = ?,
        failures = CASE WHEN ? = 1 THEN 0 ELSE failures END, next_due_at = CASE WHEN ? = 1 THEN NULL ELSE next_due_at END,
        etag = CASE WHEN ? = 1 THEN NULL ELSE etag END, last_modified = CASE WHEN ? = 1 THEN NULL ELSE last_modified END WHERE id = ?`,
      str(b.name, 100) || s.name, url, b.home !== undefined ? str(b.home, 800) : s.home, kind, format, status,
      num(b.interval_minutes, 15, 10080, s.interval_minutes || 360), num(b.max_items, 1, 200, s.max_items || 50),
      b.resetFailures ? 1 : 0, b.resetFailures || status !== s.status ? 1 : 0, url !== s.url ? 1 : 0, url !== s.url ? 1 : 0, s.id);
    await audit.log(req.user.id, "source.edit", `source:${s.id}`, JSON.stringify(b).slice(0, 400));
    return { ok: true };
  }));
  app.delete("/api/admin/sources/:id", ...A, wrap(async (req) => {
    const s = await db.get("SELECT * FROM sources WHERE id = ?", Number(req.params.id)); if (!s) notFound("That source");
    await db.run("DELETE FROM sources WHERE id = ?", s.id);
    await audit.log(req.user.id, "source.delete", `source:${s.id}`, `${s.name} (${s.url}); its stories stay`);
    return { ok: true };
  }));
  app.post("/api/admin/sources/:id/harvest", ...A, wrap(async (req) => {
    const s = await db.get("SELECT * FROM sources WHERE id = ?", Number(req.params.id)); if (!s) notFound("That source");
    const run = await harvester.harvestSource(s, { trigger: "admin", conditional: false });
    await audit.log(req.user.id, "harvest.source", `source:${s.id}`, `${run.status}, ${run.stored} new`);
    return { run };
  }));
  app.post("/api/admin/harvest", ...A, wrap(async (req) => {
    const r = await harvester.harvest({ trigger: "admin", force: req.body.force === true });
    await audit.log(req.user.id, "harvest.run", req.body.force ? "all (forced)" : "due", r.skipped ? "skipped" : `${r.ok} ok, ${r.errors} errors, ${r.stored} new`);
    return r;
  }));
  app.get("/api/admin/runs", ...A, wrap(async (req) => {
    const w = ["1=1"], a = [];
    if (req.query.source) { w.push("r.source_id = ?"); a.push(Number(req.query.source)); }
    if (["ok", "error", "not_modified"].includes(req.query.status)) { w.push("r.status = ?"); a.push(req.query.status); }
    return { runs: await db.all(`SELECT r.*, s.name AS source FROM fetch_runs r LEFT JOIN sources s ON s.id = r.source_id WHERE ${w.join(" AND ")} ORDER BY r.id DESC LIMIT ?`, ...a, num(req.query.limit, 1, 500, 100)) };
  }));

  /* ----------------------------------------------------------------- catalog */
  // SOURCE_CATALOG lets the sample-data servers swap in test/fixtures/sample-catalog.json.
  const catalog = () => JSON.parse(require("node:fs").readFileSync(process.env.SOURCE_CATALOG || require("node:path").join(__dirname, "source-catalog.json"), "utf8"));
  app.get("/api/admin/catalog", ...A, wrap(async () => {
    const cat = catalog();
    const have = new Set((await db.all("SELECT url FROM sources")).map((r) => r.url));
    return { about: cat.about, sources: cat.sources.map((s) => ({ ...s, added: have.has(s.url) })) };
  }));
  app.post("/api/admin/catalog/enable", ...A, wrap(async (req) => {
    const urls = new Set((Array.isArray(req.body.urls) ? req.body.urls : []).map(String));
    const pick = catalog().sources.filter((s) => urls.has(s.url)); if (!pick.length) bad("Pick at least one source from the catalog.");
    const added = [];
    for (const s of pick) {
      if (await db.get("SELECT 1 AS x FROM sources WHERE url = ?", s.url)) continue;
      added.push(await db.insert(`INSERT INTO sources (name, kind, format, url, home, status, from_catalog, suggested_by, created_at) VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
        s.name, s.kind, s.format, s.url, s.home || "", req.user.id, now()));
    }
    await audit.log(req.user.id, "catalog.enable", `${added.length} sources`, pick.map((s) => s.name).join(", "));
    // Test-fetch what was added, so the admin sees right away which feeds work.
    const runs = [];
    for (const id of added) runs.push(await harvester.harvestSource(await db.get("SELECT * FROM sources WHERE id = ?", id), { trigger: "admin", conditional: false }));
    return { added: added.length, runs };
  }));

  /* -------------------------------------------------------------------- OPML */
  const xmlEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  app.get("/api/admin/opml", ...A, wrap(async (req, res) => {
    const rows = await db.all("SELECT * FROM sources WHERE status = 'active' ORDER BY kind, name");
    const byKind = {}; rows.forEach((r) => (byKind[r.kind] ||= []).push(r));
    const body = Object.entries(byKind).map(([k, list]) => `    <outline text="${xmlEsc(k)}">\n${list.map((r) => `      <outline type="rss" text="${xmlEsc(r.name)}" title="${xmlEsc(r.name)}" xmlUrl="${xmlEsc(r.url)}" htmlUrl="${xmlEsc(r.home)}" siFormat="${xmlEsc(r.format)}" siKind="${xmlEsc(r.kind)}"/>`).join("\n")}\n    </outline>`).join("\n");
    res.type("text/x-opml").set("Content-Disposition", 'attachment; filename="si-homepage-sources.opml"')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>Superintelligence Homepage sources</title><dateCreated>${new Date().toUTCString()}</dateCreated></head>\n  <body>\n${body}\n  </body>\n</opml>\n`);
  }));
  app.post("/api/admin/opml", ...A, wrap(async (req) => {
    const text = typeof req.body.opml === "string" ? req.body.opml.slice(0, 1_000_000) : "";
    const kind = kindOk(req.body.kind) ? req.body.kind : "newsletter";
    const attr = (tag, a) => { const m = tag.match(new RegExp(`\\b${a}=["']([^"']*)["']`, "i")); return m ? feeds.stripHtml(m[1]) : ""; };
    const outlines = [...text.matchAll(/<outline\b[^>]*\bxmlUrl=[^>]*>/gi)].map((m) => m[0]);
    if (!outlines.length) bad("No feeds found. Paste an OPML file (outlines with xmlUrl).");
    let added = 0, skipped = 0;
    for (const o of outlines.slice(0, 300)) {
      const url = attr(o, "xmlUrl"); const name = attr(o, "title") || attr(o, "text") || url;
      if (!/^https?:\/\//.test(url) || /(twitter\.com|x\.com|nitter\.)/i.test(url) || await db.get("SELECT 1 AS x FROM sources WHERE url = ?", url)) { skipped++; continue; }
      const k = kindOk(attr(o, "siKind")) ? attr(o, "siKind") : kind, f = FORMAT_IDS.includes(attr(o, "siFormat")) ? attr(o, "siFormat") : "rss";
      await db.run("INSERT INTO sources (name, kind, format, url, home, status, suggested_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        name.slice(0, 100), k, f, url, attr(o, "htmlUrl"), req.body.activate ? "active" : "pending", req.user.id, now());
      added++;
    }
    await audit.log(req.user.id, "opml.import", `${added} sources`, `${skipped} skipped`);
    return { added, skipped, status: req.body.activate ? "active" : "pending" };
  }));

  /* ------------------------------------------------------------------- users */
  app.get("/api/admin/users", ...A, wrap(async () => ({
    users: (await db.all(`SELECT u.id, u.username, u.display_name, u.is_admin, u.disabled, u.created_at,
      (SELECT COUNT(*) FROM votes v WHERE v.user_id = u.id) AS votes, (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id) AS notes,
      (SELECT COUNT(*) FROM agent_log a WHERE a.author_id = u.id AND a.status = 'submitted') AS log_entries,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS sessions
      FROM users u ORDER BY u.id`, Date.now())).map((u) => ({ ...u, is_admin: bool(u.is_admin), disabled: bool(u.disabled) })),
  })));
  app.put("/api/admin/users/:id", ...A, wrap(async (req) => {
    const u = await db.get("SELECT * FROM users WHERE id = ?", Number(req.params.id)); if (!u) notFound("That user");
    const makeAdmin = req.body.admin === undefined ? bool(u.is_admin) : !!req.body.admin;
    const disabled = req.body.disabled === undefined ? bool(u.disabled) : !!req.body.disabled;
    if (u.id === req.user.id && (!makeAdmin || disabled)) bad("You can't remove your own admin rights or disable yourself. Ask another admin.");
    if (!makeAdmin && bool(u.is_admin) && (await db.get("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1")).n <= 1) bad("There has to be at least one admin.");
    await db.run("UPDATE users SET is_admin = ?, disabled = ? WHERE id = ?", makeAdmin ? 1 : 0, disabled ? 1 : 0, u.id);
    if (disabled) await db.run("DELETE FROM sessions WHERE user_id = ?", u.id);
    await audit.log(req.user.id, "user.edit", `user:${u.username}`, `admin=${makeAdmin}, disabled=${disabled}`);
    return { ok: true };
  }));

  /* -------------------------------------------------------------- moderation */
  app.get("/api/admin/stories", ...A, wrap(async (req) => {
    const w = ["1=1"], a = [];
    const q = str(req.query.q, 100).toLowerCase(); if (q) { w.push("(LOWER(s.title) LIKE ? OR LOWER(s.url) LIKE ?)"); a.push(`%${q}%`, `%${q}%`); }
    if (req.query.hidden === "1") w.push("COALESCE(s.hidden, 0) = 1");
    if (req.query.untagged === "1") w.push("s.topics = '[]'");
    const rows = await db.all(`SELECT s.id, s.title, s.url, s.first_seen, s.published_at, s.hidden, s.hidden_reason, s.topics,
      (SELECT COUNT(*) FROM votes v WHERE v.story_id = s.id) AS votes, (SELECT COUNT(*) FROM story_links l WHERE l.story_id = s.id) AS links
      FROM stories s WHERE ${w.join(" AND ")} ORDER BY s.id DESC LIMIT ?`, ...a, num(req.query.limit, 1, 500, 100));
    return { stories: rows.map((r) => ({ ...r, hidden: bool(r.hidden), topics: JSON.parse(r.topics || "[]").filter((t) => !t.via).map((t) => t.label) })) };
  }));
  app.put("/api/admin/stories/:id", ...A, wrap(async (req) => {
    const s = await db.get("SELECT id, title FROM stories WHERE id = ?", Number(req.params.id)); if (!s) notFound("That story");
    const hidden = !!req.body.hidden;
    await db.run("UPDATE stories SET hidden = ?, hidden_reason = ? WHERE id = ?", hidden ? 1 : 0, hidden ? str(req.body.reason, 200) : "", s.id);
    await audit.log(req.user.id, hidden ? "story.hide" : "story.unhide", `story:${s.id}`, `${s.title.slice(0, 120)}${req.body.reason ? ` (${str(req.body.reason, 200)})` : ""}`);
    return { ok: true };
  }));
  app.get("/api/admin/notes", ...A, wrap(async () => ({
    notes: await db.all(`SELECT n.id, n.text, n.created_at, u.username, s.title AS story, s.id AS story_id FROM notes n JOIN users u ON u.id = n.user_id
      JOIN stories s ON s.id = n.story_id WHERE n.private = 0 ORDER BY n.id DESC LIMIT 200`),
  })));
  app.delete("/api/admin/notes/:id", ...A, wrap(async (req) => {
    const n = await db.get("SELECT n.id, n.text, n.private, u.username FROM notes n JOIN users u ON u.id = n.user_id WHERE n.id = ?", Number(req.params.id)); if (!n) notFound("That note");
    if (bool(n.private)) bad("Private notes are only visible to their author, so admins don't moderate them.");
    await db.run("DELETE FROM notes WHERE id = ?", n.id);
    await audit.log(req.user.id, "note.delete", `note:${n.id}`, `by ${n.username}: ${n.text.slice(0, 120)}`);
    return { ok: true };
  }));

  /* ---------------------------------------------------------------- ontology */
  app.get("/api/admin/ontology", ...A, wrap(async () => {
    const counts = Object.fromEntries((await db.all("SELECT topic, COUNT(*) AS n FROM story_topics GROUP BY topic")).map((r) => [r.topic, r.n]));
    return { about: tagger.ontology.about, topics: tagger.ontology.topics.map((t) => ({ ...t, stories: counts[t.id] || 0 })), organizations: tagger.ontology.organizations,
      untagged: (await db.get("SELECT COUNT(*) AS n FROM stories WHERE topics = '[]'")).n };
  }));
  app.post("/api/admin/retag", ...A, wrap(async (req) => {
    const r = await harvester.retagAll();
    await audit.log(req.user.id, "ontology.retag", `${r.stories} stories`);
    return r;
  }));

  /* ------------------------------------------------------------------- audit */
  app.get("/api/admin/audit", ...A, wrap(async () => ({
    entries: await db.all("SELECT a.*, u.username FROM admin_audit a LEFT JOIN users u ON u.id = a.admin_id ORDER BY a.id DESC LIMIT 300"),
  })));
};
