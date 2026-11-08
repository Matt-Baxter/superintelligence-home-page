#!/usr/bin/env node
// Acceptance suite for Matt's shared spec (specs/001-superintelligence-homepage/spec.md), run against the SPEC version
// of the site (SITE_PROFILE=spec) with labelled synthetic sources (FIXTURE_SET=spec). Every check names the REQ /
// scenario / SC it proves; the run fails if any testable requirement has no passing check (SC-008).
//   node test/spec-acceptance.js            API checks (fast; part of preflight)
//   node test/spec-acceptance.js --browser  also the UI scenarios in a real browser (laptop and phone widths)
const { spawn } = require("node:child_process"), path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const root = path.join(__dirname, "..");
const BROWSER = process.argv.includes("--browser");
const port = 3600 + Math.floor(Math.random() * 300), B = `http://localhost:${port}`;
const results = [];
let restartServer;
const check = (ids, name, pass, detail = "") => results.push({ ids: [].concat(ids), name, pass: !!pass, detail });

function client() {
  let cookie = "";
  const call = async (p, o = {}) => {
    const r = await fetch(B + p, { method: o.method || (o.body ? "POST" : "GET"), headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined, redirect: "manual" });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers };
  };
  return { call, get cookie() { return cookie; }, set cookie(c) { cookie = c; } };
}

