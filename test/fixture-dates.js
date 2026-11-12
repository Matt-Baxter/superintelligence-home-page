// Keeps the synthetic sample feeds current (test data only). The fixtures carry fixed dates from early November 2026,
// and the feed's default window is the last week, so as the calendar moves on every sample story would drop out of the
// feed and the browser test would see an empty page. The sample-data servers set FIXTURE_DATES=shift; then every
// timestamp in a fixture (ISO 8601 with a time, or RFC 822 as in RSS) moves by the same amount, so the newest sample
// is a day old and the gaps between samples stay as written. Date-only values (e.g. a forecast's "by 2027-06-30") stay.
const NEWEST = Date.parse("2026-11-04T12:00:00Z");
const shiftMs = () => Date.now() - 864e5 - NEWEST;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rfc822 = (d) => `${DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;

function shiftText(text, ms = shiftMs()) {
  return String(text)
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g, (s) => { const t = Date.parse(s); return Number.isNaN(t) ? s : new Date(t + ms).toISOString(); })
    .replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} (?:GMT|UT|UTC|[+-]\d{4})/g, (s) => { const t = Date.parse(s); return Number.isNaN(t) ? s : rfc822(new Date(t + ms)); });
}

module.exports = { shiftText, shiftMs, NEWEST };
