// GET /api/appearance (public): the options and the site default. PUT /api/admin/appearance (admin): change the default.
const { CATALOG, validate } = require("./settings");
module.exports = function mountAppearance(app, { db, auth, admin, wrap, bad, audit }) {
  const read = async () => { const row = await db.get("SELECT value, updated_at FROM appearance_settings WHERE key = 'site'"); let v = {}; try { v = row ? JSON.parse(row.value) : {}; } catch { v = {}; } let site; try { site = validate(v); } catch { site = validate({}); } return { site, updatedAt: row?.updated_at || null }; };
  const options = () => ({ themes: CATALOG.themes, layouts: CATALOG.layouts, types: CATALOG.types, sizes: CATALOG.sizes, concepts: CATALOG.concepts });
  app.get("/api/appearance", wrap(async (req, res) => { res.set("Cache-Control", "public, max-age=60"); return { ...(await read()), options: options() }; }));
  app.put("/api/admin/appearance", auth, admin, wrap(async (req) => {
    let site; try { site = validate(req.body || {}); } catch (e) { bad(e.message); }
    const value = JSON.stringify(site), now = db.now();
    if (await db.get("SELECT key FROM appearance_settings WHERE key = 'site'")) await db.run("UPDATE appearance_settings SET value = ?, updated_at = ?, updated_by = ? WHERE key = 'site'", value, now, req.user.id);
    else await db.run("INSERT INTO appearance_settings (key, value, updated_at, updated_by) VALUES ('site', ?, ?, ?)", value, now, req.user.id);
    await audit.log(req.user.id, "appearance.default", "site", `${site.concept}: ${site.theme}, ${site.layout}, ${site.type}, ${site.size}; readers ${site.allowReader ? "may" : "may not"} switch`);
    return { site, updatedAt: now };
  }));
};
