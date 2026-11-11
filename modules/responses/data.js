// Paper responses on the data layer (REQ-061..REQ-064, proposed): the sources and actions the response builder
// (/m/builder) and Studio views use. All of them answer 404 while the "responses" feature flag hides the feature.
const flags = require("./flags"), reader = require("./reader"), { respond, rebuild } = require("./respond"), { check } = require("./plan");
const { saveResponse, loadResponse, responseIri } = require("./store");
const KG = require("../data/kg");
const SLUG = { type: "string", required: true, max: 120, about: "The response's slug" };
const guard = async (req, { db, notFound }) => { const { flags: f } = await flags.read(db); if (!flags.visible(f.responses, req.user)) notFound("That page"); };
const site = () => (process.env.SITE_URL || "").replace(/\/$/, "");

function register(ctx) {
  const S = ctx.point("data.sources"), Ac = ctx.point("data.actions");
  S.add("responses.list", { about: "Paper responses, newest first, with their rigor, strength and version.", params: {}, access: "user", guard,
    run: async (p, c) => {
      const rows = await c.db.all("SELECT r.slug, r.title, r.url, r.updated_at, r.package, a.current_version AS version FROM responses_papers r LEFT JOIN data_artifacts a ON a.kind = 'response' AND a.akey = r.slug ORDER BY r.updated_at DESC, r.id DESC LIMIT 50");
      return rows.map((r) => { const k = JSON.parse(r.package), a = k.analysis || {}; return { slug: r.slug, title: r.title, url: r.url, updatedAt: r.updated_at, version: r.version || 0, rigor: a.rigor, strength: a.strength, beats: (k.plan && k.plan.beats || []).length, rendered: !!(k.video && (k.video.files || []).includes("video.mp4")) }; });
    } });
  S.add("responses.get", { about: "One response (the current version unless version is given), with its history.", params: { slug: SLUG, version: { type: "integer", min: 1 } }, access: "user", guard,
    run: async (p, c) => { const r = await loadResponse(c.db, p.slug, p.version); if (!r) c.notFound("That response"); const { planInput, ...pkg } = r.pkg; return { ...pkg, version: r.version, current: r.current, files: r.files, history: await c.artifacts.history("response", p.slug) }; } });
  S.add("responses.claims", { about: "Claims across every response, from the knowledge graph: { level? } (backed, described, partly backed, not found in the body).", params: { level: { type: "string", enum: ["backed", "described", "partly backed", "not found in the body"] } }, access: "user", guard,
    run: async (p, c) => {
      const q = `PREFIX si: <${KG.NS}> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?paper ?title ?claim ?text ?level ?section WHERE { GRAPH ?g { ?claim a si:Claim ; si:text ?text ; si:level ?level ; si:claimedBy ?paper . OPTIONAL { ?claim si:section ?section } ?paper rdfs:label ?title . ${p.level ? `FILTER(?level = ${JSON.stringify(p.level)})` : ""} } } ORDER BY ?title ?claim LIMIT 300`;
      return (await c.kg.query(q)).rows;
    } });
  S.add("responses.connections", { about: "What a response is connected to in the knowledge graph: its paper, renders, drafts and QA results.", params: { slug: SLUG }, access: "user", guard,
    run: async (p, c) => {
      const R = responseIri(p.slug);
      const q = `PREFIX si: <${KG.NS}> SELECT ?rel ?other ?graph WHERE { { GRAPH ?graph { <${R}> ?rel ?other } } UNION { GRAPH ?graph { ?other ?rel <${R}> } } FILTER(?rel != <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>) } LIMIT 200`;
      return (await c.kg.query(q)).rows.map((r) => ({ rel: r.rel.replace(KG.NS, "si:"), other: r.other, graph: r.graph }));
    } });
  S.add("responses.learnings", { about: "What building responses has taught us: each problem, its cause, its fix and its guard.", params: {}, access: "user", guard, run: async () => require("./learnings.json").learnings });

  Ac.add("responses.build", { about: "Read a paper (arXiv id or link, or pasted text with its title) and build its response: analysis, plan, article and posts. Saves version 1 (or the next version).",
    input: { source: { type: "string", max: 200 }, title: { type: "string", max: 300 }, url: { type: "string", max: 500 }, text: { type: "string", max: 400000 } }, access: "admin", guard, refresh: ["responses.list"],
    run: async (i, c) => {
      let input;
      if (i.text && i.text.trim()) {
        if (!i.title) c.bad("Give the paper's title with its text.");
        if (i.url && !/^https:\/\/\S+$/.test(i.url)) c.bad("The link must start with https://.");
        if (i.url && /^https?:\/\/([^/]*\.)?(twitter\.com|x\.com|nitter\.[^/]+)(\/|$)/i.test(i.url)) c.bad("This homepage doesn't track Twitter/X. Link to the paper itself.");
        input = /<section|<div|<html/i.test(i.text.slice(0, 5000)) ? reader.fromHtml(i.text, { title: i.title, url: i.url || null }) : reader.fromText(i.text, { title: i.title, url: i.url || null });
      } else if (i.source && /\d{4}\.\d{4,5}/.test(i.source)) input = i.source.trim();
      else c.bad("Give an arXiv id or link as source, or paste the paper's text with its title.");
      let pkg; try { pkg = await respond(input, { site: site() }); } catch (e) { c.bad(`Couldn't read that paper: ${e.message}`); }
      const v = await saveResponse(c.db, pkg, { actor: c.user.id, note: "built" });
      return { ...v, summary: pkg.analysis.summary, checks: pkg.checks };
    } });
  Ac.add("responses.edit-line", { about: "Change one spoken line of a response's plan; the plan's checks run again and a new version is saved.",
    input: { slug: SLUG, beat: { type: "integer", required: true, min: 0, max: 30 }, line: { type: "integer", required: true, min: 0, max: 30 }, text: { type: "string", required: true, max: 400 } }, access: "admin", guard, refresh: ["responses.get"],
    run: async (i, c) => {
      const r = await loadResponse(c.db, i.slug); if (!r) c.notFound("That response");
      const pkg = JSON.parse(JSON.stringify(r.pkg)), b = pkg.plan.beats[i.beat];
      if (!b || !b.lines[i.line]) c.bad(`There's no line ${i.line} in beat ${i.beat}.`);
      if (/[()[\]{}]/.test(i.text)) c.bad("Spoken lines can't contain brackets: say it as it should be heard.");
      const before = b.lines[i.line].text; b.lines[i.line].text = i.text.trim(); b.narration = b.lines.map((l) => l.text).join(" ");
      pkg.checks = check(pkg.plan, pkg.analysis, {}); pkg.video = null; pkg.qa = null; // the old render no longer matches
      const v = await saveResponse(c.db, pkg, { actor: c.user.id, note: `edited beat ${i.beat + 1} line ${i.line + 1}` });
      return { ...v, before, after: b.lines[i.line].text, checks: pkg.checks };
    } });
  Ac.add("responses.replan", { about: "Plan the response again with A* under a different length limit (seconds), without re-reading the paper.",
    input: { slug: SLUG, maxSeconds: { type: "integer", required: true, min: 40, max: 180 } }, access: "admin", guard, refresh: ["responses.get"],
    run: async (i, c) => {
      const r = await loadResponse(c.db, i.slug); if (!r) c.notFound("That response");
      if (!r.pkg.planInput) c.bad("This response was built before re-planning existed; build it again first.");
      const pkg = rebuild(r.pkg, { maxSeconds: i.maxSeconds, site: site() });
      const v = await saveResponse(c.db, pkg, { actor: c.user.id, note: `re-planned for ${i.maxSeconds} s` });
      return { ...v, chosen: pkg.plan.search.chosen, seconds: pkg.plan.budget.targetSeconds, checks: pkg.checks };
    } });
  Ac.add("responses.queue-render", { about: "Queue a render of the current version for the Learn worker (Manim, the local voice and QA run there, not on the web server).",
    input: { slug: SLUG, learn: { type: "boolean" } }, access: "admin", guard,
    run: async (i, c) => {
      const r = await loadResponse(c.db, i.slug); if (!r) c.notFound("That response");
      const id = await c.db.insert("INSERT INTO learn_jobs (kind, note, status, created_by, created_at, updated_at) VALUES ('response', ?, 'queued', ?, ?, ?)", `response:${i.slug} version:${r.version}${i.learn ? " learn" : ""}`, c.user.id, c.db.now(), c.db.now());
      return { job: id, version: r.version, run: "npm run learn:worker (on a machine with Manim)" };
    } });
  Ac.add("responses.save-draft", { about: "Save the response's article as an Editorial CMS draft, linked to the response in the knowledge graph.",
    input: { slug: SLUG }, access: "admin", guard,
    run: async (i, c) => {
      const r = await loadResponse(c.db, i.slug); if (!r) c.notFound("That response");
      const p = r.pkg, title = `Response: ${p.title}`.slice(0, 160), summary = String(p.plan.thesis).slice(0, 300), body = String(p.article).slice(0, 20000);
      const slug = `response-${i.slug}`.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90) + "-" + Date.now().toString(36), now = c.db.now();
      const id = await c.db.tx(async (t) => {
        if (c.db.engine === "pg") await t.get("SELECT pg_advisory_xact_lock(193628, 200)");
        if ((await t.get("SELECT COUNT(*) AS n FROM editorial_posts")).n >= 200) c.bad("The content limit is 200 posts.");
        const pid = await t.insert("INSERT INTO editorial_posts (slug, title, summary, body, status, revision, created_by, updated_by, updated_at) VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?)", slug, title, summary, body, c.user.id, c.user.id, now);
        await t.run("INSERT INTO editorial_revisions (post_id, revision, title, summary, body, status, actor_id, action, at) VALUES (?, 1, ?, ?, ?, 'draft', ?, 'generate', ?)", pid, title, summary, body, c.user.id, now);
        return pid;
      });
      await c.kg.addLinks([`${KG.iri(`urn:si:editorial:${id}`)} ${KG.A} ${KG.si("Draft")} .`, `${KG.iri(`urn:si:editorial:${id}`)} ${KG.si("draftOf")} ${KG.iri(responseIri(i.slug))} .`, `${KG.iri(`urn:si:editorial:${id}`)} ${KG.si("fromVersion")} ${KG.lit(r.version, "int")} .`]);
      return { id, slug, editor: `/m/editorial?post=${id}`, fromVersion: r.version };
    } });
}
module.exports = { register, guard };
