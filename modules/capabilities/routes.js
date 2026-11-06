// Capability tracker API: capability areas this week vs last, benchmark mentions with reported scores,
// watched people and organizations, and the strongest signals. Bounded queries only (free tier).
async function snapshot({ db, tagger, storyRows }, uid, daysAsked) {
    const days = Math.min(90, Math.max(7, Number(daysAsked) || 7));
    const since = new Date(Date.now() - days * 864e5).toISOString(), before = new Date(Date.now() - 2 * days * 864e5).toISOString();
    const seen = "COALESCE(s.published_at, s.first_seen)", vis = "COALESCE(s.hidden, 0) = 0 AND COALESCE(s.in_scope, 1) = 1";
    const areas = ["superintelligence", "capabilities", "reasoning", "math", "coding", "agents", "long-horizon", "ai-rnd", "multimodal", "robotics", "science", "safety", "evals", "compute"];
    const counts = await db.all(`SELECT t.topic, SUM(CASE WHEN ${seen} >= ? THEN 1 ELSE 0 END) AS now, SUM(CASE WHEN ${seen} < ? THEN 1 ELSE 0 END) AS prev,
        MAX(CASE WHEN ${seen} >= ? THEN s.significance ELSE 0 END) AS top FROM story_topics t JOIN stories s ON s.id = t.story_id
      WHERE ${vis} AND ${seen} >= ? GROUP BY t.topic`, since, since, since, before);
    const byTopic = Object.fromEntries(counts.map((r) => [r.topic, r]));
    const topics = tagger.topicList();
    const bench = await db.all(`SELECT e.entity, e.value, e.unit, s.id, s.title, s.significance, ${seen} AS t FROM story_entities e JOIN stories s ON s.id = e.story_id
      WHERE e.kind = 'benchmark' AND ${vis} ORDER BY ${seen} DESC LIMIT 400`);
    const people = await db.all(`SELECT e.entity, COUNT(*) AS n, MAX(${seen}) AS latest FROM story_entities e JOIN stories s ON s.id = e.story_id
      WHERE e.kind = 'person' AND ${vis} AND ${seen} >= ? GROUP BY e.entity ORDER BY n DESC LIMIT 20`, before);
    const orgRows = await db.all(`SELECT s.orgs FROM stories s WHERE ${vis} AND ${seen} >= ? LIMIT 2000`, since);
    const orgCount = {}; orgRows.forEach((r) => JSON.parse(r.orgs || "[]").forEach((o) => (orgCount[o.id] = (orgCount[o.id] || 0) + 1)));
    const B = tagger.ontology.benchmarks || [], P = tagger.ontology.people || [];
    return {
      days,
      areas: areas.map((id) => ({ id, label: topics.find((t) => t.id === id)?.label || id, now: byTopic[id]?.now || 0, prev: byTopic[id]?.prev || 0, top: byTopic[id]?.top || 0 })),
      benchmarks: B.map((b) => {
        const rows = bench.filter((r) => r.entity === b.id);
        return { id: b.id, label: b.label, measures: b.measures, mentions: rows.length,
          latest: rows.slice(0, 5).map((r) => ({ id: r.id, title: r.title, value: r.value, unit: r.unit, t: r.t })),
          best: rows.filter((r) => r.value != null).sort((x, y) => y.value - x.value)[0] || null };
      }).filter((b) => b.mentions).sort((a, b) => b.mentions - a.mentions),
      people: people.map((p) => ({ id: p.entity, label: P.find((x) => x.id === p.entity)?.label || p.entity, n: p.n, latest: p.latest })),
      orgs: Object.entries(orgCount).map(([id, n]) => ({ id, label: tagger.orgList().find((o) => o.id === id)?.label || id, n })).sort((a, b) => b.n - a.n).slice(0, 15),
      signals: await storyRows(`${seen} >= ?`, [since], uid, { sort: "signal", limit: 10 }),
      watchlist: { people: P.map(({ id, label }) => ({ id, label })), benchmarks: B.map(({ id, label, measures }) => ({ id, label, measures })) },
    };
  }

module.exports = function mountCapabilities(app, deps) {
  app.get("/api/capabilities", deps.auth, deps.wrap((req) => snapshot(deps, req.user.id, req.query.days)));
};
module.exports.snapshot = snapshot;
