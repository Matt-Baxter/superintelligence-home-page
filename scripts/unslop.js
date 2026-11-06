#!/usr/bin/env node
// Unslop check: flags the patterns that make UI look AI-generated (agent-kit/skills/ui-design/references/slop-gates.md).
//   node scripts/unslop.js          print findings; exit 1 on any error
//   node scripts/unslop.js --json   machine-readable
// Allow a deliberate exception with `unslop-ok: <reason>` on the same line.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");

function walk(dir, test, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out); else if (test(p)) out.push(p);
  }
  return out;
}
function files() {
  const pub = walk(path.join(root, "public"), (p) => /\.(html|css)$/.test(p) && !p.includes(`${path.sep}m${path.sep}`) && !p.includes(`${path.sep}vendor${path.sep}`));
  const mods = walk(path.join(root, "modules"), (p) => (/[\\/]pages[\\/].*\.html$/.test(p)) || /[\\/]blocks[\\/].*render\.jsx$/.test(p));
  return [...pub, ...mods];
}

const BUZZ = /\b(unlock(?:s|ing)?|supercharg\w*|seamless(?:ly)?|elevate[sd]?|revolutioni[sz]\w*|cutting[- ]edge|game[- ]?changer|dive in|fast-paced world|harness the power)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function hueOf(hex) {
  let h = hex.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return null; // greyish
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (hue * 60 + 360) % 360;
}
function ms(v) { const m = String(v).match(/([\d.]+)\s*(ms|s)\b/); return m ? (m[2] === "s" ? parseFloat(m[1]) * 1000 : parseFloat(m[1])) : 0; }

function check(file, text) {
  const out = [], rel = path.relative(root, file), lines = text.split("\n");
  const isCss = file.endsWith(".css"), hasMotion = /(@keyframes|animation\s*:|transition\s*:)/.test(text);
  const add = (level, i, rule, msg) => { if (!/unslop-ok:\s*\S/.test(lines[i] || "")) out.push({ level, file: rel, line: i + 1, rule, msg }); };
  lines.forEach((ln, i) => {
    if (/transition\s*:\s*all\b/.test(ln)) add("error", i, "transition-all", "transition: all - name the properties");
    for (const m of ln.matchAll(/cubic-bezier\(([^)]*)\)/g)) { const v = m[1].split(",").map(Number); if (v.length === 4 && (v[1] > 1 || v[1] < 0 || v[3] > 1 || v[3] < 0)) add("error", i, "bounce", `bouncy easing cubic-bezier(${m[1]}) - no bounce on everyday UI`); }
    if (/scale\(\s*0\s*\)/.test(ln) && /(transform|@keyframes|from|to|%)/.test(ln)) add("error", i, "scale-0", "scale(0) - start popovers at 0.95");
    for (const m of ln.matchAll(/(?:transition|animation)(?:-duration)?\s*:[^;"]*/g)) for (const d of m[0].matchAll(/[\d.]+m?s\b/g)) if (ms(d[0]) > 400 && !/infinite/.test(m[0])) add("error", i, "too-slow", `${d[0]} - keep everyday motion under 400ms`);
    if (/linear-gradient|radial-gradient/.test(ln)) { const hues = [...ln.matchAll(/#[0-9a-f]{3,6}\b/gi)].map((h) => hueOf(h[0])).filter((h) => h !== null); if (hues.some((h) => h >= 245 && h <= 295)) add("error", i, "purple-gradient", "purple/indigo gradient - the signature slop look"); }
    if (/background-clip\s*:\s*text/.test(ln)) add("error", i, "gradient-text", "gradient text");
    const visible = isCss ? "" : ln.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    if (!isCss && BUZZ.test(visible) && !/^\s*(\/\/|\*|const|let|var|function)/.test(ln)) add("error", i, "buzzword", `buzzword copy: "${visible.match(BUZZ)[0]}"`);
    if (!isCss && /<(h[1-3]|button|summary)\b[^>]*>[^<]*/.test(ln) && !/<(?:h[1-3]|button|summary)\b[^>]*aria-label=/.test(ln) && EMOJI.test(ln.match(/<(h[1-3]|button|summary)\b[^>]*>([^<]*)/)?.[2] || "")) add("warn", i, "emoji-icon", "emoji used as an icon in a heading or button");
    if (/box-shadow\s*:[^;]*\b([4-9]\d|\d{3})px/.test(ln) && Number(ln.match(/box-shadow\s*:\s*\S+\s+\S+\s+(\d+)px/)?.[1] || 0) > 40) add("warn", i, "big-shadow", "large blurred shadow");
    if (/@keyframes\s+[\w-]*(in|enter|open|show)\b/i.test(ln) || (/\.(enter|open|show)\b[^{]*\{[^}]*ease-in\b(?!-out)/.test(ln))) { if (/ease-in\b(?!-out)/.test(ln)) add("warn", i, "ease-in-entrance", "ease-in on an entrance - use ease-out"); }
  });
  if (!isCss && hasMotion && !/prefers-reduced-motion/.test(text)) {
    // page-level motion is fine when it only uses the app.css tokens/classes, which handle reduced motion
    const own = /@keyframes|animation\s*:\s*(?!var\()/.test(text);
    if (own) out.push({ level: "error", file: rel, line: 1, rule: "reduced-motion", msg: "defines its own animation without a prefers-reduced-motion rule" });
  }
  if (isCss && hasMotion && !/prefers-reduced-motion/.test(text)) out.push({ level: "error", file: rel, line: 1, rule: "reduced-motion", msg: "stylesheet animates but has no prefers-reduced-motion rule" });
  return out;
}

function run() {
  const all = [];
  for (const f of files()) all.push(...check(f, fs.readFileSync(f, "utf8")));
  return all;
}
module.exports = { run, check };

if (require.main === module) {
  const res = run();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(res, null, 2)); process.exit(res.some((r) => r.level === "error") ? 1 : 0); }
  for (const r of res) console.log(`${r.level === "error" ? "✗" : "!"} ${r.file}:${r.line}  ${r.rule}  ${r.msg}`);
  const e = res.filter((r) => r.level === "error").length, w = res.length - e;
  console.log(`unslop: ${files().length} files, ${e} error(s), ${w} warning(s)`);
  process.exit(e ? 1 : 0);
}
