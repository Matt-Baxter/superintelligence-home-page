// "capability-snapshot": a json-render view built from live data (served by the generative-ui module at /m/view?name=capability-snapshot).
const { snapshot } = require("./routes");

module.exports = async (deps, req) => {
  const d = await snapshot(deps, req.user.id, req.query.days || 7);
  const els = {}; let n = 0;
  const el = (type, props = {}, children = [], extra = {}) => { const id = `${type.toLowerCase()}-${++n}`; els[id] = { type, props, children, ...extra }; return id; };
  const active = d.areas.filter((a) => a.now).sort((a, b) => b.now - a.now);
  const max = Math.max(1, ...active.map((a) => a.now));
  const kids = [
    el("Grid", { columns: 3 }, [
      el("Metric", { label: "Capability areas with activity", value: String(active.length), hint: `last ${d.days} days` }),
      el("Metric", { label: "Benchmarks mentioned", value: String(d.benchmarks.length), tone: d.benchmarks.length ? "accent" : "neutral" }),
      el("Metric", { label: "Strongest signal", value: String(d.signals[0]?.significance ?? 0), hint: d.signals[0]?.title?.slice(0, 60) || "none yet" }),
    ]),
    el("Card", { title: "Where capability work is moving", subtitle: `Stories per area, last ${d.days} days vs the ${d.days} before` }, [
      active.length ? el("BarList", { items: active.map((a, i) => ({ label: a.label, value: a.now, max, display: String(a.now), hint: `${a.now - a.prev >= 0 ? "+" : ""}${a.now - a.prev} vs previous`, highlight: i === 0 })) })
        : el("Text", { text: "No tagged stories in this window yet.", tone: "muted" }),
    ]),
  ];
  if (d.benchmarks.length) kids.push(el("Card", { title: "Benchmarks", subtitle: "Highest score reported next to each name; check sources before quoting" }, [
    el("Table", { columns: ["Benchmark", "Mentions", "Highest reported"], rows: d.benchmarks.slice(0, 10).map((b) => [b.label, String(b.mentions), b.best ? `${b.best.unit === "hours" ? b.best.value + " h" : b.best.value + "%"}` : "—"]) }),
  ]));
  kids.push(el("Card", { title: "Strongest signals" }, d.signals.slice(0, 5).map((s) => el("StoryRow", {
    id: s.id, title: s.title, url: s.url, votes: s.votes, sources: s.nsources,
    meta: `Significance ${s.significance} · ${s.analysis?.type?.label || "Update"}`, topics: s.topics.filter((t) => !t.via).map((t) => t.label).slice(0, 3),
  }, [], { on: { open: { action: "openStory", params: { id: s.id } } } }))));
  return { root: el("Stack", { gap: "md" }, kids), elements: els };
};
