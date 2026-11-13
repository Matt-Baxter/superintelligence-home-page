// UI review capture (review tooling, not part of the suite). Usage: start the sample server with SITE_PROFILE=extended
// PORT=3300 node test/serve-fixtures.js, then `npm i --no-save axe-core` once and OUT=<dir> node test/_ui-capture.js.
// every page the nav offers an admin, at desktop and phone width,
// with an accessibility scan (axe-core) and layout facts. Writes PNGs and audit.json to OUT.
const fs = require("fs"), path = require("path");
const { chromium } = (() => { try { return require("playwright"); } catch { return require("/opt/node-tools/node_modules/playwright"); } })();
const B = process.env.BASE || "http://localhost:3300", OUT = process.env.OUT;
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, bypassCSP: true }), p = await ctx.newPage();
  // Capture the signed-out home page first, then sign up (the first account is the admin).
  await p.goto(B + "/"); await p.waitForTimeout(800); fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, "signed-out-desktop.png") });
  await p.setViewportSize({ width: 390, height: 844 }); await p.screenshot({ path: path.join(OUT, "signed-out-phone.png") }); await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto(B + "/?mode=signup"); await p.waitForSelector("#auth:not([hidden])");
  await p.fill("#username", "reviewer"); if (await p.$("#displayName")) await p.fill("#displayName", "Reviewer"); await p.fill("#password", "correct-horse-9"); await p.click("#authBtn"); await p.waitForTimeout(1500);
  const me = await p.evaluate(async () => (await fetch("/api/me")).json());
  const nav = [["/", "Feed"], ["/brief", "Weekly brief"], ["/lists", "Reading lists"], ["/sources", "Sources"], ["/welcome", "About"], ...((me.user || me).nav || []).map((n) => [n.href, n.label])];
  const seen = new Set(), pages = nav.filter(([h]) => !seen.has(h) && seen.add(h));
  // a story page too
  const story = await p.evaluate(async () => { const r = await (await fetch("/api/stories?days=")).json(); const s = (r.stories || r.items || r)[0]; return s ? `/story?id=${s.id}` : null; }).catch(() => null);
  if (story) pages.splice(1, 0, [story, "Story"]);
  const audit = [];
  for (const [href, label] of pages) {
    const errors = []; const onErr = (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); }; p.on("console", onErr); p.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
    const t0 = Date.now(); let status = 0;
    try { const r = await p.goto(B + href, { waitUntil: "networkidle", timeout: 20000 }); status = r ? r.status() : 0; } catch (e) { errors.push("nav: " + e.message.slice(0, 100)); }
    await p.waitForTimeout(600); const ms = Date.now() - t0;
    const slug = (label || href).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";
    await p.setViewportSize({ width: 1280, height: 800 }); await p.screenshot({ path: path.join(OUT, `${slug}-desktop.png`) });
    const facts = await p.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const h1 = [...document.querySelectorAll("h1")].filter(vis).map((h) => h.textContent.trim().slice(0, 60));
      const heads = [...document.querySelectorAll("h1,h2,h3")].filter(vis).length;
      const buttons = [...document.querySelectorAll("button, .btn, [role=button]")].filter(vis).length;
      const links = [...document.querySelectorAll("a")].filter(vis).length;
      const inputs = [...document.querySelectorAll("input, select, textarea")].filter(vis).length;
      const navLinks = [...document.querySelectorAll("#siteNav a")].length;
      const fontSizes = [...new Set([...document.querySelectorAll("body *")].filter(vis).map((e) => getComputedStyle(e).fontSize))].length;
      const text = document.body.innerText.length;
      return { title: document.title, h1, heads, buttons, links, inputs, navLinks, fontSizes, textChars: text, height: document.documentElement.scrollHeight };
    });
    await p.addScriptTag({ content: axeSrc });
    const ax = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0]?.target?.join(" ") })); });
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
    const overflow = await p.evaluate(() => { const w = document.documentElement.clientWidth; const wide = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > w + 2 && getComputedStyle(e).position !== "fixed").slice(0, 3).map((e) => e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ")[0] : "")); return { scrollW: document.documentElement.scrollWidth, w, wide }; });
    const tap = await p.evaluate(() => [...document.querySelectorAll("a, button, input, select")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24); }).length);
    await p.screenshot({ path: path.join(OUT, `${slug}-phone.png`) });
    p.off("console", onErr);
    audit.push({ href, label, status, ms, ...facts, axe: ax, phone: { ...overflow, smallTargets: tap }, errors });
    console.log(`${String(status).padEnd(4)} ${String(ms).padStart(5)}ms ${label.padEnd(26)} h1:${facts.h1.length} nav:${facts.navLinks} btn:${facts.buttons} fonts:${facts.fontSizes} axe:${ax.map((v) => `${v.id}(${v.impact[0]}${v.n})`).join(",") || "-"} overflow:${overflow.scrollW > overflow.w ? overflow.wide.join("|") : "no"} small:${tap} err:${errors.length}`);
  }
  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(audit, null, 1));
  await browser.close();
})();
