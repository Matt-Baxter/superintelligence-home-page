// What to do next (REQ-068, proposed): rank the open tasks one actor may take, and say why, point by point, like the
// significance score. Nothing here assigns work; it suggests, and a claim is still the actor's own step.
const O = require("./overlap");
const W = { unblocks: 12, unblocksCap: 5, must: 15, should: 8, may: 3, approved: 10, advice: 4, adviceMax: 12, fit: 5, earlyPhase: 2, overlapClaim: -25, overlapBranch: -10, overlapTask: -3 };

function next(items, { actor = "", kind = "agent", askedBy = null, claims = [], branches = [], reqs = {}, advice = [], limit = 10 } = {}) {
  const out = [], skipped = [];
  const taken = new Set(claims.filter((c) => !c.soft && c.actor !== actor).map((c) => c.task));
  const minPhase = Math.min(...items.filter((i) => !i.done).map((i) => i.phase), 99);
  const open = items.filter((i) => !i.done);
  for (const i of open) {
    const el = O.eligible(i, kind, askedBy); if (!el.ok) { skipped.push({ key: i.key, why: el.why }); continue; }
    if (i.blockedBy.length) { skipped.push({ key: i.key, why: `waits for ${i.blockedBy.join(", ")}` }); continue; }
    if (taken.has(i.key)) { skipped.push({ key: i.key, why: "someone holds it" }); continue; }
    const reasons = [], add = (pts, why) => { if (pts) reasons.push({ pts, why }); };
    add(W.unblocks * Math.min(i.blocks.length, W.unblocksCap), i.blocks.length ? `unblocks ${i.blocks.length} task${i.blocks.length > 1 ? "s" : ""}${i.blocks.length > W.unblocksCap ? ` (counted up to ${W.unblocksCap})` : ""}` : "");
    const levels = i.reqs.map((r) => reqs[r] && reqs[r].level);
    add(levels.includes("MUST") ? W.must : levels.includes("SHOULD") ? W.should : levels.includes("MAY") ? W.may : 0, levels.includes("MUST") ? "serves a MUST" : levels.includes("SHOULD") ? "serves a SHOULD" : levels.includes("MAY") ? "serves a MAY" : "");
    add(i.reqs.some((r) => reqs[r] && reqs[r].status === "approved") ? W.approved : 0, "its requirement is approved");
    const tips = advice.filter((a) => a.reqs && a.reqs.some((r) => i.reqs.includes(r)) && a.severity !== "idea").length;
    add(Math.min(W.adviceMax, W.advice * tips), tips ? `${tips} open suggestion${tips > 1 ? "s" : ""} on its requirements` : "");
    add(i.who === "agent" && kind === "agent" ? W.fit : 0, "tagged for agents");
    add(i.phase === minPhase ? W.earlyPhase : 0, "earliest open phase");
    const c = O.check({ task: i.key, files: [], actor, kind, askedBy }, { claims, branches, items });
    if (c.hard.some((h) => h.type === "files")) add(W.overlapClaim, `files held by someone else: ${c.hard.filter((h) => h.type === "files").map((h) => h.actor).join(", ")}`);
    if (c.warn.some((w) => w.type === "branch")) add(W.overlapBranch, `an open branch changes the same files (${c.warn.find((w) => w.type === "branch").branches.length + " of them"})`);
    const twins = open.filter((o) => o !== i && O.overlapOf(o.files, i.files).length).length;
    add(twins ? W.overlapTask : 0, twins ? `${twins} other open task${twins > 1 ? "s touch" : " touches"} the same files` : "");
    out.push({ key: i.key, id: i.id, who: i.who, reqs: i.reqs, text: i.text, files: i.files, score: reasons.reduce((s, r) => s + r.pts, 0), reasons });
  }
  out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return { next: out.slice(0, limit), skipped, weights: W };
}

// Initiatives: groups of open tasks by requirement, ranked by how much they unblock and how ready they are, so a
// person sees "the next thing worth starting" rather than a flat list.
function initiatives(items, { reqs = {} } = {}) {
  const by = new Map();
  for (const i of items.filter((x) => !x.done)) for (const r of i.reqs.length ? i.reqs : ["(no REQ)"]) { if (!by.has(r)) by.set(r, []); by.get(r).push(i); }
  return [...by].map(([req, ts]) => ({ req, text: reqs[req] ? reqs[req].text : "", level: reqs[req] ? reqs[req].level : "", status: reqs[req] ? reqs[req].status : "",
    open: ts.length, ready: ts.filter((t) => !t.blockedBy.length).length, people: ts.filter((t) => t.who === "people").length, unblocks: ts.reduce((s, t) => s + t.blocks.length, 0), tasks: ts.map((t) => t.key) }))
    .sort((a, b) => b.unblocks - a.unblocks || b.ready - a.ready || a.req.localeCompare(b.req));
}

module.exports = { next, initiatives, W };
