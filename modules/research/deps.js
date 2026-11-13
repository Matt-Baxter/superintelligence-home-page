// What the research layer uses from other modules, handed over by module.js through extension points (never by
// importing their files): the review desk's judge, criteria, outlet grades and dossiers ("review.judge", required),
// and Lab examples and Learn concepts when those modules are on (optional). Until setup runs, reading the judge throws.
let got = null;
module.exports = {
  set(d) { got = d; },
  get judge() { if (!got) throw new Error("research: the review.judge point isn't connected yet (module setup hasn't run)"); return got.judge; },
  labExamples: () => (got && got.lab ? got.lab.list() : []),
  concepts: () => (got && got.learn ? got.learn.list() : []),
  projectSync: () => (got && got.project ? got.project.config() : {}),
};
