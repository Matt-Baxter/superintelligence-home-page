#!/usr/bin/env node
// The app describing itself (lib/meta.js, REQ-030): routes are read from Express, descriptions are merged by method and
// path, undescribed routes still show, and a description whose route has gone is reported as stale. Then the real
// modules: every action a module describes must match a route that module (or server.js) really mounts.
const fs = require("node:fs"), path = require("node:path"), express = require("express");
const M = require("../lib/meta"), { createKernel } = require("../kernel/kernel");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };

const app = express(), h = (q, s) => s.end();
app.get("/api/things", h); app.post("/api/things/:id/vote", h); app.get("/api/admin/things/:id", h); app.delete("/api/admin/things/:id", h); app.get("/page", h);
const c = M.catalog(app, [
  { id: "things.vote", method: "POST", path: "/api/things/:id/vote", title: "Vote on a thing", about: "Sample action (test data).", undo: "Vote again.", req: ["REQ-013"],
    params: [{ name: "id", in: "path", type: "number", about: "The thing's number." }, { name: "up", in: "body", type: "string", enum: ["yes", "no"], required: true }], module: "sample" },
  { id: "things.gone", method: "GET", path: "/api/removed", title: "A route that no longer exists", module: "sample" },
]);
const by = (id) => c.actions.find((a) => a.id === id);
ok(c.actions.length === 5 && c.actions.map((a) => `${a.method} ${a.path}`).join("|") === "GET /api/things|POST /api/things/:id/vote|GET /api/admin/things/:id|DELETE /api/admin/things/:id|GET /page", "every mounted route is listed once, in mount order");
const v = by("things.vote");
ok(v && v.described && v.title === "Vote on a thing" && v.module === "sample" && v.undo === "Vote again." && v.req[0] === "REQ-013", "a described route carries its title, module, undo and REQ");
ok(v.params.length === 2 && v.params[0].name === "id" && v.params[0].in === "path" && v.params[0].required && v.params[0].type === "number" && v.params[1].enum.length === 2, "path parameters are found from the route and merged with the described ones");
const und = c.actions.find((a) => a.path === "/api/admin/things/:id" && a.method === "DELETE");
ok(!und.described && und.title === null && und.effect === "write" && und.admin && und.params[0].name === "id", "an undescribed route still shows: write because it's a DELETE, admin because of its path, with its path parameter");
ok(c.actions.find((a) => a.path === "/api/things").effect === "read", "GET routes default to read");
ok(c.stale.length === 1 && c.stale[0].id === "things.gone", "a description whose route has gone is reported as stale, not listed as an action");
ok(c.coverage.routes === 4 && c.coverage.described === 1 && c.coverage.writes === 2, "coverage counts only /api/ routes: 4 routes, 1 described, 2 writes");
ok(M.HOW.length >= 4 && M.HOW.some((s) => /admin/.test(s)) && M.HOW.some((s) => /undo/.test(s)), "the catalog says how to use it (auth, admin, reads and writes, undo)");

// The real modules' descriptions against the routes they mount (stub dependencies: mounting only registers handlers).
const enabled = fs.readdirSync(path.join(__dirname, "..", "modules")).filter((d) => fs.existsSync(path.join(__dirname, "..", "modules", d, "module.js")));
const k = createKernel({ enabled }), real = express();
const pass1 = (q, s, n) => n && n();
k.mount(real, { db: {}, wrap: (f) => f, auth: pass1, admin: pass1, str: (x) => x, bad: () => {}, notFound: () => {}, feeds: {}, kernel: k, harvester: {} });
const serverSrc = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const R = M.catalog(real, k.actions());
const reallyStale = R.stale.filter((s) => !serverSrc.includes(`app.${s.method.toLowerCase()}("${s.path}"`));
ok(k.actions().length >= 15 && reallyStale.length === 0, `every described action matches a mounted route (${k.actions().length} described${reallyStale.length ? `; stale: ${reallyStale.map((s) => s.id).join(", ")}` : ""})`);
// The core app's own routes (lib/core-actions.js) against server.js.
const CORE = require("../lib/core-actions");
const coreMissing = CORE.filter((a) => !serverSrc.includes(`app.${a.method.toLowerCase()}("${a.path}"`));
ok(CORE.length >= 20 && coreMissing.length === 0, `every core description matches a route in server.js (${CORE.length}${coreMissing.length ? `; missing: ${coreMissing.map((a) => a.id).join(", ")}` : ""})`);
const ids = [...CORE, ...k.actions()].map((a) => a.id);
ok(new Set(ids).size === ids.length, "action ids are unique");
ok([...CORE, ...k.actions()].every((a) => a.title && a.about && /^[A-Z]/.test(a.title) && (a.req || []).every((r) => /^REQ-\d{3}$/.test(r))), "every described action has a title, a plain-words about and well-formed REQ ids");
ok([...CORE, ...k.actions()].filter((a) => (a.effect || (a.method === "GET" ? "read" : "write")) === "write").every((a) => a.undo), "every described write says how to undo it (or that it can't be)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
