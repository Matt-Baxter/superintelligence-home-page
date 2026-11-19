#!/usr/bin/env node
// Contract test for GET /api/stories, the shape the browser client (public/js/api.js) reads.
// Boots the fixture server on synthetic sample data, signs up a sample user and validates every story
// against a Zod schema. Renaming or retyping a field (for example published_at) must fail here.
// If this fails, fix the server; only change the schema when the client changes with it.
const { spawn } = require("node:child_process"), path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const { z } = require("zod");

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "must be an ISO date string");
const SourceLink = z.object({ name: z.string().min(1), kind: z.string().min(1), url: z.string().url(), title: z.string().nullable().optional() });
const Topic = z.object({ id: z.string().min(1) }).passthrough();
const Story = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  summary: z.string().nullable(),
  published_at: isoDate.nullable(),
  first_seen: isoDate,
  topics: z.array(Topic),
  orgs: z.array(z.unknown()),
  votes: z.number().int().nonnegative(),
  voted: z.boolean(),
  saved: z.boolean(),
  sources: z.array(SourceLink).min(1),
  nsources: z.number().int().positive(),
  significance: z.number(),
});
const StoriesResponse = z.object({ stories: z.array(Story).min(1), sort: z.enum(["top", "new", "votes", "signal"]) });

const root = path.join(__dirname, "..");
const port = 3900 + Math.floor(Math.random() * 300), B = `http://localhost:${port}`;
let passed = 0, failed = 0;
const check = (label, fn) => { try { fn(); passed++; console.log("✓ " + label); } catch (e) { failed++; console.log("✗ " + label + "\n    " + e.message.split("\n").join("\n    ")); } };

async function waitForServer(child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Fixture server exited early.");
    try { await fetch(B + "/api/me"); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("Fixture server did not start within 10 s.");
}

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "si-contract-"));
  const child = spawn(process.execPath, ["--no-warnings", "test/serve-fixtures.js"], {
    cwd: root, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, SITE_PROFILE: "spec", FIXTURE_SET: "spec" }, stdio: ["ignore", "ignore", "inherit"],
  });
  try {
    await waitForServer(child);
    const signup = await fetch(B + "/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "sample-contract", password: "sample-pass-2026" }) });
    const cookie = (signup.headers.get("set-cookie") || "").split(";")[0];
    check("signup returns 200 and a session cookie", () => { if (signup.status !== 200 || !cookie) throw new Error(`status ${signup.status}, cookie ${cookie ? "set" : "missing"}`); });

    const res = await fetch(B + "/api/stories", { headers: { cookie } });
    const body = await res.json();
    check("GET /api/stories returns 200", () => { if (res.status !== 200) throw new Error("status " + res.status); });
    check("response matches the stories contract (every field the client reads)", () => {
      const r = StoriesResponse.safeParse(body);
      if (!r.success) throw new Error(z.prettifyError(r.error));
    });
    check("stories are newest first by published_at / first_seen (REQ-002)", () => {
      const t = body.stories.map((s) => Date.parse(s.published_at || s.first_seen));
      for (let i = 1; i < t.length; i++) if (t[i] > t[i - 1]) throw new Error(`story ${i} is newer than story ${i - 1}`);
    });
  } catch (e) { failed++; console.log("✗ " + e.message); }
  finally { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); }
  console.log(`Stories API contract: ${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
