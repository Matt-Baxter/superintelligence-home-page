// The synthetic fixture feeds (test/fixtures) are written as if published 2-6 November 2026. When the test server
// loads them it moves every date forward by whole days, so the newest one is 1-2 days old and the oldest under a week:
// the feed's default "last week" window and the weekly brief then always have the sample stories, whatever today's
// date is. FIXTURE_DATES=fixed keeps the written dates.
const DAY = 864e5;
const WRITTEN_NEWEST = Date.UTC(2026, 10, 6, 13); // newest date in any fixture file (Fri 6 Nov 2026, 13:00 UTC)
const WRITTEN_BASE = Date.UTC(2026, 10, 4, 12); // newest date in the three base feeds the browser test loads
const fixed = () => process.env.FIXTURE_DATES === "fixed";
function shiftMs(now = Date.now()) { return fixed() ? 0 : Math.max(0, Math.floor((now - DAY - WRITTEN_NEWEST) / DAY) * DAY); }
function mondayOf(t) { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); }
// Monday (YYYY-MM-DD) of the week that holds the newest base-feed story, so the brief for that week has stories.
function fixtureWeek(now = Date.now()) { return new Date(mondayOf(WRITTEN_BASE + shiftMs(now))).toISOString().slice(0, 10); }
function shiftItems(items, now = Date.now()) {
  const ms = shiftMs(now); if (!ms) return items;
  return items.map((it) => { const t = it.published ? Date.parse(it.published) : NaN; return Number.isNaN(t) ? it : { ...it, published: new Date(t + ms).toISOString() }; });
}
module.exports = { fixtureWeek, shiftItems, shiftMs };
