// Server-side builders that turn query results into json-render specs, validated against the catalog.
import { catalog } from "./catalog.mjs";

function builder() {
  const elements = {}; let n = 0;
  const el = (type, props = {}, children = [], extra = {}) => { const id = `${type.toLowerCase()}-${++n}`; elements[id] = { type, props, children, ...extra }; return id; };
  return { el, done: (root) => ({ root, elements }) };
}
export function check(spec) {
  const r = catalog.validate(spec);
  if (!r.success) throw new Error("Spec failed catalog validation: " + JSON.stringify(r.error?.issues ?? r.error ?? r).slice(0, 800));
  return spec;
}
const fmtDay = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const KIND_LABEL = { papers: "Papers", lab: "Lab blogs", "research-org": "Research orgs", forum: "Forums", newsletter: "Newsletters", academic: "Academic blogs", community: "Community", news: "News", policy: "Policy", submitted: "Reader-submitted" };

function storyRow(el, s) {
  const src = s.sources.map((x) => x.name);
  return el("StoryRow", {
    id: s.id, title: s.title, url: s.url, votes: s.votes, sources: s.nsources,
    meta: `${src.slice(0, 2).join(" · ")}${src.length > 2 ? ` +${src.length - 2} more` : ""}`,
    topics: s.topics.filter((t) => !t.via).map((t) => t.label).slice(0, 3),
  }, [], { on: { open: { action: "openStory", params: { id: s.id } } } });
}

/* Weekly brief: what moved this week, by topic, compared with last week. */
export function weeklyBrief({ start, end, stories, topics, prevCounts, kinds }) {
  const { el, done } = builder();
  const kids = [];
  const range = `${fmtDay(start)} – ${fmtDay(new Date(end.getTime() - 864e5))}`;
  const counts = {}; stories.forEach((s) => s.topics.forEach((t) => (counts[t.id] = (counts[t.id] || 0) + 1)));
  const multi = stories.filter((s) => s.nsources > 1).length;
  const nKinds = Object.keys(kinds).length;
  kids.push(el("Grid", { columns: 4 }, [
    el("Metric", { label: "Stories this week", value: String(stories.length), hint: range }),
    el("Metric", { label: "Covered by 2+ sources", value: String(multi), hint: "Grouped into one story", tone: multi ? "accent" : "neutral" }),
    el("Metric", { label: "Kinds of source", value: String(nKinds), hint: Object.keys(kinds).map((k) => KIND_LABEL[k] || k).slice(0, 3).join(", ") || "None yet" }),
    el("Metric", { label: "Reader votes", value: String(stories.reduce((a, s) => a + s.votes, 0)) }),
  ]));
  if (!stories.length) {
    kids.push(el("Callout", { tone: "neutral", title: "Nothing collected for this week yet", text: "Stories appear as sources are fetched. An admin can fetch now from the Sources page." }));
    return check(done(el("Stack", { gap: "md" }, kids)));
  }

  kids.push(el("Card", { title: "Top stories", subtitle: "Ranked by reader votes, how many independent sources covered it, and recency" },
    stories.slice(0, 8).map((s) => storyRow(el, s))));

  const hadLastWeek = Object.values(prevCounts).some((n) => n > 0);
  const top = topics.filter((t) => !t.parent).map((t) => ({ ...t, n: counts[t.id] || 0, prev: prevCounts[t.id] || 0 })).filter((t) => t.n).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...top.map((t) => t.n));
  kids.push(el("Card", { title: "Where the activity was", subtitle: hadLastWeek ? "Stories per topic this week, with the change from last week" : "Stories per topic this week" }, [
    el("BarList", { items: top.map((t, i) => ({ label: t.label, value: t.n, max, display: String(t.n),
      hint: !hadLastWeek ? undefined : t.prev ? `${t.n >= t.prev ? "+" : ""}${t.n - t.prev} vs last week` : "none last week", highlight: i === 0 })) }),
  ]));
  // "Rising" only means something once there is a previous week to compare with.
  const rising = hadLastWeek ? top.filter((t) => t.n >= 2 && t.n >= t.prev * 2).map((t) => t.label) : [];
  if (rising.length) kids.push(el("Callout", { tone: "accent", title: `Rising: ${rising.slice(0, 3).join(", ")}`, text: "At least double last week's story count." }));

  const sections = top.slice(0, 4).map((t) => {
    const items = stories.filter((s) => s.topics.some((x) => x.id === t.id)).slice(0, 3);
    return el("Card", { title: t.label, subtitle: `${t.n} stor${t.n === 1 ? "y" : "ies"}` }, [
      ...items.map((s) => storyRow(el, s)),
      el("Button", { label: `All ${t.label} stories` }, [], { on: { press: { action: "filterTopic", params: { topic: t.id } } } }),
    ]);
  });
  kids.push(el("Grid", { columns: 2 }, sections));
  return check(done(el("Stack", { gap: "md" }, kids)));
}

/* Agent log summary: how much was logged, by whom, and how it was written. */
export function agentLogSummary(rows) {
  const { el, done } = builder();
  if (!rows.length) return check(done(el("Callout", { tone: "neutral", title: "No submitted entries yet", text: "Each partner writes their own entries, in their own words. Start one with “New entry”." })));
  const by = {};
  rows.forEach((r) => { const k = r.author.name; (by[k] ||= { n: 0, typed: 0, pasted: 0, ms: 0 }); by[k].n++; by[k].typed += r.typed_chars; by[k].pasted += r.pasted_chars; by[k].ms += r.active_ms; });
  const pasted = rows.reduce((a, r) => a + r.pasted_chars, 0), typed = rows.reduce((a, r) => a + r.typed_chars, 0);
  const share = typed + pasted ? pasted / (typed + pasted) : 0;
  const kids = [el("Grid", { columns: 3 }, [
    el("Metric", { label: "Submitted entries", value: String(rows.length) }),
    el("Metric", { label: "Time spent writing", value: `${Math.round(rows.reduce((a, r) => a + r.active_ms, 0) / 6e4)} min` }),
    el("Metric", { label: "Pasted text", value: `${Math.round(share * 100)}%`, hint: `${pasted} of ${typed + pasted} characters`, tone: share > 0.25 ? "warn" : "good" }),
  ])];
  kids.push(el("Card", { title: "Entries by author" }, [
    el("Table", { columns: ["Author", "Entries", "Minutes writing", "Typed", "Pasted"], rows: Object.entries(by).map(([k, v]) => [k, String(v.n), String(Math.round(v.ms / 6e4)), String(v.typed), String(v.pasted)]) }),
  ]));
  return check(done(el("Stack", { gap: "md" }, kids)));
}
