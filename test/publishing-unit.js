// Appearance (REQ-053), CMS delivery (REQ-054) and content generation with channel versions (REQ-055), all proposed.
// Pure checks first, then the HTTP routes against a disposable SQLite database with synthetic stories (test data).
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), vm = require("node:vm");
let n = 0; const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

// ---------- Appearance catalog and CSS ----------
const { CATALOG, validate } = require("../modules/appearance/settings");
const css = fs.readFileSync(path.join(__dirname, "../public/css/app.css"), "utf8");
const PLAIN = { theme: "auto", layout: "list", type: "serif", size: "normal" };
for (const [field, list] of [["theme", "themes"], ["layout", "layouts"], ["type", "types"], ["size", "sizes"]])
  for (const o of CATALOG[list]) ok(o.id === PLAIN[field] || css.includes(`[data-${field}="${o.id}"]`), `REQ-053: ${field} "${o.id}" has CSS in app.css`);
for (const c of CATALOG.concepts) ok(["theme", "layout", "type", "size"].every((f) => CATALOG[f + "s"].some((o) => o.id === c[f])), `REQ-053: concept "${c.id}" names real options`);
ok(validate({ concept: "magazine" }).layout === "magazine" && validate({ concept: "magazine" }).concept === "magazine", "REQ-053: a concept sets all four settings");
ok(validate({ concept: "magazine", layout: "compact" }).concept === "custom", "REQ-053: changing one setting after a concept makes it custom");
assert.throws(() => validate({ theme: "purple" }), /Unknown theme/); n++;
assert.throws(() => validate({ allowReader: "yes" }), /true or false/); n++;
const { check } = require("../scripts/unslop.js");
ok(check("public/css/app.css", css).filter((x) => x.rule === "contrast").length === 0, "REQ-053: every theme keeps 4.5:1 text contrast");
ok(check("public/css/app.css", css.replace("--muted: #59544b", "--muted: #c8c2b8")).some((x) => x.rule === "contrast" && /newsprint/.test(x.msg)), "REQ-053: the contrast check reads theme blocks");
// The browser's resolver (public/js/api.js): site default, then the reader's concept, then the reader's own fields.
const src = fs.readFileSync(path.join(__dirname, "../public/js/api.js"), "utf8");
const ctx = {}; vm.runInNewContext(src.match(/const LOOK_KEYS[^\n]*\n/)[0] + src.match(/function resolveLook[\s\S]*?\n}\n/)[0] + "this.resolveLook = resolveLook;", ctx);
const site = { ...CATALOG.default };
ok(ctx.resolveLook(site, null, CATALOG).layout === "list", "REQ-053: no reader choice gives the site default");
ok(ctx.resolveLook(site, { concept: "night-desk" }, CATALOG).theme === "dark", "REQ-053: a reader's concept applies its preset");
ok(ctx.resolveLook(site, { concept: "night-desk", size: "large" }, CATALOG).concept === "custom", "REQ-053: a reader's own setting on top of a concept is custom");
ok(ctx.resolveLook({ ...site, allowReader: false }, { concept: "night-desk" }, CATALOG).theme === "auto", "REQ-053: readers can't switch when the admin turned it off");

// ---------- Content generation and channels (pure) ----------
const C = require("../modules/editorial/content");
const now = Date.parse("2026-11-10T12:00:00Z"), d = (days) => new Date(now - days * 864e5).toISOString();
const story = (id, days, sig, topic, extra = {}) => ({ id, title: `Sample story ${id} (test data)`, url: `https://example.org/sample-${id}`, summary: `Sample summary ${id}. Second sentence.`, authors: "A. Sample Person", published_at: d(days), significance: sig,
  topics: [{ id: topic, label: topic === "alignment" ? "Alignment" : "Interpretability", matched: ["sample"] }], sources: [{ name: "Sample feed (test data)" }], analysis: { type: { label: "Evaluation" }, evidence: { label: "Preprint" }, why: [{ factor: "Evidence", points: 9, detail: "Preprint" }], claims: [] }, ...extra });
