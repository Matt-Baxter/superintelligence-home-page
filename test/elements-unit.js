#!/usr/bin/env node
// Element descriptors (proposed REQ-072..REQ-075, spec 010, openspec/changes/add-element-descriptors): the portable
// package, the SQL provider, the catalog over the whole repo, data checked against generated shapes and keys, another
// repo's records (a Sample vibe-coding checkout), plugin providers, and the routes. Synthetic data only.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
process.env.SITE_PROFILE = "extended"; process.env.FETCH_MINUTES = "0"; process.env.ALLOW_FIXTURE_FEEDS = "1";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-el-")); process.env.WORK_OUT = fs.mkdtempSync(path.join(os.tmpdir(), "si-el-out-"));
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ""; delete process.env.POSTGRES_URL; process.env.KG_ENGINE = process.env.KG_ENGINE || "oxigraph";
process.env.VIBE_REPO = path.join(__dirname, "fixtures", "vibe");
const E = require("../packages/si-elements"), SQL = require("../modules/elements/sql"), V = require("../modules/elements/vibe"), Shacl = require("../modules/graph/shacl");
const { Store } = require("oxigraph");

(async () => {
  console.log("REQ-072: the portable descriptor");
  const good = { id: "table:sample_votes", kind: "table", label: "sample_votes", description: "Sample upvotes for the test (test data).", tags: ["domain:sample"],
    properties: { user_id: { type: "integer", required: true, description: "Voter." }, story_id: { type: "integer", required: true, description: "Story." }, weight: { type: "integer", min: 1, max: 3, description: "Weight." }, kind: { type: "string", enum: ["up", "down"], description: "Kind." }, created_at: { type: "dateTime", description: "When." } },
    keys: { surrogate: null, primary: ["user_id", "story_id"], natural: [] }, grain: { statement: "one row per user per story", keys: ["user_id", "story_id"] },
    relationships: [{ rel: "story", target: "table:sample_stories", direction: "out", via: "story_id", cardinality: "1" }], lifecycle: { persistence: "perpetual" }, series: { time: "created_at", cadence: "event" } };
  ok(E.validate(good).length === 0 && E.completeness(good).score === 1, "a full descriptor validates and is complete");
  const bad = E.validate({ id: "sample", kind: "thing", properties: { a: { type: "blob" } }, keys: { primary: ["zz"] }, relationships: [{ rel: "x", target: "t", direction: "sideways", cardinality: "many" }], lifecycle: { persistence: "forever" } });
  ok(bad.length === 8, `a broken one names every problem (${bad.length}: ${bad.map((x) => x.split(": ")[1]).join("; ")})`);
  const thin = E.completeness({ id: "table:sample", kind: "table", properties: { at: { type: "dateTime" } } });
  ok(thin.missing.join() === "description,tags,lifecycle,keys,grain,property descriptions,series", `completeness lists what's missing (${thin.score})`);
  const merged = E.merge(good, { aliases: ["upvote"], tags: ["pii:none"], properties: { weight: { unit: "points" } } });
  ok(merged.aliases.join() === "upvote" && merged.tags.join() === "domain:sample,pii:none" && merged.properties.weight.unit === "points" && merged.properties.weight.min === 1, "an overlay adds aliases, tags and property facts without losing generated ones");
  const ai = E.aliasIndex([merged, { id: "table:sample_likes", kind: "table", aliases: ["upvote"] }]);
  ok(ai.resolve("UPVOTE") === "table:sample_votes" && ai.resolve("sample_votes") === "table:sample_votes" && ai.conflicts.length === 1, "aliases resolve case-blind, and an alias two elements claim is a conflict");
  const ttl = E.toShacl([good]), shapes = Shacl.loadShapes(ttl);
  ok(shapes.length === 1 && shapes[0].properties.length === 5 && /sh:sparql/.test(ttl) && /one row per user per story/.test(ttl), "SHACL: one node shape with a property shape per property, keys as SHACL-SPARQL, the grain as a comment");
  const st = new Store(); st.load(E.toQuads([merged]).join("\n"), { format: "application/n-quads" });
  ok([...st.query("SELECT ?g WHERE { GRAPH ?g { ?e <https://superintelligence-homepage.example/ns#grain> \"one row per user per story\" ; <https://superintelligence-homepage.example/ns#alias> \"upvote\" } }")].length === 1, "the descriptor itself loads as N-Quads in the urn:si:elements graph");
  const ld = E.toJsonLd([good]); ok(ld["@graph"][0]["@id"] === "urn:si:element:table:sample_votes" && ld["@context"]["@vocab"] === E.NS, "and as JSON-LD");

  console.log("REQ-072: rows against keys, grain and shapes");
  const rows = [{ user_id: 1, story_id: 10, weight: 2, kind: "up", created_at: "2026-11-06T12:00:00Z" }, { user_id: 1, story_id: 11, weight: 9, kind: "sideways", created_at: "yesterday" }, { user_id: 1, story_id: 10, weight: 1, kind: "up" }, { user_id: null, story_id: 12 }];
  const pr = E.checkRows(good, rows, { lookup: (t, v) => v !== 11 }), rules = [...new Set(pr.map((x) => x.rule))].sort().join();
  ok(rules === "enum,grain,primary,reference,required", `key, grain, enum, required and reference problems are found (${rules})`);
  const quads = rows.flatMap((r) => E.rowToQuads(good, r).quads.map((q) => q.replace(/ <urn:si:data:[^>]+> \.$/, " .")));
  const v = Shacl.validate(Shacl.loadShapes(E.toShacl([{ ...good, relationships: [] }])), quads.join("\n"));
  ok(!v.conforms && v.results.some((x) => /createdAt/.test(x.path) && /isn't a dateTime/.test(x.message)) && v.results.some((x) => /_kind$/.test(x.path)) && v.results.some((x) => /_weight$/.test(x.path) && /above 3/.test(x.message)), `SHACL on the rows' quads catches a bad date, an off-list value and an out-of-range number (${v.results.length} violations)`);
  ok(E.rowToQuads(good, rows[3]).subject === null, "a row with no key value gets no subject rather than a made-up one");
  const loops = E.checkRows({ id: "table:sample_deps", kind: "table", constraints: [{ id: "a", kind: "acyclic", on: ["a", "b"] }] }, [{ a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 1 }]);
  ok(loops.length === 1 && /1 → 2 → 3 → 1/.test(loops[0].message), "an acyclic constraint finds a loop in the rows");

  console.log("REQ-072: descriptors from SQL");
  const sql = `CREATE TABLE IF NOT EXISTS sample_users (id \${ID}, username TEXT NOT NULL, created_at TEXT DEFAULT \${T});
CREATE UNIQUE INDEX IF NOT EXISTS idx_su ON sample_users (LOWER(username));
CREATE TABLE IF NOT EXISTS sample_follows (user_id INTEGER REFERENCES sample_users(id) ON DELETE CASCADE, other_id INTEGER NOT NULL REFERENCES sample_users(id), weight REAL DEFAULT 1, PRIMARY KEY (user_id, other_id), CHECK (user_id <> other_id));
CREATE INDEX IF NOT EXISTS idx_sf ON sample_follows(other_id);`;
  const parsed = SQL.parse(sql, "sample.js"), ds = SQL.describe(parsed), u = ds.find((d) => d.id === "table:sample_users"), f = ds.find((d) => d.id === "table:sample_follows");
  ok(u.keys.surrogate === "id" && JSON.stringify(u.keys.natural) === '[["username"]]' && u.grain.statement === "one row per username" && u.series.time === "created_at" && u.properties.created_at.type === "dateTime", "a surrogate id, a natural key from a unique index (LOWER), the grain it implies, and a time series");
  ok(!f.keys.surrogate && f.keys.primary.join() === "user_id,other_id" && f.grain.statement === "one row per user per other" && f.relationships.length === 2 && f.relationships[0].onDelete === "cascade" && f.relationships[0].cardinality === "1" && f.constraints.some((c) => c.kind === "check") && f.properties.weight.type === "decimal", "a composite key is the grain; references keep direction, cardinality and on delete; CHECK becomes a constraint");

  console.log("REQ-073: the catalog over the whole repo");
  const { app, boot, db, ingestItems } = require("../server"); await boot();
  const M = require("../modules/elements/module").lib; M.reset();
  const k = await M.catalog({ db });
  const byKind = {}; for (const d of k.descs) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
  ok(byKind.table >= 39 && byKind.type >= 12 && byKind.operation >= 30 && byKind.module >= 20 && byKind.requirement >= 74 && byKind.task >= 100 && byKind.learning >= 20 && byKind.collection === 2, `every kind is described (${Object.entries(byKind).map(([a, b]) => `${b} ${a}`).join(", ")})`);
  ok(k.invalid.length === 0 && k.errors.length === 0 && k.unknownOverlay.length === 0, `every descriptor is valid and every overlay entry matches an element (${k.invalid.length} invalid)`);
  const tables = k.descs.filter((d) => d.kind === "table");
  ok(tables.every((d) => d.description && d.keys && (d.keys.surrogate || d.keys.primary) && d.grain && d.grain.statement && d.lifecycle && (d.tags || []).length), "every table has a description, keys, a grain, a lifecycle and tags");
  const comp = k.descs.map((d) => E.completeness(d).score), mean = comp.reduce((s, x) => s + x, 0) / comp.length;
  ok(mean >= 0.95, `mean completeness ${mean.toFixed(3)} across ${comp.length} elements`);
  const g = E.dag(k.descs), acyclicEdges = g.edges.filter((e) => e.acyclic).length;
  ok(g.violations.length === 0 && g.dangling.length === 0 && acyclicEdges > 50, `relations declared acyclic (module requires, task depends-on: ${acyclicEdges} edges) form a DAG, and no relationship points at nothing`);
  const known = k.aliases.conflicts.every((c) => /REQ-03[2-5]/.test(c.alias));
  ok(known, `the only alias conflicts are the known REQ-032..REQ-035 collision between specs 002 and 003 (${k.aliases.conflicts.length})`);
  ok(k.aliases.resolve("bookmark") === "table:saves" && k.aliases.resolve("req:REQ-056") === "requirement:006-REQ-056" && k.aliases.resolve("feature flags") === "table:appearance_settings", "people's words resolve to elements: bookmark → saves, req:REQ-056 → its requirement");
  const allShapes = Shacl.loadShapes(E.toShacl(k.descs.map((d) => ({ ...d, relationships: (d.relationships || []).map((r) => ({ ...r, targetClass: false })) }))));
  ok(allShapes.length > 150, `the whole catalog's SHACL parses (${allShapes.length} node shapes)`);

  console.log("REQ-074: the app's own data against its shapes and keys");
  const feeds = require("../lib/feeds"), { shiftItems } = require("./fixture-dates");
  for (const [n, kind, fmt, file] of [["Sample arXiv feed (test data)", "papers", "arxiv", "sample-atom.xml"], ["Sample lab blog (test data)", "lab", "rss", "sample-rss.xml"]]) {
    const id = await db.insert("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')", n, kind, fmt, "fixture://" + file);
    await ingestItems(id, shiftItems(feeds.parse(fmt, fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8"))));
  }
  const server = app.listen(0, "127.0.0.1"); await new Promise((r) => server.once("listening", r)); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const sign = async (name) => (await fetch(base + "/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: name, password: "sample-only-123" }) })).headers.get("set-cookie").split(";")[0];
    const adm = await sign("sample-el-admin"), rdr = await sign("sample-el-reader");
    const call = (c, m, p, body) => fetch(base + p, { method: m, headers: { cookie: c, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const stories = (await (await call(rdr, "GET", "/api/stories")).json()).stories || [];
    for (const s of stories.slice(0, 3)) { await call(rdr, "POST", `/api/stories/${s.id}/vote`, {}); await call(rdr, "POST", `/api/stories/${s.id}/save`, {}); }
    let checked = 0, clean = 0, conforms = 0; const dirty = [];
    for (const d of tables) { const r = await M.checkData(d.id, { db }); if (!r || !r.rows) continue; checked++; if (!r.problemCount) clean++; else dirty.push(`${d.id}: ${Object.entries(r.byRule).map(([a, b]) => `${b} ${a}`).join(", ")}`); if (r.shacl.conforms) conforms++; else dirty.push(`${d.id} shacl: ${r.shacl.sample.slice(0, 2).map((x) => x.message).join(" | ")}`); }
    ok(checked >= 8 && clean === checked && conforms === checked, `every table with Sample rows passes its keys, grain and references, and its quads conform to its shape (${checked} tables${dirty.length ? `; ${dirty.join("; ")}` : ""})`);
    const votes = k.byId.get("table:votes"), vrows = await db.all("SELECT * FROM votes");
    const broken = E.checkRows(votes, [...vrows, { ...vrows[0] }, { user_id: null, story_id: vrows[0].story_id }], { lookup: () => true });
    ok(vrows.length >= 3 && broken.some((x) => x.rule === "primary") && broken.some((x) => x.rule === "required"), "a duplicated vote and a vote with no user are caught (mutants of real rows)");
    const st2 = k.byId.get("table:stories"), srows = await db.all("SELECT * FROM stories LIMIT 5");
    const sq = [...srows, { ...srows[0], id: 999999, title: null, first_seen: "not a date" }].flatMap((r) => E.rowToQuads(st2, r).quads.map((q) => q.replace(/ <urn:si:data:[^>]+> \.$/, " .")));
    const sv = Shacl.validate(Shacl.loadShapes(E.toShacl([{ ...st2, relationships: [] }])), sq.join("\n"));
    ok(!sv.conforms && sv.results.every((x) => /999999/.test(x.focus)) && sv.results.some((x) => /title/.test(x.path)) && sv.results.some((x) => /first_seen|firstSeen/.test(x.path)), `a story with no title and a bad date fails its shape, and only that story (${sv.results.length} violations)`);

    console.log("REQ-073: another repo's records (a Sample vibe-coding checkout)");
    const pj = await M.checkData("collection:vibe-project", { db }), pm = await M.checkData("collection:vibe-prompt", { db });
    ok(pj.rows === 2 && pj.byRule.vocabulary === 1 && pj.byRule.enum === 1 && !pj.shacl.conforms, `projects: an unknown tag and a status off the list are caught by the checks and the shape (${JSON.stringify(pj.byRule)})`);
    ok(pm.rows === 5 && pm.byRule.primary === 1 && pm.byRule.grain === 1 && pm.byRule.enum === 1 && pm.byRule.required >= 3 && pm.problems.every((x) => x.row === null || x.row >= 2), `prompts: a repeated prompt number, a missing context block and an off-list verified value are caught, and the conforming project has none (${JSON.stringify(pm.byRule)})`);
    const rel = k.byId.get("collection:vibe-prompt").relationships[0];
    ok(rel.target === "collection:vibe-project" && rel.cardinality === "1" && k.byId.get("collection:vibe-project").grain.statement === "one row per project folder", "the other repo's records carry keys, grain and a directed relationship like ours");

    console.log("REQ-075: plugins and routes");
    M.providers.set("sample-plugin", { id: "sample-plugin", about: "A Sample provider (test data).", describe: () => [{ id: "document:sample-handbook", kind: "document", description: "A Sample handbook a plugin describes (test data).", aliases: ["handbook"], tags: ["interop:plugin"], lifecycle: { persistence: "versioned" }, relationships: [{ rel: "about", target: "bookmark", direction: "out", cardinality: "0..*" }] }] }); M.reset();
    const k2 = await M.catalog({ db }), doc = k2.byId.get("document:sample-handbook");
    ok(doc && doc.relationships[0].target === "table:saves" && doc.relationships[0].declaredTarget === "bookmark", "a plugin's provider joins the catalog, and its relationship to 'bookmark' resolves to table:saves");
    M.providers.delete("sample-plugin"); M.reset();
    const src = async (c, id, params = {}) => { const r = await call(c, "POST", `/api/data/sources/${id}`, { params }); return { status: r.status, data: (await r.json()).data }; };
    const list = await src(adm, "elements.list", { q: "upvote" });
    ok(list.status === 200 && list.data.length === 1 && list.data[0].id === "table:votes" && list.data[0].grain === "one row per user per story", "elements.list finds a table by an alias");
    ok((await src(rdr, "elements.list")).status === 403, "readers can't read the catalog (admins only)");
    const one = await src(adm, "elements.get", { id: "saves" });
    ok(one.data.id === "table:saves" && one.data.keys.primary.join() === "user_id,story_id" && one.data.completeness.score === 1, "elements.get resolves a bare name and returns the full descriptor");
    const rep = await src(adm, "elements.report");
    ok(rep.data.dag.isDag !== undefined && rep.data.dag.violations.length === 0 && rep.data.order === undefined && rep.data.dag.loadOrder.indexOf("table:users") < rep.data.dag.loadOrder.indexOf("table:votes") && rep.data.dag.loadOrder.indexOf("table:stories") < rep.data.dag.loadOrder.indexOf("table:story_links"), "elements.report gives a load order where users come before votes (references point backwards)");
    const ex = await call(adm, "POST", "/api/data/actions/elements.export", { input: {} }), exj = await ex.json();
    const q = await src(adm, "data.sparql", { query: 'PREFIX si: <https://superintelligence-homepage.example/ns#> SELECT ?g WHERE { GRAPH <urn:si:elements> { <urn:si:element:table:votes> si:grain ?g } }' });
    ok(ex.status === 200 && exj.result.triples > 1000 && q.data.rows[0].g === "one row per user per story", `elements.export writes the catalog into the knowledge graph (${exj.result.triples} triples) and SPARQL reads a table's grain back`);
  } finally { await new Promise((r) => server.close(r)); if (db.end) await db.end(); }
  console.log(`\nelements unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
