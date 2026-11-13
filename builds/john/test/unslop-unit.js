// Proves the unslop gates catch the patterns they claim to (agent-kit/skills/ui-design/references/slop-gates.md).
const assert = require("assert"), path = require("path");
const { check } = require("../scripts/unslop.js");
const f = (name) => path.join(__dirname, "..", name);
const rules = (file, text) => check(f(file), text).map((r) => r.rule);
const cases = [
  ["x.css", ".a { transition: all .2s; } @media (prefers-reduced-motion: reduce) {}", "transition-all"],
  ["x.css", ".a { transition: transform 200ms cubic-bezier(.34,1.56,.64,1); } @media (prefers-reduced-motion: reduce) {}", "bounce"],
  ["x.css", "@keyframes p { from { transform: scale(0) } } @media (prefers-reduced-motion: reduce) {}", "scale-0"],
  ["x.css", ".a { transition: opacity 900ms ease; } @media (prefers-reduced-motion: reduce) {}", "too-slow"],
  ["x.css", ".hero { background: linear-gradient(135deg, #6366f1, #a855f7); }", "purple-gradient"],
  ["x.css", ".t { background-clip: text; }", "gradient-text"],
  ["x.css", ".a { animation: spin 200ms; }", "reduced-motion"],
  ["p.html", "<h1>Unlock the future of AI</h1>", "buzzword"],
  ["p.html", "<button>🚀 Launch</button>", "emoji-icon"],
  ["p.html", '<span class="badge">New</span>', "filler-badge"],
  ["p.html", "<h2>Results for <em>this</em> week</h2>", "italic-label"],
  ["x.css", ".btn { font-family: var(--mono); } @media (prefers-reduced-motion: reduce) {}", "mono-text"],
  ["p.html", "<h1>Dashboard</h1>", "generic-headline"],
  ["p.html", "<label>Email<input placeholder=\"Email\"></label>", "redundant-label"],
  ["p.html", '<button class="btn primary">Save</button>\n<button class="btn primary">Publish</button>', "many-ctas"],
  ["p.html", "<script>fetch('/api/x').then(r => r.json())</script>", "loading-state"],
  ["x.css", ":root { --bg: #ffffff; --fg: #111111; --muted: #bbbbbb; } h1 { text-wrap: balance; } .n { font-variant-numeric: tabular-nums; }", "contrast"],
  ["x.css", ":root { --bg: #ffffff; --fg: #111111; } .n { font-variant-numeric: tabular-nums; }", "headline-wrap"],
];
for (const [file, text, rule] of cases) assert.ok(rules(file, text).includes(rule), `${rule} not caught in: ${text}`);
assert.deepStrictEqual(rules("x.css", ".a { transition: all .2s; } /* unslop-ok: legacy widget */ @media (prefers-reduced-motion: reduce) {}"), [], "unslop-ok exempts a line");
assert.deepStrictEqual(rules("x.css", ".a { transition: transform 150ms var(--ease-out); } @media (prefers-reduced-motion: reduce) {}"), [], "token motion passes");
assert.deepStrictEqual(rules("p.html", '<script src="/js/api.js"></script><script>api("/api/x")</script>'), [], "pages using the shared api() get its loading state");
console.log(`unslop unit checks: ${cases.length + 3} passed`);
