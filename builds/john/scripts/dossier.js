#!/usr/bin/env node
// Write a topic dossier from the command line (no server needed): out/dossier/<topic>/post.md, social.md,
// dossier.json and storyboard.json. For the recorded video, queue a "dossier" Learn job and run the worker against a
// running site (scripts/learn-worker.js). A person publishes the drafts; nothing is posted.
//   node scripts/dossier.js <topic> [<topic> ...]     same DATABASE_URL / DATA_DIR as the server
const fs = require("node:fs"), path = require("node:path");
const topics = process.argv.slice(2);
if (!topics.length) { console.error("Usage: node scripts/dossier.js <topic-id> [...]  (topic ids: lib/ontology.json)"); process.exit(1); }
(async () => {
  const db = require("../lib/db"), { createKernel } = require("../kernel/kernel"), k = createKernel();
  db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
  const D = require("../modules/review/dossier"), Lab = require("../modules/lab/lab"), pre = require("../modules/lab/results.json").results;
  const { ontology } = require("../lib/tagger"), concepts = require("../modules/learn/data/concepts.json").concepts;
  const examples = Lab.EX.examples.filter((e) => pre[e.id]).map((e) => ({ ...e, verdict: pre[e.id].verdict }));
  const site = (process.env.SITE_URL || "").replace(/\/$/, "");
  for (const topic of topics) {
    if (!ontology.topics.some((t) => t.id === topic)) { console.log(`dossier: unknown topic ${topic}`); continue; }
    const d = D.analyse(await D.gather(db, topic), { examples, concepts }), dir = path.join(__dirname, "..", "out", "dossier", topic);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "post.md"), D.blog(d, site));
    fs.writeFileSync(path.join(dir, "social.md"), D.posts(d, site ? `${site}/m/dossier#${topic}` : "").map((x) => `## ${x.channel}\n\n${x.text}\n`).join("\n") + "\n(Drafts for a person to post. No Twitter/X.)\n");
    fs.writeFileSync(path.join(dir, "dossier.json"), JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(dir, "storyboard.json"), JSON.stringify(D.storyboard(d), null, 2));
    console.log(`dossier: ${d.label}: ${d.strength} (${d.why}); ${d.refs.length} references -> out/dossier/${topic}/`);
  }
  process.exit(0);
})().catch((e) => { console.error("dossier:", e.message); process.exit(1); });
