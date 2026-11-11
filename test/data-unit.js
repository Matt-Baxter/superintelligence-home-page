#!/usr/bin/env node
// Data layer, knowledge graph, artifacts, the response builder's actions and Studio bindings (proposed REQ-061..REQ-064,
// openspec/changes/add-data-layer-and-builders). Synthetic sample data only, on a disposable database.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
process.env.SITE_PROFILE = "extended"; process.env.FETCH_MINUTES = "0";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-data-"));
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ""; delete process.env.POSTGRES_URL;
process.env.KG_ENGINE = process.env.KG_ENGINE || "oxigraph"; // the engine every platform has; oxilite runs where its binary exists
const reg = require("../modules/data/registry"), KG = require("../modules/data/kg"), { artifacts } = require("../modules/data/artifacts"), bindings = require("../modules/data/bindings");

(async () => {
  console.log("REQ-061: input schemas");
  const S = { slug: { type: "string", required: true, max: 10 }, n: { type: "integer", min: 1, max: 5 }, mode: { type: "string", enum: ["a", "b"] } };
  ok(reg.check(S, { slug: "x", n: "3" }).ok && reg.check(S, { slug: "x", n: "3" }).value.n === 3, "numbers from a query string are coerced and checked");
  const bad = reg.check(S, { n: 9, mode: "c", extra: 1 });
  ok(!bad.ok && bad.errors.join("|") === "slug is required|n must be between 1 and 5|mode must be one of a, b|unknown field: extra", `bad input names every field (${bad.errors.join("; ")})`);
  ok(reg.allowed({ access: "public" }, null) && !reg.allowed({ access: "user" }, null) && !reg.allowed({ access: "admin" }, { admin: false }) && reg.allowed({ access: "admin" }, { admin: true }), "public, signed-in and admin access");

  const { app, boot, db } = require("../server"); await boot();
  console.log("REQ-062: versioned artifacts");
  const A = artifacts(db);
  await A.save("sample", "one", { title: "Sample (test data)", body: { n: 1 }, note: "first" }); await A.save("sample", "one", { body: { n: 2 }, note: "second", files: [{ path: "out/sample.txt", bytes: 3 }] });
  const cur = await A.get("sample", "one");
  ok(cur.version === 2 && cur.body.n === 2 && cur.files[0].path === "out/sample.txt" && (await A.history("sample", "one")).length === 2, "save twice: version 2 is current, both are in the history, files are referenced");
  for (let i = 3; i <= 21; i++) await A.save("sample", "one", { body: { n: i } });
  const h = await A.history("sample", "one");
  ok(h.length === 20 && h[h.length - 1].version === 2 && h[0].version === 21, "the 21st save prunes version 1 and keeps 2..21");
  const r = await A.restore("sample", "one", 2, null);
  ok(r.version === 22 && (await A.get("sample", "one")).body.n === 2 && (await A.get("sample", "one", 3)).body.n === 3, "restore makes version 22 with version 2's body and deletes nothing");

  console.log("REQ-063: knowledge graph");
  const kg = await KG.open(db);
  ok(kg.kind === "oxigraph" && (await kg.info()).persistent === "snapshot in the app database", `engine reported: ${kg.kind}${kg.note ? ` (${kg.note})` : ""}`);
  await kg.replaceGraph("urn:si:response:sample", [`${KG.iri("urn:si:paper:sample")} ${KG.A} ${KG.si("Paper")} .`, `${KG.iri("urn:si:c1")} ${KG.si("claimedBy")} ${KG.iri("urn:si:paper:sample")} .`, `${KG.iri("urn:si:c1")} ${KG.si("text")} ${KG.lit('A "quoted" sample claim\nwith a newline (test data)')} .`]);
  KG.reset(); const kg2 = await KG.open(db);
  const back = await kg2.query(`PREFIX si: <${KG.NS}> SELECT ?t WHERE { GRAPH ?g { ?c si:claimedBy <urn:si:paper:sample> ; si:text ?t } }`);
  ok(back.rows.length === 1 && back.rows[0].t.includes('"quoted"') && back.rows[0].t.includes("\n"), "a write survives reopening the store from the database, quotes and newlines intact");
  let refused = 0; for (const q of ["DELETE WHERE { ?s ?p ?o }", "INSERT DATA { <urn:a> <urn:b> <urn:c> }", "PREFIX x: <urn:x> CLEAR ALL", "SELECT * WHERE { ?s ?p ?o } ; DROP ALL"]) { try { await kg2.query(q); } catch (e) { if (e.status === 400 || /parse|syntax|read-only/i.test(e.message)) refused++; } }
  ok(refused === 4 && (await kg2.info()).triples === 3, "updates sent as queries are refused and the graph is unchanged");
  ok(KG.isReadOnly("PREFIX si: <urn:x#> SELECT ?s WHERE { ?s si:p \"DELETE WHERE {\" }"), "...while a read whose literal mentions DELETE is allowed");
  const big = Array.from({ length: KG.MAX_TRIPLES + 1 }, (_, i) => `${KG.iri(`urn:si:x${i}`)} ${KG.si("p")} ${KG.lit(i)} .`);
  let over = null; try { await kg2.replaceGraph("urn:si:big", big); } catch (e) { over = e; }
  ok(over && over.status === 400 && (await kg2.info()).triples === 3, `a write over ${KG.MAX_TRIPLES} triples is refused before anything changes`);
  let badIri = null; try { KG.iri("urn:has space>"); } catch (e) { badIri = e; } ok(!!badIri, "an IRI with spaces or brackets is refused, so nothing can break out of a triple");

  console.log("REQ-061, REQ-064: routes, builder actions and Studio bindings");
  const server = app.listen(0, "127.0.0.1"); await new Promise((res) => server.once("listening", res));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sign = async (u) => (await fetch(base + "/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: "sample-only-123" }) })).headers.get("set-cookie").split(";")[0];
  try {
    const adm = await sign("sample-data-admin"), rdr = await sign("sample-data-reader");
    const call = (c, m, p, body) => fetch(base + p, { method: m, headers: { cookie: c || "", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const src = (c, id, params) => call(c, "POST", `/api/data/sources/${id}`, { params });
    const act = (c, id, input) => call(c, "POST", `/api/data/actions/${id}`, { input });
    const ids = (await (await call(adm, "GET", "/api/data/sources")).json()).sources.map((s) => s.id);
    ok(["data.sparql", "responses.list", "responses.claims"].every((x) => ids.includes(x)) && !(await (await call(rdr, "GET", "/api/data/sources")).json()).sources.some((s) => s.id === "data.sparql"), "sources are listed by who may read them");
    ok((await src(rdr, "data.sparql", { query: "ASK {}" })).status === 403 && (await src(null, "responses.list", {})).status === 401, "a reader can't run an admin source; a guest is asked to sign in");
    ok((await act(rdr, "data.restore", { kind: "sample", key: "one", version: 2 })).status === 403, "a reader can't run an admin action");
    const html = fs.readFileSync(path.join(__dirname, "fixtures", "papers", "sample-paper.html"), "utf8");
    const built = await act(adm, "responses.build", { title: "Gated Self-Repair: Sample paper for the paper reader (test data)", url: "https://example.test/sample-paper", text: html }), b = await built.json();
    const slug = b.result.slug;
    ok(built.status === 200 && b.result.version === 1 && b.refresh.includes("responses.list"), `responses.build saves version 1 (${slug})`);
    const audit = await db.all("SELECT target FROM admin_audit WHERE action = 'data.action'");
    ok(audit.some((x) => x.target === "action:responses.build"), "every action run is in the admin audit log");
    const ed = await (await act(adm, "responses.edit-line", { slug, beat: 0, line: 1, text: "Does the gate really help?" })).json();
    const g = await (await src(adm, "responses.get", { slug })).json();
    ok(ed.result.version === 2 && g.data.plan.beats[0].lines[1].text === "Does the gate really help?" && g.data.history.length === 2 && !("planInput" in g.data), "edit-line saves version 2 with the new line and the history shows both");
    ok((await act(adm, "responses.edit-line", { slug, beat: 0, line: 1, text: "Bad (brackets)" })).status === 400 && (await act(adm, "responses.edit-line", { slug, beat: 99, line: 0, text: "x" })).status === 400, "lines with brackets, and beats that don't exist, are refused");
    const rp = await (await act(adm, "responses.replan", { slug, maxSeconds: 45 })).json();
    ok(rp.result.version === 3 && rp.result.seconds <= 45 + 30 && Array.isArray(rp.result.chosen), `replan under a 45 s limit saves version 3 (${rp.result.chosen.join(" → ")})`);
    const claims = (await (await src(adm, "responses.claims", { level: "not found in the body" })).json()).data;
    ok(claims.length >= 1 && claims.every((c) => c.level === "not found in the body" && c.paper === "https://example.test/sample-paper"), `SPARQL over the graph finds the paper's unbacked claims (${claims.length}), each claimed by the paper`);
    const dr = await (await act(adm, "responses.save-draft", { slug })).json();
    const links = (await (await src(adm, "responses.connections", { slug })).json()).data;
    ok(links.some((l) => l.rel === "si:draftOf" && l.other === `urn:si:editorial:${dr.result.id}`) && links.some((l) => l.rel === "si:about" && l.other === "https://example.test/sample-paper"), "the draft and the paper are connected to the response in the graph");
    const q = await act(adm, "responses.queue-render", { slug, learn: true }), qj = await q.json(), job = await db.get("SELECT kind, note, status FROM learn_jobs WHERE id = ?", qj.result.job);
    ok(job.kind === "response" && job.note === `response:${slug} version:3 learn` && job.status === "queued", "queue-render leaves a job for the worker (nothing renders on the web server)");
    const rs = await (await act(adm, "data.restore", { kind: "response", key: slug, version: 1 })).json();
    const now = (await (await src(adm, "responses.get", { slug })).json()).data;
    ok(rs.result.version === 4 && now.plan.beats[0].lines[1].text !== "Does the gate really help?", "restoring version 1 brings the original line back as version 4");
    // Studio bindings
    const spec = { root: "s", elements: { s: { type: "Text", props: { text: "Sample (test data)" }, children: [] } }, bindings: { "/responses": { source: "responses.list" }, "/graph": { source: "data.graph-info" } } };
    const resolved = (await (await call(adm, "POST", "/api/ui/resolve", { spec })).json()).spec;
    ok(Array.isArray(resolved.state.responses) && resolved.state.responses[0].slug === slug && resolved.state.graph.engine === "oxigraph", "a bound view gets live data in its state");
    const asReader = (await (await call(rdr, "POST", "/api/ui/resolve", { spec })).json()).spec;
    ok(asReader.state.graph === null && /read that source/.test(asReader.state._errors.graph) && asReader.state.responses === null, "a binding the viewer can't read is left empty with the reason; the view still resolves");
    const cat = await (await call(adm, "GET", "/api/ui/catalog")).json();
    ok(cat.actions.includes("runAction") && cat.actions.includes("refresh") && cat.dataActions.some((a) => a.id === "responses.edit-line") && /bindings/.test(cat.prompt), "the Studio's catalog offers runAction, refresh, the sources and the data actions");
    const proto = await bindings.resolve({ bindings: { "/__proto__/x": { source: "responses.list" } } }, {}, async () => ({ polluted: true }));
    ok(({}).x === undefined && ({}).polluted === undefined && Object.keys(proto.state._errors).length === 1, "a binding path that would touch the prototype is refused");
    // Flag off: the builder's sources and actions disappear with the feature.
    await call(adm, "PUT", "/api/admin/features", { responses: "off" });
    ok((await src(adm, "responses.list", {})).status === 404 && (await act(adm, "responses.replan", { slug, maxSeconds: 60 })).status === 404, "with paper responses switched off, its sources and actions answer 404 even for an admin");
    await call(adm, "PUT", "/api/admin/features", { responses: "staff" });
  } finally { await new Promise((res) => server.close(res)); if (db.end) await db.end(); }
  console.log(`\ndata unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