const stories = [story(1, 1, 40, "alignment"), story(2, 3, 70, "interpretability"), story(3, 10, 90, "alignment"), story(4, 20, 30, "alignment")];
const dg = C.weeklyDigest(stories, { now });
ok(dg.sources.map((s) => s.id).join() === "2,1", "REQ-055: the digest takes the last 7 days, most significant first");
ok(!dg.body.includes("A. Sample Person"), "REQ-055: generated drafts never name authors");
ok(/Check every line/.test(dg.body), "REQ-055: a generated draft says it must be checked");
const tr = C.topicRoundup(stories, { topic: "alignment", topicLabel: "Alignment", now });
ok(tr.sources.map((s) => s.id).join() === "1,3,4", "REQ-055: the round-up takes one topic's last 30 days, newest first");
assert.throws(() => C.topicRoundup(stories, { topic: "policy", now }), /No policy stories/); n++;
const ex = C.storyExplainer(story(5, 1, 55, "alignment", { analysis: { type: { label: "Evaluation" }, evidence: { label: "Preprint" }, why: [{ factor: "Evidence", points: 9, detail: "Preprint" }], claims: ["human-level or beyond"], scope: { reason: "Superintelligence term" } } }), { now });
ok(/Evidence \+9/.test(ex.body) && /frontier claim/.test(ex.body), "REQ-055: the explainer lists the score's parts and the claims to check");
const ch = C.channels({ title: "Sample post (test data)", summary: "A sample summary.", body: "Para one.\n\n" + "Long paragraph. ".repeat(400) }, "https://example.org/m/journal?slug=sample");
ok(ch.social.every((s) => s.length <= s.limit && s.text.endsWith("https://example.org/m/journal?slug=sample")), "REQ-055: every short post fits its network and keeps the link");
ok(!ch.social.some((s) => /twitter|^x$/i.test(s.network)), "REQ-055: no Twitter/X version");
ok(ch.newsletter.subject.length <= 78 && ch.blog.text.startsWith("# Sample post"), "REQ-055: newsletter subject and blog Markdown");
const posts = [{ id: 1, slug: "sample-a", title: "Sample <A> & B (test data)", summary: "S", body: "B", published_at: d(1) }];
ok(/<rss version="2.0">/.test(C.rss(posts, "https://example.org")) && C.rss(posts, "https://example.org").includes("Sample &lt;A&gt; &amp; B"), "REQ-054: RSS escapes titles");
ok(C.jsonFeed(posts, "https://example.org").items[0].content_text === "B", "REQ-054: JSON Feed carries the published text");

