// Bundles the demo (sample data only) into one self-contained demo/index.html.
const { execFileSync } = require("node:child_process"), fs = require("node:fs"), path = require("node:path");
const root = path.join(__dirname, ".."), out = path.join(root, "demo", "demo.js");
execFileSync(require.resolve("esbuild/bin/esbuild"), [path.join(root, "demo", "demo.tsx"), "--bundle", "--minify", "--format=iife", "--jsx=automatic", '--define:process.env.NODE_ENV="production"', `--outfile=${out}`, "--log-level=warning"], { stdio: "inherit" });
const css = fs.readFileSync(path.join(root, "registry", "agent-ui", "agent-ui.css"), "utf8") + fs.readFileSync(path.join(root, "demo", "demo.css"), "utf8");
const js = fs.readFileSync(out, "utf8").replace(/<\/script>/g, "<\\/script>");
fs.writeFileSync(path.join(root, "demo", "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>agent-ui demo</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
fs.unlinkSync(out); console.log("agent-ui demo -> demo/index.html");
