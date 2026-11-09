// The synthetic fixture feeds (test/fixtures) are written as if published in the week of 2026-11-02. When the test
// server loads them it moves every date forward by whole weeks so they fall in last week (Monday to Sunday before the
// current week), on the same weekdays. Tests then never depend on today's date. FIXTURE_DATES=fixed keeps the dates.
const WRITTEN_WEEK = Date.UTC(2026, 10, 2); // Monday 2026-11-02
function mondayOf(t) { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); }
const fixed = () => process.env.FIXTURE_DATES === "fixed";
// Monday (YYYY-MM-DD) of the week the fixtures are dated in.
function fixtureWeek(now = Date.now()) { return new Date(fixed() ? WRITTEN_WEEK : mondayOf(now) - 7 * 864e5).toISOString().slice(0, 10); }
function shiftMs(now = Date.now()) { return fixed() ? 0 : Math.max(0, mondayOf(now) - 7 * 864e5 - WRITTEN_WEEK); }
function shiftItems(items, now = Date.now()) {
  const ms = shiftMs(now); if (!ms) return items;
  return items.map((it) => { const t = it.published ? Date.parse(it.published) : NaN; return Number.isNaN(t) ? it : { ...it, published: new Date(t + ms).toISOString() }; });
}
module.exports = { fixtureWeek, shiftItems, shiftMs };
