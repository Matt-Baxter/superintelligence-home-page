// Feature flags in the CMS meta layer (REQ-059, proposed): one JSON row, key 'features', in the appearance module's
// appearance_settings table, so the site's switches live next to its look and are changed the same audited way.
// A flag is off (nobody sees it), staff (admins only: "behind the curtain") or public (readers may view; building
// and publishing stay admin-only). Unknown flags and values are refused.
const FLAGS = {
  responses: { label: "Paper responses", default: "staff", about: "Per-paper analysis, plan, explainer video, article and posts (/m/responses)." },
};
const MODES = ["off", "staff", "public"];
function validate(input = {}) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!FLAGS[k]) throw new Error(`Unknown feature "${k}".`);
    if (!MODES.includes(v)) throw new Error(`${FLAGS[k].label} must be one of: ${MODES.join(", ")}.`);
    out[k] = v;
  }
  return out;
}
const resolve = (stored = {}) => Object.fromEntries(Object.entries(FLAGS).map(([k, f]) => [k, MODES.includes(stored[k]) ? stored[k] : f.default]));
async function read(db) {
  let row = null; try { row = await db.get("SELECT value, updated_at FROM appearance_settings WHERE key = 'features'"); } catch { row = null; }
  let v = {}; try { v = row ? JSON.parse(row.value) : {}; } catch { v = {}; }
  return { flags: resolve(v), updatedAt: row?.updated_at || null };
}
// Can this request see a feature? off: nobody; staff: admins; public: everyone.
const visible = (mode, user) => mode === "public" || (mode === "staff" && !!(user && user.admin));
module.exports = { FLAGS, MODES, validate, resolve, read, visible };
