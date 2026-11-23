// Fast checks of the module kernel (run by preflight). Uses the real modules and synthetic fixture modules.
const assert = require("node:assert");
const path = require("node:path");
// The dependency-order checks need every real module, so they run against the extended version (the spec version
// loads only the admin module).
process.env.SITE_PROFILE = process.env.SITE_PROFILE || "extended";
const { createKernel } = require("../kernel/kernel");
const FIX = path.join(__dirname, "fixtures", "modules");
let n = 0; const t = (name, fn) => { fn(); n++; };

t("real modules load in dependency order", () => {
  const k = createKernel(); const ids = k.modules.map((m) => m.id);
  assert.ok(ids.indexOf("blocks-core") < ids.indexOf("generative-ui") && ids.indexOf("generative-ui") < ids.indexOf("decision"));
});
t("a module can be unplugged", () => {
  const k = createKernel({ enabled: ["blocks-core", "generative-ui", "capabilities"] });
  assert.ok(!k.points.has("decision.judges") && k.nav({ admin: true }).every((x) => x.label !== "Decide"));
});
t("a missing dependency fails at boot with the module's name", () => {
  assert.throws(() => createKernel({ enabled: ["decision"] }), /Module "decision" requires "generative-ui"/);
  assert.throws(() => createKernel({ enabled: ["needs-missing"], modulesDir: FIX }), /requires "not-here"/);
});
t("an unknown extension point fails at boot", () => {
  assert.throws(() => createKernel({ enabled: ["bad-point"], modulesDir: FIX }), /unknown extension point "nothing.here"/);
});
t("signals and formats plug in, and contributions are recorded per module", () => {
  const k = createKernel({ enabled: ["sample-format", "sample-signal"], modulesDir: FIX });
  assert.deepEqual(k.modules.map((m) => m.id), ["sample-signal", "sample-format"]);
  assert.equal(k.store.formats[0].id, "sample-lines");
  assert.equal(k.describe().points.find((p) => p.id === "analysis.signals").contributions, 1);
  const analysis = require("../lib/analysis");
  analysis.registerSignal(k.store.signals[0]);
  const a = analysis.analyze({ title: "Sample post with sample-keyword (test data)" }, { kinds: ["community"] });
  const line = a.why.find((w) => w.factor === "Sample signal");
  assert.ok(line && line.points === 5, "signal points are capped at its max and shown as a why line");
  assert.equal(a.significance, a.why.reduce((s, w) => s + w.points, 0));
  const feeds = require("../lib/feeds"); feeds.FORMATS["sample-lines"] = k.store.formats[0].format;
  assert.equal(feeds.parse("sample-lines", "One (test data)\nTwo (test data)\n").length, 2);
});
t("judges: weighted totals are exact and external judges never invent a verdict", () => {
  const k = createKernel(); const judges = k.modules.find((m) => m.id === "decision").judges;
  const sample = require("../modules/decision/sample.json");
  const w = judges.get("weighted-criteria").judge(sample);
  assert.deepEqual(w.totals.map((x) => x.total), [79.5, 76]); assert.equal(w.recommendation.entry, "version-b");
  assert.equal(judges.get("clef").judge(sample).recommendation, null);
  assert.equal(judges.get("jev").judge({ ...sample, external: { recommendation: "version-b" } }).agreement.agrees, true);
  assert.throws(() => judges.get("weighted-criteria").judge({ ...sample, entries: sample.entries.slice(0, 1) }), /at least two entries/);
});
console.log(`kernel unit checks: ${n} passed`);
