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

// Contrast (WCAG): relative luminance of a #hex colour, and the ratio between two.
function lum(hex) { let h = hex.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// The token sets in a stylesheet: the first :root block (light) and the :root inside prefers-color-scheme: dark.
function tokenSets(css) {
  const grab = (block) => Object.fromEntries([...String(block || "").matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{3,6})\b/gi)].map((m) => [m[1], m[2]]));
  const light = grab((css.match(/:root\s*\{([^}]*)\}/) || [])[1]), dark = grab((css.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/) || [])[1]);
  // Themes a reader or admin can switch to (modules/appearance): each :root[data-theme="x"] block, laid over light.
  const themes = [...css.matchAll(/:root\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}/g)].map((m) => [`theme ${m[1]}`, { ...light, ...grab(m[2]) }]);
  return [["light", light], ["dark", { ...light, ...dark }], ...themes];
}
// Text pairs that must stay readable (4.5:1, WCAG AA for body text).
// The second row is the grey ramp the themes set (public/css/app.css): ink and muted text on every surface, and the
// danger colour on the page and on its own wash.
const TEXT_PAIRS = [["fg", "bg"], ["fg", "surface"], ["muted", "bg"], ["muted", "surface"], ["warn", "warn-soft"], ["accent", "accent-soft"],
  ["ink", "paper"], ["ink", "wash"], ["ink", "tint"], ["ink-2", "paper"], ["mute", "paper"], ["mute", "wash"], ["mute", "tint"], ["danger", "paper"], ["danger", "danger-wash"]];
const FILLER = /^\s*(new!?|beta|hot|pro|ai|ai[- ]powered|powered by ai|featured|trending|popular|smart|magic|✨)\s*$/i;
const GENERIC_H1 = /^\s*(welcome(?: to [^<]*)?|dashboard|overview|home|get started|untitled|my page|main)\s*$/i;
const LOADING = /loading|aria-busy|skeleton|spinner|…<\/|Fetching|Working/i;

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
  lines.forEach((ln, i) => {
    // 3. Italics only where they mean something (a quote, a title, a term): not in headings, buttons or nav.
    if (!isCss && /<(h[1-3]|button|nav|summary)\b[^>]*>[^<]*<(em|i)>(?!<\/)/.test(ln)) add("warn", i, "italic-label", "italic word inside a heading, button or nav - unitalicize");
    if (isCss && /font-style\s*:\s*italic/.test(ln) && !/(quote|cite|caption|title|term|analogy|note)/i.test(ln.split("{")[0])) add("warn", i, "italic", "italic text outside quotes, titles or terms");
    // 4. Mono only for code, ids and numbers that line up: not for body text, headings or buttons.
    if (/font-family\s*:\s*(var\(--mono\)|[^;]*monospace)/.test(ln) && /(^|[\s,}])(body|h[1-3]|p|button|\.btn|label|nav|\.nav)\s*[,{]/.test(ln.split("{")[0] + "{")) add("warn", i, "mono-text", "monospace on body text, headings or buttons - keep mono for code and ids");
    if (!isCss) {
      // 1 and 13. Filler badges and embellishments.
      for (const m of ln.matchAll(/<(span|b|small|em|div)\b[^>]*class="[^"]*\b(badge|pill|chip)\b[^"]*"[^>]*>([^<]*)</g)) if (FILLER.test(m[3])) add("warn", i, "filler-badge", `filler badge "${m[3].trim()}" - delete it or say something specific`);
      if (/✨|\u{1F525}|\u{1F680}/u.test(ln.replace(/<script[\s\S]*?<\/script>/g, ""))) add("warn", i, "embellishment", "sparkle, fire or rocket glyph - remove the embellishment");
      // 9. Headlines that say what the page is for.
      const h1 = ln.match(/<h1\b[^>]*>([^<]+)<\/h1>/); if (h1 && GENERIC_H1.test(h1[1])) add("warn", i, "generic-headline", `generic headline "${h1[1].trim()}" - say what this page is for`);
      // 2. A label that the placeholder repeats word for word.
      const lab = ln.match(/<label\b[^>]*>\s*([^<]{2,40}?)\s*<(?:input|textarea)\b[^>]*placeholder="([^"]*)"/); if (lab && lab[1].trim().toLowerCase() === lab[2].trim().toLowerCase()) add("warn", i, "redundant-label", `label and placeholder both say "${lab[2]}" - drop one, or make the placeholder an example`);
    }
  });
  if (!isCss && /\.html$/.test(file)) {
    // 10. One primary action per view: several in one static page compete.
    const prim = lines.map((ln, i) => [ln, i]).filter(([ln]) => /class="btn primary\b|class="primary btn\b/.test(ln) && !/unslop-ok:/.test(ln));
    if (prim.length > 1) add("warn", prim[1][1], "many-ctas", `${prim.length} primary buttons on one page - keep one per view (or mark the others unslop-ok if they sit in separate views)`);
    // 19. A page that loads data should say so while it waits.
    // api() from public/js/api.js shows the shared loading state, so only raw fetch() calls need their own.
    const loads = /<script\b[\s\S]*[^.\w]fetch\s*\(/.test(text) || (/\bapi\s*\(/.test(text) && !/\/js\/api\.js/.test(text)), shows = LOADING.test(text);
    if (loads && !shows) out.push({ level: "warn", file: rel, line: 1, rule: "loading-state", msg: "loads data with no loading state - show 'Loading…' or aria-busy while it waits" });
    // 12. One icon style per page.
    const svgIcons = /<svg\b/.test(text), emojiIcons = /<(button|a|h[1-3])\b[^>]*>[^<]*[\u{1F300}-\u{1FAFF}]/u.test(text);
    if (svgIcons && emojiIcons) out.push({ level: "warn", file: rel, line: 1, rule: "mixed-icons", msg: "both drawn (SVG) and emoji icons - keep one style" });
  }
  if (isCss && /:root\s*\{/.test(text)) {
    // 15. Text contrast of the colour tokens, light and dark. 16. Headlines wrap in balanced lines.
    for (const [mode, t] of tokenSets(text)) for (const [a, b] of TEXT_PAIRS) if (t[a] && t[b]) { const c = contrast(t[a], t[b]); if (c < 4.5) out.push({ level: "error", file: rel, line: 1, rule: "contrast", msg: `--${a} on --${b} is ${c.toFixed(2)}:1 in ${mode} mode - text needs 4.5:1` }); }
    if (!/h1[^{]*\{[^}]*text-wrap\s*:\s*(balance|pretty)|text-wrap\s*:\s*balance[^}]*\}[^{]*/.test(text) && !/(^|[\s,}])h1\b[^{]*\{[^}]*text-wrap/m.test(text)) out.push({ level: "error", file: rel, line: 1, rule: "headline-wrap", msg: "headings have no text-wrap: balance - long titles break with one word on the last line" });
    // 18. Numbers that line up.
    if (!/tabular-nums/.test(text)) out.push({ level: "warn", file: rel, line: 1, rule: "tabular-nums", msg: "no tabular-nums anywhere - numbers in columns will jiggle" });
  }
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