// ---------- HTTP routes ----------
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL; process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-publishing-test-")); process.env.SITE_PROFILE = "extended"; process.env.FETCH_MINUTES = "0";
const { app, db, boot } = require("../server");
(async () => {
  let server; const key = `Sample publishing ${process.pid} (test data)`;
  try {
    await boot();
    for (const admin of [true, false]) { const id = await db.insert("INSERT INTO users (username,display_name,pass_hash,is_admin) VALUES (?,?,?,?)", key + (admin ? "admin" : "reader"), key, "unused", admin ? 1 : 0); await db.run("INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)", key + (admin ? "admin" : "reader"), id, Date.now() + 120000); }
    const sid = await db.insert("INSERT INTO stories (title,url,summary,published_at,first_seen,in_scope,significance,topics,analysis) VALUES (?,?,?,?,?,1,?,?,?)", "Sample story for generation (test data)", "https://example.org/sample-gen", "Sample summary (test data).", new Date().toISOString(), new Date().toISOString(), 42, JSON.stringify([{ id: "alignment", label: "Alignment", matched: ["aligned"] }]), JSON.stringify({ why: [{ factor: "Evidence", points: 9, detail: "Preprint" }] }));
    await db.run("INSERT INTO story_topics (story_id, topic) VALUES (?, ?)", sid, "alignment");
    server = app.listen(0, "127.0.0.1"); await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (url, method = "GET", body, role = "admin") => { const r = await fetch(base + url, { method, headers: { ...(role ? { cookie: `sid=${encodeURIComponent(key + role)}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); const text = await r.text(); let data = {}; try { data = JSON.parse(text); } catch {} return { status: r.status, data, text, type: r.headers.get("content-type") || "" }; };
    const g = await call("/api/appearance", "GET", null, null); ok(g.status === 200 && g.data.site.concept === "reader" && g.data.options.concepts.length >= 4, "REQ-053: anyone can read the options and the site default");
    ok((await call("/api/admin/appearance", "PUT", { concept: "briefing" }, "reader")).status === 403, "REQ-053: only an admin sets the default");
    ok((await call("/api/admin/appearance", "PUT", { theme: "neon" })).status === 400, "REQ-053: an unknown option is refused");
    const put = await call("/api/admin/appearance", "PUT", { concept: "briefing", allowReader: false }); ok(put.status === 200 && (await call("/api/appearance", "GET", null, null)).data.site.layout === "compact", "REQ-053: the saved default is served");
    ok((await db.get("SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'appearance.default'")).n === 1, "REQ-053: changing the default is audited");
    ok((await call("/api/admin/editorial/generate", "POST", { kind: "weekly-digest" }, "reader")).status === 403, "REQ-055: only an admin generates drafts");
    ok((await call("/api/admin/editorial/generate", "POST", { kind: "poem" })).status === 400, "REQ-055: an unknown kind is refused");
    ok((await call("/api/admin/editorial/generate", "POST", { kind: "topic-roundup", topic: "not-a-topic" })).status === 400, "REQ-055: the round-up needs one of the nine topics");
    const gen = await call("/api/admin/editorial/generate", "POST", { kind: "story-explainer", story: sid }); ok(gen.status === 200 && gen.data.sources[0].id === sid, "REQ-055: an explainer draft is made from the chosen story");
    const post = await db.get("SELECT * FROM editorial_posts WHERE id = ?", gen.data.id); ok(post.status === "draft" && post.published_revision === null, "REQ-055: a generated post is a draft, never published");
    ok((await db.get("SELECT action FROM editorial_revisions WHERE post_id = ?", gen.data.id)).action === "generate", "REQ-055: its history says it was generated");
    ok((await call("/api/admin/editorial/generate", "POST", { kind: "topic-roundup", topic: "alignment" })).status === 200, "REQ-055: a topic round-up is made from that topic's stories");
    const chn = await call(`/api/admin/editorial/posts/${gen.data.id}/channels`); ok(chn.status === 200 && chn.data.social.length === 4, "REQ-055: channel versions for the saved draft");
    ok((await call(`/api/admin/editorial/posts/${gen.data.id}/channels`, "GET", null, "reader")).status === 403, "REQ-055: channel versions are admin-only");
    ok(!(await call("/api/editorial/feed.json", "GET", null, null)).data.items.length, "REQ-054: drafts are not delivered");
    ok((await call(`/api/admin/editorial/posts/${gen.data.id}`, "PUT", { action: "publish", original: true, expected_revision: 1 })).status === 200, "publish the generated draft after review (test data)");
    const xml = await call("/api/editorial/feed.xml", "GET", null, null); ok(/rss\+xml/.test(xml.type) && xml.text.includes(post.slug), "REQ-054: the RSS feed lists the published post");
    const jf = await call("/api/editorial/feed.json", "GET", null, null); ok(jf.data.version.includes("jsonfeed") && jf.data.items[0].content_text.includes("Sample story for generation"), "REQ-054: the JSON Feed carries it");
    console.log(`publishing unit: ${n} passed, 0 failed`);
  } finally { server?.close(); await db.close?.(); }
})().catch((e) => { console.error(e); process.exit(1); });
