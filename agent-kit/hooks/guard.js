#!/usr/bin/env node
// PreToolUse guard: blocks actions the repo's hard rules forbid. Reads the hook event on stdin;
// exit code 2 blocks the tool call and shows the reason to the agent. Anything unexpected → allow (exit 0).
const { execSync } = require("node:child_process");
let raw = "";
process.stdin.on("data", (c) => (raw += c)).on("end", () => {
  let ev; try { ev = JSON.parse(raw); } catch { process.exit(0); }
  const tool = ev.tool_name || "", input = ev.tool_input || {};
  const block = (why) => { process.stderr.write(`Blocked by si-homepage-kit: ${why}\n`); process.exit(2); };

  if (tool === "Bash") {
    const cmd = String(input.command || "");
    const branch = () => { try { return execSync("git rev-parse --abbrev-ref HEAD", { cwd: ev.cwd || process.cwd(), stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };
    if (/\bgit\s+push\b[^\n;&|]*\b(origin\s+)?(main|master)\b/.test(cmd) || (/\bgit\s+push\b/.test(cmd) && ["main", "master"].includes(branch())))
      block("never push to main. Work on a feature/, fix/ or bakeoff/ branch; a human merges.");
    if (/\bgh\s+pr\s+merge\b/.test(cmd) || /\bgit\s+merge\b/.test(cmd) && ["main", "master"].includes(branch()))
      block("never merge into main. The human merges the pull request once preflight is green.");
    if (/\bvercel\b[^\n]*\b(deploy|--prod|promote|env\s+(add|rm))\b/.test(cmd) || /\bneonctl\b/.test(cmd))
      block("never deploy or change Vercel or Neon settings. Humans do that (docs/DEPLOY.md).");
  }
  if (["Write", "Edit", "MultiEdit"].includes(tool)) {
    const file = String(input.file_path || "");
    const text = [input.content, input.new_string, ...(input.edits || []).map((e) => e.new_string)].filter(Boolean).join("\n");
    if (/(sources|source-catalog)\.json$/.test(file) && /(twitter\.com|\/\/x\.com|nitter\.)/i.test(text))
      block("no Twitter/X sources (Paul's feedback). Use the person's blog or newsletter.");
    coordination(file, ev);
  }
  process.exit(0);
});

// Coordination (REQ-071, proposed): don't edit a file someone else (a person or another agent) has claimed, and don't
// edit a shared document (it needs both partners). Claims come from out/work/claims.json, which the Work board and
// `npm run work` keep current. Missing file or repo → allow.
function coordination(file, ev) {
  const path = require("node:path"), fs = require("node:fs");
  let root = path.dirname(path.resolve(ev.cwd || process.cwd(), file));
  for (let i = 0; i < 8 && root && !fs.existsSync(path.join(root, "modules", "work", "overlap.js")); i++) root = path.dirname(root);
  if (!root || !fs.existsSync(path.join(root, "modules", "work", "overlap.js"))) return;
  const O = require(path.join(root, "modules", "work", "overlap.js")), rel = path.relative(root, path.resolve(ev.cwd || process.cwd(), file)).split(path.sep).join("/");
  if (O.shared([rel]).length && process.env.SI_BOTH_PARTNERS_OK !== "1")
    process.stderr.write(`Blocked by si-homepage-kit: ${rel} is a shared document; changing it needs both partners' approval (CLAUDE.md). Stop and say so. If both have approved, set SI_BOTH_PARTNERS_OK=1.\n`), process.exit(2);
  let claims = []; try { claims = JSON.parse(fs.readFileSync(path.join(root, "out", "work", "claims.json"), "utf8")).claims || []; } catch { return; }
  let branch = ""; try { branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {}
  const me = process.env.SI_ACTOR || `agent:${branch || "local"}`, now = new Date().toISOString();
  const held = claims.find((c) => !c.soft && !c.released_at && c.expires_at > now && c.actor !== me && (c.files || []).some((f) => O.pathsOverlap(f, rel)));
  if (held) process.stderr.write(`Blocked by si-homepage-kit: ${rel} is claimed by ${held.actor} for ${held.task} until ${held.expires_at}. Pick other work (work_next), or ask them to release it. You are ${me} (set SI_ACTOR if that's wrong).\n`), process.exit(2);
}
