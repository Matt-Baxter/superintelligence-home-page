// Records admin actions (who did what, to what, when) so moderation and source changes are accountable.
const db = require("./db");
exports.log = (adminId, action, target = "", detail = "") =>
  db.run("INSERT INTO admin_audit (admin_id, action, target, detail, at) VALUES (?, ?, ?, ?, ?)", adminId, action, String(target).slice(0, 200), String(detail).slice(0, 500), db.now()).catch(() => {});
