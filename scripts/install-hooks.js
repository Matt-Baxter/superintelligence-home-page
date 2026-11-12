#!/usr/bin/env node
// Installs a git pre-push hook that runs `npm run preflight`. Runs automatically on `npm install` (the "prepare" script).
// Skips quietly where there's no .git folder (Vercel builds, zip downloads). Skip one push with `git push --no-verify`.
const fs = require("node:fs"), path = require("node:path");
const hooks = path.join(__dirname, "..", ".git", "hooks");
if (!fs.existsSync(hooks)) process.exit(0);
const hook = path.join(hooks, "pre-push");
fs.writeFileSync(hook, "#!/bin/sh\n# Installed by scripts/install-hooks.js\nnpm run -s preflight\n");
fs.chmodSync(hook, 0o755);
console.log("Installed git pre-push hook: runs `npm run preflight` before each push.");
