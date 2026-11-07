#!/usr/bin/env node
// Agent check-in: what is waiting on whom, and the next action for each, so agents keep work moving and people see what
// only they can decide. Reads the spec files, the project config and the database (same DATABASE_URL / DATA_DIR as the
// server); writes out/checkin/<date>.md and prints it. Changes nothing: agents never approve requirements, merge or deploy.
//   node scripts/checkin.js            (npm run checkin)
const fs = require("node:fs"), path = require("node:path"), { execSync } = require("node:child_process");
const root = path.join(__dirname, "..");

// Counts of research-layer work waiting for a person. Shared with scripts/project-sync.js. Tables that a version of
// the site doesn't have (the spec version has no review desk) count as zero.
async function waiting(db, today = new Date().toISOString().slice(0, 10)) {
  const n = async (sql, ...a) => { try { return Number((await db.get(sql, ...a))?.n || 0); } catch { return 0; } };
  return {
    forecastsDue: await n("SELECT COUNT(*) AS n FROM review_events WHERE status = 'pending' AND due <= ?", today),
    forecastsPending: await n("SELECT COUNT(*) AS n FROM review_events WHERE status = 'pending'"),
    reviewsForPerson: await n("SELECT COUNT(*) AS n FROM review_docs WHERE needs_person = 1 AND label IS NULL"),
    jobsQueued: await n("SELECT COUNT(*) AS n FROM learn_jobs WHERE status IN ('queued', 'needs-agent')"),
    jobsFailed: await n("SELECT COUNT(*) AS n FROM learn_jobs WHERE status = 'failed'"),
  };
}

function proposals() {
  const f = path.join(root, "specs", "002-research-layer", "spec.md");
  if (!fs.existsSync(f)) return { status: "", reqs: [] };
  const t = fs.readFileSync(f, "utf8");
  return { status: (t.match(/\*\*Status\*\*:\s*([^\n]+)/) || [, ""])[1], reqs: [...t.matchAll(/^- \*\*(REQ-\d{3})\*\*: ([^\n]+)/gm)].map((m) => ({ id: m[1], text: m[2].slice(0, 140) })) };
}
function branches() {
  try {
    const out = execSync("git branch -r --format='%(refname:short) %(committerdate:short)'", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const merged = new Set(execSync("git branch -r --merged origin/main --format='%(refname:short)'", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean));
    return out.split("\n").filter((l) => /origin\/feature\/paper-watch-/.test(l)).map((l) => { const [b, d] = l.split(" "); return { branch: b.replace(/^origin\//, ""), date: d, merged: merged.has(b) }; }).filter((b) => !b.merged);
  } catch { return []; }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const db = require("../lib/db"), { createKernel } = require("../kernel/kernel"), k = createKernel();
  db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
  const W = await waiting(db, today), P = proposals(), CFG = require("../modules/project/sync.json"), B = branches();
  const L = [`# Agent check-in, ${today}`, "", "What is waiting, on whom, and the next action. Agents do the agent rows; people rows need John or Matt. Nothing here approves, merges or deploys.", ""];
  L.push("## Waiting on both partners", "", `Spec 002 status: ${(P.status || "unknown").replace(/\.$/, "")}.`, "");
  for (const r of P.reqs) L.push(`- **${r.id}** awaiting approval: ${r.text}… Next: John and Matt approve it or drop it.`);
  L.push("", "## Waiting on a person", "");
  for (const [id, text] of Object.entries(CFG.people)) L.push(`- **${id}**: ${text}`);
  L.push(`- **Forecasts due:** ${W.forecastsDue} of ${W.forecastsPending} pending. Next: mark each on its topic's dossier (/m/dossier).`);
  L.push(`- **Reviews sent to a person:** ${W.reviewsForPerson}. Next: agree or disagree on the Review desk (/m/review).`);
  L.push(`- **Paper-watch branches not merged:** ${B.length ? B.map((b) => `${b.branch} (${b.date})`).join(", ") : "none"}. Next: John reviews and opens the pull request, or deletes the branch.`);
  L.push("", "## Agents' own queue", "");
  L.push(`- **Studio jobs queued:** ${W.jobsQueued}${W.jobsFailed ? `; failed: ${W.jobsFailed} (retry or close with a note)` : ""}. Next: the daily task does at most one paper-to-code toy; \`npm run learn:worker\` does the rest.`);
  L.push("- **Keep in step:** run `npm run project:sync` where the tracker lives, so each item above has one issue (sync-key) that moves to Done when it's done.");
  L.push("", "## Rules", "", "Agents never approve a requirement, write agent-log entries, push to main or Matt's branches, merge or deploy. Commits carry no trailers and no assistant or model names.");
  const md = L.join("\n") + "\n", dir = path.join(root, "out", "checkin");
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${today}.md`), md);
  console.log(md);
  return W;
}

module.exports = { waiting, proposals };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error("checkin:", e.message); process.exit(1); });
