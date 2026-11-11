// Paper responses routes (REQ-056..059, proposed). Everything except the flag routes answers 404 unless the
// "responses" flag lets this request see it (flags.js); building, deleting and drafting are admin-only in any mode.
//   GET  /api/admin/features                 flags and their modes (admin)
//   PUT  /api/admin/features                 change a flag (admin, audited)
//   GET  /api/responses                      list (newest 50)
//   GET  /api/responses/:slug                one package: analysis, plan, checks, article, posts, storyboard
//   GET  /api/responses/:slug/storyboard     beats for the browser explainer (/m/explainer?r=<slug>)
//   POST /api/admin/responses                build the text parts from { source } (arXiv id or URL) or { title, url, text }
//   DELETE /api/admin/responses/:slug
//   POST /api/admin/responses/:slug/draft    save the article as an Editorial CMS draft (action "generate")
// The web server never renders video: that runs where Manim is installed (scripts/respond.js --render).
const flags = require("./flags"), reader = require("./reader"), { respond } = require("./respond");
const MAX_ROWS = 200;
module.exports = function mountResponses(app, { db, auth, admin, wrap, bad, notFound, audit }) {
  const A = [auth, admin];
  const gate = async (req) => { const { flags: f } = await flags.read(db); if (!flags.visible(f.responses, req.user)) notFound("That page"); return f.responses; };
  const row = async (slug) => { const r = await db.get("SELECT id, slug, title, url, package, created_at, updated_at FROM responses_papers WHERE slug = ?", String(slug)); if (!r) notFound("That response"); return { ...r, package: JSON.parse(r.package) }; };

  app.get("/api/admin/features", ...A, wrap(async () => ({ ...(await flags.read(db)), options: Object.entries(flags.FLAGS).map(([id, f]) => ({ id, ...f, modes: flags.MODES })) })));
  app.put("/api/admin/features", ...A, wrap(async (req) => {
    let change; try { change = flags.validate(req.body || {}); } catch (e) { bad(e.message); }
    if (!Object.keys(change).length) bad("Name a feature and its mode, for example { \"responses\": \"staff\" }.");
    const { flags: cur } = await flags.read(db), next = { ...cur, ...change }, value = JSON.stringify(next), now = db.now();
    if (await db.get("SELECT key FROM appearance_settings WHERE key = 'features'")) await db.run("UPDATE appearance_settings SET value = ?, updated_at = ?, updated_by = ? WHERE key = 'features'", value, now, req.user.id);
    else await db.run("INSERT INTO appearance_settings (key, value, updated_at, updated_by) VALUES ('features', ?, ?, ?)", value, now, req.user.id);
    await audit.log(req.user.id, "features.set", "features", Object.entries(change).map(([k, v]) => `${k}: ${cur[k]} -> ${v}`).join("; "));
    return { flags: next, updatedAt: now };
  }));

  app.get("/api/responses", wrap(async (req) => {
    const mode = await gate(req);
    const rows = await db.all("SELECT slug, title, url, package, updated_at FROM responses_papers ORDER BY updated_at DESC, id DESC LIMIT 50");
    return { mode, responses: rows.map((r) => { const p = JSON.parse(r.package), a = p.analysis || {}; return { slug: r.slug, title: r.title, url: r.url, updatedAt: r.updated_at, rigor: a.rigor, strength: a.strength, fullText: a.read && a.read.fullText, thesis: p.plan && p.plan.thesis, video: !!(p.video && p.video.files && p.video.files.includes("video.mp4")) }; }) };
  }));
  app.get("/api/responses/:slug", wrap(async (req) => { const mode = await gate(req); const r = await row(req.params.slug); return { mode, slug: r.slug, updatedAt: r.updated_at, ...r.package }; }));
  app.get("/api/responses/:slug/storyboard", wrap(async (req) => { await gate(req); return { storyboard: (await row(req.params.slug)).package.storyboard }; }));

  app.post("/api/admin/responses", ...A, wrap(async (req) => {
    await gate(req);
    const b = req.body || {}; let input;
    if (typeof b.text === "string" && b.text.trim()) {
      if (b.text.length > 400000) bad("Paste at most 400,000 characters of paper text.");
      const t = String(b.title || "").trim(); if (!t || t.length > 300) bad("Give the paper's title (at most 300 characters).");
      const u = String(b.url || "").trim(); if (u && !/^https:\/\/[^\s]+$/.test(u)) bad("The link must start with https://.");
      if (/^https?:\/\/([^/]*\.)?(twitter\.com|x\.com|nitter\.[^/]+)(\/|$)/i.test(u)) bad("This homepage doesn't track Twitter/X. Link to the paper itself.");
      input = /<section|<div|<html/i.test(b.text.slice(0, 5000)) ? reader.fromHtml(b.text, { title: t, url: u || null }) : reader.fromText(b.text, { title: t, url: u || null });
    } else if (typeof b.source === "string" && /\d{4}\.\d{4,5}/.test(b.source)) input = b.source.trim();
    else bad("Give an arXiv id or link as source, or paste the paper's text with its title.");
    let pkg; try { pkg = await respond(input, { site: (process.env.SITE_URL || "").replace(/\/$/, "") }); } catch (e) { bad(`Couldn't read that paper: ${e.message}`); }
    const value = JSON.stringify({ ...pkg, video: null }), now = db.now();
    const have = await db.get("SELECT id FROM responses_papers WHERE slug = ?", pkg.slug);
    if (have) await db.run("UPDATE responses_papers SET title = ?, url = ?, package = ?, updated_at = ? WHERE id = ?", pkg.title, pkg.url || "", value, now, have.id);
    else {
      if ((await db.get("SELECT COUNT(*) AS n FROM responses_papers")).n >= MAX_ROWS) bad(`The limit is ${MAX_ROWS} responses. Delete old ones first.`);
      await db.run("INSERT INTO responses_papers (slug, title, url, package, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)", pkg.slug, pkg.title, pkg.url || "", value, now, now, req.user.id);
    }
    await audit.log(req.user.id, "responses.build", `response:${pkg.slug}`, `${pkg.analysis.read.fullText ? "full text" : "abstract only"}; rigor ${pkg.analysis.rigor}`);
    return { slug: pkg.slug, summary: pkg.analysis.summary, checks: pkg.checks };
  }));
  app.delete("/api/admin/responses/:slug", ...A, wrap(async (req) => {
    await gate(req); const r = await row(req.params.slug);
    await db.run("DELETE FROM responses_papers WHERE id = ?", r.id); await audit.log(req.user.id, "responses.delete", `response:${r.slug}`, r.title.slice(0, 120));
    return { ok: true };
  }));
  // The article becomes an ordinary Editorial CMS draft whose first revision says "generate"; a person publishes it.
  app.post("/api/admin/responses/:slug/draft", ...A, wrap(async (req) => {
    await gate(req); const r = await row(req.params.slug), p = r.package;
    const title = `Response: ${r.title}`.slice(0, 160), summary = String(p.plan.thesis).slice(0, 300), body = String(p.article).slice(0, 20000);
    const slug = `response-${r.slug}`.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90) + "-" + Date.now().toString(36);
    const now = db.now();
    const id = await db.tx(async (t) => {
      if (db.engine === "pg") await t.get("SELECT pg_advisory_xact_lock(193628, 200)");
      if ((await t.get("SELECT COUNT(*) AS n FROM editorial_posts")).n >= 200) bad("The content limit is 200 posts. Export and review the archive before adding more.");
      const pid = await t.insert("INSERT INTO editorial_posts (slug, title, summary, body, status, revision, created_by, updated_by, updated_at) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?)", slug, title, summary, body, req.user.id, req.user.id, now);
      await t.run("INSERT INTO editorial_revisions (post_id, revision, title, summary, body, status, actor_id, action, at) VALUES (?, 1, ?, ?, ?, 'draft', ?, 'generate', ?)", pid, title, summary, body, req.user.id, now);
      await t.run("INSERT INTO admin_audit (admin_id, action, target, detail, at) VALUES (?, ?, ?, ?, ?)", req.user.id, "editorial.generate", `post:${pid}`, `from response:${r.slug}`, now);
      return pid;
    });
    return { id, slug, editor: `/m/editorial?post=${id}` };
  }));
};
