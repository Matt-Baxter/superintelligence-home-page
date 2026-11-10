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
  }
  process.exit(0);
});
