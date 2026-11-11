// Persistence for paper responses (REQ-062, REQ-063, proposed): every save is (1) the current row in
// responses_papers (the index pages read), (2) a new version of the "response" artifact, and (3) the response's named
// graph in the knowledge graph, rewritten so its triples always match the newest version. Claims are the paper's
// (si:claimedBy the paper), never a person's.
const { artifacts } = require("../data/artifacts");
const KG = require("../data/kg");
const MAX_ROWS = 200;
const { iri, si, lit, A, LABEL } = KG;
const responseIri = (slug) => `urn:si:response:${slug}`;
const paperIri = (pkg) => (pkg.url && /^https?:\/\/\S+$/.test(pkg.url) ? pkg.url : `urn:si:paper:${pkg.slug}`);

function triples(pkg, version) {
  const a = pkg.analysis || {}, p = pkg.plan || {}, R = responseIri(pkg.slug), P = paperIri(pkg), L = [];
  const t = (s, pr, o) => L.push(`${iri(s)} ${pr} ${o} .`);
  t(P, A, si("Paper")); t(P, LABEL, lit(pkg.title || a.title || "")); if (a.strength) t(P, si("strength"), lit(a.strength)); if (a.rigor !== undefined) t(P, si("rigor"), lit(a.rigor, "int"));
  if (a.read) t(P, si("readInFull"), lit(!!a.read.fullText, "bool"));
  t(R, A, si("Response")); t(R, si("about"), iri(P)); t(R, si("version"), lit(version, "int")); if (p.search) t(R, si("situation"), lit(p.search.situation));
  if (p.thesis) t(R, si("thesis"), lit(p.thesis));
  (a.contributions || []).forEach((c, i) => { const C = `${R}/claim/${i + 1}`; t(C, A, si("Claim")); t(C, si("text"), lit(c.text)); t(C, si("level"), lit(c.level)); t(C, si("claimedBy"), iri(P)); t(C, si("section"), lit(c.section || "")); if (c.evidence && c.evidence[0]) { t(C, si("evidenceText"), lit(c.evidence[0].text)); t(C, si("evidenceSection"), lit(c.evidence[0].section || "")); } });
  (a.checklist || []).forEach((c) => { const K = `${R}/check/${c.id}`; t(K, A, si("Check")); t(K, LABEL, lit(c.label)); t(K, si("met"), lit(!!c.met, "bool")); t(K, si("points"), lit(c.points, "int")); t(K, si("of"), iri(P)); });
  (a.questions || []).forEach((q, i) => { const Q = `${R}/question/${i + 1}`; t(Q, A, si("Question")); t(Q, si("text"), lit(q.text)); t(Q, si("of"), iri(P)); });
  (p.beats || []).forEach((b, i) => { const B = `${R}/beat/${i + 1}`; t(B, A, si("Beat")); t(B, si("order"), lit(i + 1, "int")); t(B, si("unit"), lit(b.id)); t(B, si("variant"), lit(b.variant || "")); t(B, si("seconds"), lit(Number(b.seconds) || 0, "decimal")); t(B, si("of"), iri(R)); });
  if (pkg.offer && pkg.offer.action) t(R, si("suggestedOffering"), lit(pkg.offer.action));
  const files = (pkg.video && pkg.video.files) || [];
  if (files.length) { const V = `${R}/render/${version}`; t(V, A, si("Artifact")); t(V, si("renderOf"), iri(R)); t(V, si("version"), lit(version, "int")); files.forEach((f) => t(V, si("file"), lit(f))); }
  if (pkg.qa) pkg.qa.forEach((q) => { const Q = `${R}/qa/${q.id}`; t(Q, A, si("QaResult")); t(Q, si("check"), lit(q.id)); t(Q, si("ok"), lit(!!q.ok, "bool")); t(Q, si("of"), iri(R)); });
  return L;
}

// Save a response package (from a build, an edit or a render). Returns { slug, version }.
async function saveResponse(db, pkg, { actor = null, note = "", files = [], expectVersion = null } = {}) {
  const value = JSON.stringify({ ...pkg }), now = db.now();
  const have = await db.get("SELECT id FROM responses_papers WHERE slug = ?", pkg.slug);
  if (!have && (await db.get("SELECT COUNT(*) AS n FROM responses_papers")).n >= MAX_ROWS) { const e = new Error(`The limit is ${MAX_ROWS} responses. Delete old ones first.`); e.status = 400; throw e; }
  // The versioned save decides (and refuses a stale write) first; the row and the graph follow only if it succeeded.
  const v = await artifacts(db).save("response", pkg.slug, { title: pkg.title, body: pkg, note, files, actor, expectVersion });
  if (have) await db.run("UPDATE responses_papers SET title = ?, url = ?, package = ?, updated_at = ? WHERE id = ?", pkg.title, pkg.url || "", value, now, have.id);
  else await db.run("INSERT INTO responses_papers (slug, title, url, package, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)", pkg.slug, pkg.title, pkg.url || "", value, now, now, actor);
  const kg = await KG.open(db);
  await kg.replaceGraph(responseIri(pkg.slug), triples(pkg, v.version));
  return { slug: pkg.slug, version: v.version };
}
async function loadResponse(db, slug, version = null) {
  const art = await artifacts(db).get("response", slug, version);
  if (art) return { pkg: art.body, version: art.version, current: art.current, files: art.files };
  const r = await db.get("SELECT package FROM responses_papers WHERE slug = ?", String(slug));
  return r ? { pkg: JSON.parse(r.package), version: 0, current: 0, files: [] } : null;
}
module.exports = { saveResponse, loadResponse, triples, responseIri, paperIri, MAX_ROWS };
