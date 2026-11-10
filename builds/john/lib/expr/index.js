// si-expr: JSON AST rules that run the same in Node, Python, Rust and WebAssembly. See README.md.
const ev = require("./eval");
const build = require("./build");
const fs = require("fs"), path = require("path");
const RULES = path.join(__dirname, "..", "rules");
// Rule repository: lib/rules/<name>.json files are { about, input, output, rule }.
const cache = new Map();
function rule(name) {
  if (!cache.has(name)) { const f = path.join(RULES, `${name}.json`); if (!fs.existsSync(f)) throw new Error(`No rule "${name}" in lib/rules`); cache.set(name, JSON.parse(fs.readFileSync(f, "utf8"))); }
  return cache.get(name);
}
const run = (name, data) => ev.evaluate(rule(name).rule, data);
const rules = () => fs.readdirSync(RULES).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
module.exports = { ...ev, ...build, rule, run, rules, spec: require("./spec.json") };
