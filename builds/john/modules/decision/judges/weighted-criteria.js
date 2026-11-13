// Built-in judge: the weighted sum of 0-10 scores per criterion, scaled to 0-100. Fully explained by its own arithmetic.
const { weighted } = require("../score");
const CLOSE = 3; // points out of 100; closer than this and the judge recommends merging or a tie-break

module.exports = {
  id: "weighted-criteria",
  name: "Weighted criteria",
  description: "Scores each entry 0-10 on criteria you weight in advance and adds them up to 0-100. Recommends the top entry, or a merge when the top two are within 3 points.",
  method: "builtin",
  judge(input) {
    const w = weighted(input), [a, b] = w.totals;
    const close = w.margin < CLOSE;
    return {
      judge: "weighted-criteria", method: "builtin", ...w,
      recommendation: close
        ? { entry: "merge", label: `Merge ${a.label} and ${b.label}, or break the tie`, reason: `Only ${w.margin} points apart (under ${CLOSE}). Take the best parts of each, or agree on a tie-break criterion.` }
        : { entry: a.entry, label: a.label, reason: `${a.label} leads by ${w.margin} points (${a.total} vs ${b.total}).` },
    };
  },
};
