// Unit checks for scripts/hub.js (docs/HUB.md): generation is deterministic, --check passes on a fresh generate and
// fails on a stale or broken copy, and the link checker catches a broken relative link. Run: node test/hub-unit.js
const assert = require("node:assert"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), { spawnSync } = require("node:child_process");
const root = path.join(__dirname, ".."), hub = require("../scripts/hub.js");
let passed = 0; const t = (name, fn) => { fn(); passed++; };
const run = (...args) => spawnSync(process.execPath, [path.join(root, "scripts/hub.js"), ...args], { cwd: root, encoding: "utf8" });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "si-hub-"));

t("generating twice gives the same text", () => assert.strictEqual(hub.render(root), hub.render(root)));

t("--check passes on a fresh generate", () => {
  const out = path.join(tmp, "HUB.md");
  assert.strictEqual(run("--out", out).status, 0);
  assert.strictEqual(fs.readFileSync(out, "utf8"), hub.render(root));
  const r = run("--check", "--out", out); assert.strictEqual(r.status, 0, r.stderr); assert.match(r.stdout, /^hub: current/);
});

t("--check fails on a stale copy", () => {
  const out = path.join(tmp, "stale.md"); fs.writeFileSync(out, hub.render(root) + "\nedited by hand\n");
  const r = run("--check", "--out", out); assert.strictEqual(r.status, 1); assert.match(r.stderr, /stale/);
});

t("--check fails on a broken relative link", () => {
  const out = path.join(tmp, "broken.md"); fs.writeFileSync(out, hub.render(root).replace("](../AGENTS.md)", "](../NO_SUCH_FILE.md)"));
  const r = run("--check", "--out", out); assert.strictEqual(r.status, 1); assert.match(r.stderr, /broken link: \.\.\/NO_SUCH_FILE\.md/);
});

t("link checker: broken fixture fails, good links, anchors, URLs and code pass", () => {
  const dir = fs.mkdtempSync(path.join(tmp, "links-")); fs.writeFileSync(path.join(dir, "here.md"), "# here\n");
  const fixture = ["[ok](here.md)", "[anchor](here.md#here)", "[web](https://example.com/x.md)", "[top](#here)", "`[code](nowhere.md)`", "```\n[fenced](nowhere.md)\n```", "[broken](missing/file.md)"].join("\n");
  assert.deepStrictEqual(hub.brokenLinks(fixture, dir), ["missing/file.md"]);
});

t("quoted links are rebased to docs/", () => assert.strictEqual(hub.rebase("see [v0](../../docs/V0.md#x)", "handoff/prompts/v0.md"), "see [v0](V0.md#x)"));

t("the hub has every section and every skill", () => {
  const text = hub.render(root), c = hub.collect(root);
  for (const h of ["Start here", "Specs", "Skills", "Subagents", "Spec Kit commands", "Checks", "Measures", "Tips and pitfalls", "Where things live", "Open decisions for the humans"]) assert.ok(text.includes(`\n## ${h}\n`), h);
  for (const s of c.skills) assert.ok(text.includes(`/${s.d}/SKILL.md)`), s.d);
  assert.ok(c.checks.some((x) => x.name === "Hub"), "preflight's Hub check is listed");
  assert.deepStrictEqual(hub.brokenLinks(text, path.join(root, "docs")), []);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`hub unit checks: ${passed} passed, 0 failed`);
