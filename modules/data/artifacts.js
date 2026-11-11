// Versioned artifacts (REQ-062, proposed): anything the site generates, kept as numbered versions with a note, the
// actor and file references ({path, bytes, sha256, kind}). Newest KEEP versions per artifact; restoring an old
// version makes a new one. Files themselves live where they were made (out/ on the machine that rendered them).
const KEEP = 20;
const MAX_BODY = 600000; // characters of JSON per version
function artifacts(db) {
  const now = () => (db.now ? db.now() : new Date().toISOString());
  const head = (kind, key) => db.get("SELECT id, kind, akey, title, current_version, created_at, updated_at FROM data_artifacts WHERE kind = ? AND akey = ?", kind, key);
  // expectVersion: refuse (409) unless the current version is still this one. Checked inside the transaction with the
  // artifact's row locked (FOR UPDATE on Postgres; SQLite transactions are serialised), so two writers that both read
  // version N can't both save N+1 (REQ-069, proposed).
  async function save(kind, key, { title = "", body, note = "", files = [], actor = null, expectVersion = null }) {
    const json = JSON.stringify(body ?? null);
    if (json.length > MAX_BODY) { const e = new Error(`That ${kind} is ${json.length} characters; the limit is ${MAX_BODY}.`); e.status = 400; throw e; }
    return db.tx(async (t) => {
      let a = await t.get(`SELECT id, current_version FROM data_artifacts WHERE kind = ? AND akey = ?${t.engine === "pg" ? " FOR UPDATE" : ""}`, kind, key), at = now();
      if (expectVersion !== null && expectVersion !== undefined && (a ? a.current_version : 0) !== expectVersion) {
        const last = a ? await t.get("SELECT v.note, v.at, u.username FROM data_artifact_versions v LEFT JOIN users u ON u.id = v.actor_id WHERE v.artifact_id = ? AND v.version = ?", a.id, a.current_version) : null;
        const e = new Error(`Version ${a ? a.current_version : 0} was saved${last && last.username ? ` by ${last.username}` : ""}${last && last.note ? ` (${last.note})` : ""} at ${(last && last.at) || "?"}, after the version ${expectVersion} you were editing. Nothing was saved; reload and make your change again.`);
        e.status = 409; throw e;
      }
      if (!a) { const id = await t.insert("INSERT INTO data_artifacts (kind, akey, title, current_version, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)", kind, key, String(title).slice(0, 300), at, at); a = { id, current_version: 0 }; }
      const v = a.current_version + 1;
      await t.run("INSERT INTO data_artifact_versions (artifact_id, version, body, files, note, actor_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)", a.id, v, json, JSON.stringify(files || []), String(note).slice(0, 300), actor, at);
      await t.run("UPDATE data_artifacts SET current_version = ?, title = COALESCE(NULLIF(?, ''), title), updated_at = ? WHERE id = ?", v, String(title).slice(0, 300), at, a.id);
      await t.run("DELETE FROM data_artifact_versions WHERE artifact_id = ? AND version <= ?", a.id, v - KEEP);
      return { id: a.id, kind, key, version: v };
    });
  }
  async function get(kind, key, version = null) {
    const a = await head(kind, key); if (!a) return null;
    const v = await db.get("SELECT version, body, files, note, actor_id, at FROM data_artifact_versions WHERE artifact_id = ? AND version = ?", a.id, version || a.current_version);
    if (!v) return null;
    return { kind, key, title: a.title, current: a.current_version, version: v.version, body: JSON.parse(v.body), files: JSON.parse(v.files || "[]"), note: v.note, actor: v.actor_id, at: v.at };
  }
  async function history(kind, key) {
    const a = await head(kind, key); if (!a) return [];
    return db.all("SELECT version, note, files, actor_id, at FROM data_artifact_versions WHERE artifact_id = ? ORDER BY version DESC", a.id).then((rows) => rows.map((r) => ({ ...r, files: JSON.parse(r.files || "[]") })));
  }
  const list = (kind, limit = 100) => db.all(`SELECT kind, akey AS key, title, current_version AS version, updated_at FROM data_artifacts ${kind ? "WHERE kind = ?" : ""} ORDER BY updated_at DESC, id DESC LIMIT ${Math.min(500, Number(limit) || 100)}`, ...(kind ? [kind] : []));
  async function restore(kind, key, version, actor, expectVersion = null) {
    const old = await get(kind, key, version); if (!old) { const e = new Error(`${kind} ${key} has no version ${version}.`); e.status = 404; throw e; }
    return save(kind, key, { title: old.title, body: old.body, files: old.files, note: `restored version ${version}`, actor, expectVersion });
  }
  return { save, get, history, list, restore, KEEP };
}
module.exports = { artifacts, KEEP };
