// Papers already turned into Lab examples (modules/lab/examples.json), by arXiv id. The paper watcher uses this to
// close paper-to-code jobs that are done and to skip queueing them again; the check-in uses it to count only open jobs.
const fs = require("node:fs"), path = require("node:path");
const arxivId = (u) => (String(u || "").match(/(\d{4}\.\d{4,5})/) || [])[1] || null;
function builtArxivIds(file = path.join(__dirname, "examples.json")) {
  const j = JSON.parse(fs.readFileSync(file, "utf8")), list = Array.isArray(j) ? j : j.examples || [];
  return new Set(list.map((x) => arxivId(x.source?.url)).filter(Boolean));
}
// True when a job's note names a paper that already has a Lab example.
const isBuilt = (note, ids = builtArxivIds()) => { const id = arxivId((String(note).match(/arxiv\.org\/\S+/) || [])[0]); return !!id && ids.has(id); };
module.exports = { arxivId, builtArxivIds, isBuilt };