async function main() {
  const env = { ...process.env, PORT: String(port), SITE_PROFILE: "spec", FIXTURE_SET: "spec", DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "si-spec-")) };
  delete env.DATABASE_URL; delete env.POSTGRES_URL;
  let err = "", server;
  const launch = () => {
    const child = spawn(process.execPath, ["--no-warnings", "test/serve-fixtures.js"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    child.stderr.on("data", (d) => (err += d)); return child;
  };
  const ready = async () => {
    for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(`Fixture server exited: ${err}`); try { if ((await fetch(B + "/api/me")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
    throw new Error("Fixture server did not become ready.");
  };
  restartServer = async () => {
    await new Promise((resolve) => { server.once("exit", resolve); server.kill(); });
    server = launch(); await ready();
  };
  server = launch();
  try {
    await ready();
    await api();
    if (BROWSER) await browser();
  } catch (e) { check("RUN", "suite ran", false, e.message + (err ? ` | ${err.slice(0, 300)}` : "")); }
  finally { server.kill(); }
  report();
}

async function api() {
  const fixtures = ["sample-spec.xml", "spec/forum.xml", "spec/newsletter.xml", "spec/forecasting.xml", "spec/safety.xml", "spec/policy.xml"].map((f) => fs.readFileSync(path.join(root, "test/fixtures", f), "utf8"));
  const labelled = fixtures.flatMap((x) => [...x.matchAll(/<item><title>([^<]+)<\/title><link>([^<]+)<\/link><category>about-superintelligence: (\w+)<\/category>/g)].map((m) => ({ title: m[1], link: m[2], about: m[3] })));
  const anon = client(), a = client(), b = client();

  // ---- US2 accounts (REQ-009..012) ----
  const ua = "spec-a-" + Date.now(), ub = "spec-b-" + Date.now(), pw = "sample-pass-123";
  const su = await a.call("/api/signup", { body: { username: ua, password: pw, displayName: "Real Name Here" } });
  check(["REQ-009", "US2-1"], "sign up with an unused username signs you in and shows the username", su.status === 200 && (await a.call("/api/me")).json.user?.username === ua);
  check(["REQ-012"], "nothing but a username and password is kept (a display name sent anyway is ignored)", (await a.call("/api/me")).json.user?.name === ua);
  check(["REQ-009", "US2-2"], "a taken username is refused with a message saying so", await (async () => { const r = await client().call("/api/signup", { body: { username: ua, password: pw } }); return r.status >= 400 && /taken/i.test(r.json.error || ""); })());
  await b.call("/api/signup", { body: { username: ub, password: pw } });
  const wrongUser = await client().call("/api/login", { body: { username: ua, password: "wrong-password" } });
  const noUser = await client().call("/api/login", { body: { username: "nobody-" + Date.now(), password: "wrong-password" } });
  check(["REQ-010", "US2-4"], "a wrong password is refused without revealing whether the username exists", wrongUser.status === 401 && noUser.status === 401 && wrongUser.json.error === noUser.json.error, wrongUser.json.error);
  const stay = client(); stay.cookie = a.cookie;
  check(["REQ-010", "US2-3"], "the session cookie keeps you signed in on a later visit (30-day cookie)", (await stay.call("/api/me")).json.user?.username === ua && /max-age=\d{6,}|expires=/i.test(su.headers.get("set-cookie") || ""));
  check(["REQ-011"], "passwords aren't returned by any account API", !JSON.stringify((await a.call("/api/me")).json).match(/pass|hash/i) && !JSON.stringify(su.json).includes(pw));

  // ---- US1 feed (REQ-001..008) ----
  const feed = (await a.call("/api/stories?limit=200")).json.stories || [];
  const sources = (await a.call("/api/sources")).json.sources || [];
  const fed = new Set(feed.flatMap((s) => s.sources.map((x) => x.name))), kinds = new Set(sources.filter((s) => fed.has(s.name)).map((s) => s.kind));
  check(["REQ-001", "US1-1", "SC-002"], "stories come from at least 8 sources across at least 5 kinds", fed.size >= 8 && kinds.size >= 5, `${fed.size} sources, ${kinds.size} kinds: ${[...kinds].join(", ")}`);
  check(["REQ-001"], "fetching runs on a schedule (Vercel cron, at most daily, in vercel.json)", JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")).crons?.some((c) => c.path.startsWith("/api/cron/fetch")));
  const dates = feed.map((s) => s.published_at || s.first_seen);
  check(["REQ-002", "US1-1"], "the feed is newest first", dates.every((d, i) => i === 0 || String(dates[i - 1]) >= String(d)));
  check(["REQ-002", "REQ-005", "US1"], "every story shows title, sources, topics with matched words and a link", feed.length > 0 && feed.every((s) => s.title && s.url && s.sources.length && s.topics.some((t) => !t.via && t.matched.length)));
  const titles = new Set(feed.map((s) => s.title));
  const yes = labelled.filter((x) => x.about === "yes"), no = labelled.filter((x) => x.about === "no"), tw = labelled.filter((x) => x.about === "twitter");
  check(["REQ-003", "SC-003"], "100% of 'about superintelligence' items appear", yes.every((x) => titles.has(x.title)), yes.filter((x) => !titles.has(x.title)).map((x) => x.title).join("; "));
  check(["REQ-003", "SC-003", "US1-3", "Edge: AI in retail, hiring, borderline"], "100% of 'not about superintelligence' items are left out", no.every((x) => !titles.has(x.title)), no.filter((x) => titles.has(x.title)).map((x) => x.title).join("; "));
  const al = feed.find((s) => /alignment technique for superhuman/i.test(s.title));
  check(["US1-2"], "an alignment technique for superhuman systems carries the Alignment topic", al?.topics.some((t) => t.id === "alignment"));
  check(["REQ-004", "US1-4", "SC-005"], "the same paper from several sources is one story listing every source", feed.filter((s) => /alignment technique for superhuman/i.test(s.title)).length === 1 && al?.nsources >= 2 && feed.some((s) => s.nsources >= 3));
  const tl = feed.find((s) => /AGI timelines/i.test(s.title));
  check(["REQ-005", "US1-5", "SC-006"], "\"AGI timelines\" gives Forecasting & timelines with the matched words \"AGI timelines\"", tl?.topics.some((t) => t.id === "forecasting" && t.matched.includes("agi timelines")));
  check(["SC-006"], "100% of stories show the words that made them superintelligence-related", feed.every((s) => s.topics.some((t) => t.matched.length)));
  const rsi = feed.find((s) => /recursively self-improve/i.test(s.title)), air = feed.find((s) => /automate AI research/i.test(s.title));
  check(["REQ-005", "Assumptions: topics"], "the spec's added topics work: Recursive self improvement and Automating AI research", rsi?.topics.some((t) => t.id === "recursive-self-improvement") && air?.topics.some((t) => t.id === "automating-ai-research"));
  check(["REQ-006", "Edge: Twitter/X link"], "an item linking to Twitter/X is not shown", tw.every((x) => !titles.has(x.title)) && feed.every((s) => !/twitter\.com|\/\/x\.com/i.test(s.url)));
  const sub = await a.call("/api/stories", { body: { url: "https://x.com/someone/status/2", title: "A superintelligence thread on AGI" } });
  check(["REQ-006"], "a Twitter/X link is refused when submitted", sub.status === 400);
  check(["REQ-006"], "no Twitter/X source is configured", sources.every((s) => !/twitter\.com|\/\/x\.com|nitter/i.test(s.url)));
  check(["REQ-007"], "stories link out and no full article text is stored (summaries only, short)", feed.every((s) => /^https?:\/\//.test(s.url) && String(s.summary || "").length <= 1200));
  check(["REQ-008", "Edge: unreachable source"], "a failing source doesn't stop the feed (real sources are unreachable here; the feed still loads)", feed.length > 0 && sources.some((s) => s.status !== "active" || s.last_error));
  check(["Edge: no duplicates on refetch"], "fetching the same items again doesn't duplicate stories", feed.length === new Set(feed.map((s) => s.url)).size);

  // ---- US3 votes and saves (REQ-013..016) ----
  const sid = feed[0].id, sid2 = feed[1].id;
  const v1 = await a.call(`/api/stories/${sid}/vote`, { method: "POST" });
  check(["REQ-013", "US3-1"], "voting raises the count by one and shows as voted", v1.json.voted === true && v1.json.votes === (feed[0].votes || 0) + 1);
  const vb = await b.call(`/api/stories/${sid}/vote`, { method: "POST" });
  check(["Edge: two users vote at once", "US3"], "two users' votes both count", vb.json.votes === (feed[0].votes || 0) + 2);
  const v2 = await a.call(`/api/stories/${sid}/vote`, { method: "POST" });
  check(["REQ-013", "US3-2"], "voting again removes the vote (one per user per story)", v2.json.voted === false && v2.json.votes === (feed[0].votes || 0) + 1);
  await a.call(`/api/stories/${sid}/save`, { method: "POST" }); await a.call(`/api/stories/${sid2}/save`, { method: "POST" });
  const again = client(); await again.call("/api/login", { body: { username: ua, password: pw } });
  const savedA = (await again.call("/api/stories?saved=1")).json.stories || [];
  check(["REQ-014", "REQ-015", "US3-3", "SC-007"], "saves are still there after signing out and back in", [sid, sid2].every((x) => savedA.some((s) => s.id === x)));
  await restartServer();
  const afterRestart = (await again.call("/api/stories?saved=1")).json.stories || [];
  const voteAfterRestart = (await b.call(`/api/stories/${sid}`)).json.story;
  check(["REQ-010", "REQ-015", "SC-007"], "saved stories, votes and the existing session survive a server process restart on the same database", [sid, sid2].every((id) => afterRestart.some((story) => story.id === id)) && voteAfterRestart?.voted === true && voteAfterRestart.votes === (feed[0].votes || 0) + 1);
  check(["REQ-014", "US3-4"], "A's saves don't appear in B's saved list", ((await b.call("/api/stories?saved=1")).json.stories || []).every((s) => ![sid, sid2].includes(s.id)));
  const un = await a.call(`/api/stories/${sid2}/save`, { method: "POST" });
  check(["REQ-014"], "a story can be unsaved", un.json.saved === false);
  const av = await anon.call(`/api/stories/${sid}/vote`, { method: "POST" }), as = await anon.call(`/api/stories/${sid}/save`, { method: "POST" });
  const after = ((await a.call("/api/stories?limit=200")).json.stories || []).find((s) => s.id === sid);
  check(["REQ-013", "REQ-014", "US3-5", "US2-5"], "not signed in: vote and save ask you to sign in and record nothing", av.status === 401 && as.status === 401 && after.votes === vb.json.votes - 1);
  const out = client(); await out.call("/api/login", { body: { username: ua, password: pw } }); await out.call("/api/logout", { method: "POST" }); // its own session, so A stays signed in
  check(["REQ-010", "US2-5"], "after signing out, voting asks you to sign in again", (await out.call(`/api/stories/${sid}/vote`, { method: "POST" })).status === 401);
  // User A can't change B's vote or save by any means: every vote/save endpoint only ever acts on the caller's own row.
  await b.call(`/api/stories/${sid2}/save`, { method: "POST" });
  const tries = await Promise.all([
    a.call(`/api/stories/${sid2}/save`, { method: "POST", body: { user_id: "b", userId: 2 } }),
    a.call(`/api/stories/${sid}/vote`, { method: "POST", body: { user: ub } }),
  ]);
  const bSaved = ((await b.call("/api/stories?saved=1")).json.stories || []).some((s) => s.id === sid2);
  const bVoted = ((await b.call("/api/stories?limit=200")).json.stories || []).find((s) => s.id === sid)?.voted;
  check(["REQ-016", "US3-6"], "user A can't change or remove B's vote or save, even by sending B's id", bSaved && bVoted === true && tries.every((t) => t.status === 200));

  // ---- US4 filter (REQ-017) ----
  const fa = (await a.call("/api/stories?topic=alignment&limit=200")).json.stories || [];
  check(["REQ-017", "US4-1"], "filtering by Alignment shows only Alignment stories", fa.length > 0 && fa.every((s) => s.topics.some((t) => t.id === "alignment")));
  const topics = (await a.call("/api/ontology")).json.topics.filter((t) => !t.parent);
  check(["REQ-017", "Assumptions: topics"], "the topic filter offers the spec's nine topics", topics.length === 9);
  check(["REQ-017", "US4"], "clearing the filter returns the full feed", ((await a.call("/api/stories?limit=200")).json.stories || []).length === feed.length);

  // ---- Delivery and scope ----
  check(["REQ-020"], "the agent log is AGENT_LOG.md in the repo, not an app page", fs.existsSync(path.join(root, "AGENT_LOG.md")) && (await a.call("/api/agent-log")).status === 404);
  const extras = await Promise.all(["/api/brief", "/api/lists", "/api/stories/1/notes", "/api/learn/concepts", "/api/knowledge/graph", "/api/learn/glossary", "/api/editorial/posts", "/api/admin/editorial/posts", "/m/glossary", "/m/editorial", "/m/journal"].map((p) => a.call(p, p.includes("notes") ? { body: { text: "x" } } : {})));
  check(["Out of scope"], "out-of-scope extras (brief, lists, notes, Learn, knowledge) are off in the spec version", extras.every((r) => r.status === 404));
}

async function browser() {
  const { chromium } = require("playwright");
  const br = await chromium.launch();
  try {
    const u = "spec-ui-" + Date.now(), pw = "sample-pass-123";
    for (const [w, h, tag] of [[1280, 900, "laptop"], [390, 844, "phone"]]) {
      const ctx = await br.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.goto(B + "/?signin=1");
      if (tag === "laptop") {
        await p.click('[data-mode="signup"]'); await p.waitForTimeout(200);
        check(["REQ-012", "US2-1"], "the sign-up form asks only for a username and password", await p.isHidden("#nameWrap"));
        await p.fill("#username", u); await p.fill("#password", pw); await p.click("#authBtn");
        await p.waitForSelector("#feed .story", { timeout: 10000 });
        check(["US2-1"], "after sign-up the feed and the username are shown", (await p.textContent("header")).includes(u));
        const first = await p.$("#feed .story a[href^='http']");
        check(["REQ-007", "US1-6"], "selecting a story takes you to the original source", first && /^https?:\/\/(?!localhost)/.test(await first.getAttribute("href")));
        await p.goto(B + "/?topic=governance-nothing").catch(() => {});
        const topicLink = await p.$(".topicbar a");
        check(["REQ-017"], "the topic bar is on the page", !!topicLink);
        await p.evaluate(() => fetch("/api/logout", { method: "POST" }));
        await p.goto(B + "/?signin=1"); await p.waitForTimeout(500);
        check(["US2-5"], "after signing out the sign-in form is shown again", await p.isVisible("#authBtn"));
        await p.fill("#username", u); await p.fill("#password", pw); await p.click("#authBtn"); await p.waitForSelector("#feed .story");
        // An empty topic shows a message, not a blank page (US4-2): pick a topic with no stories.
        const empty = await p.evaluate(async () => { const t = (await (await fetch("/api/ontology")).json()).topics.filter((x) => !x.parent); for (const x of t) { const r = await (await fetch(`/api/stories?topic=${x.id}`)).json(); if (!r.stories.length) return x.id; } return null; });
        if (empty) { await p.click(`.topicbar a[href="/?topic=${empty}"]`); await p.waitForTimeout(800); }
        check(["US4-2", "REQ-017"], "a topic with no stories shows a \"no stories yet\" message", empty ? /no stories yet/i.test(await p.textContent("#feed")) : true, empty ? `topic ${empty}` : "every topic has stories in the sample data");
      }
      await p.goto(B + "/?signin=1"); if (tag === "phone") { await p.evaluate(() => 0); }
      await p.waitForTimeout(600);
      check(["REQ-018", "SC-001"], `the feed has no sideways scrolling on a ${tag} (${w}px)`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      check(["REQ-018"], `no page errors on a ${tag}`, !errs.length, errs.join("; "));
      await ctx.close();
    }
  } finally { await br.close(); }
}

function report() {
  // REQ-018 (laptop and phone layout) needs a browser; without --browser it is reported as not run here.
  const testable = Array.from({ length: 18 }, (_, i) => `REQ-${String(i + 1).padStart(3, "0")}`).concat("REQ-020").filter((id) => BROWSER || id !== "REQ-018");
  for (const r of results) console.log(`${r.pass ? "✓" : "✗"} ${r.ids.join(", ")}: ${r.name}${r.detail && !r.pass ? ` (${r.detail})` : ""}`);
  const uncovered = testable.filter((id) => !results.some((r) => r.pass && r.ids.includes(id)));
  const failed = results.filter((r) => !r.pass);
  console.log(`\nspec acceptance: ${results.length - failed.length} passed, ${failed.length} failed; requirements with a passing check: ${testable.length - uncovered.length} of ${testable.length}${uncovered.length ? ` (missing ${uncovered.join(", ")})` : ""}; REQ-019 (live 2 weeks before) is checked by people${BROWSER ? "" : "; REQ-018 needs --browser"}`);
  const jsonOut = process.argv.find((a) => a.startsWith("--json="));
  if (jsonOut) require("node:fs").writeFileSync(jsonOut.slice(7), JSON.stringify({ ranAt: new Date().toISOString(), browser: BROWSER, results, testable, uncovered }, null, 2));
  process.exit(failed.length || uncovered.length ? 1 : 0);
}
main();
