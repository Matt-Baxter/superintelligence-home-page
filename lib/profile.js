// The site profile: which version runs (modules/profiles.json). SITE_PROFILE=spec (default) or extended.
// Core features outside the shared spec are switched by name; modules by the profile's module list.
const path = require("path");
const P = require(path.join(__dirname, "..", "modules", "profiles.json"));

function current() {
  const name = (process.env.SITE_PROFILE || P.default).trim();
  const p = P.profiles[name];
  if (!p) throw new Error(`Unknown SITE_PROFILE "${name}" (use ${Object.keys(P.profiles).join(" or ")})`);
  return { name, about: p.about, features: new Set(p.features), modules: p.modules };
}
const has = (feature) => current().features.has(feature);
// Express middleware: the route answers 404 when its feature is off in this profile.
const feature = (name) => (req, res, next) => (has(name) ? next() : res.status(404).json({ error: `Not part of this version of the site (${current().name}).` }));
// Filter a module list by the profile ("*" keeps everything).
const modulesFor = (enabled) => { const m = current().modules; return m === "*" ? enabled : enabled.filter((id) => m.includes(id)); };
module.exports = { current, has, feature, modulesFor, PROFILES: P };
