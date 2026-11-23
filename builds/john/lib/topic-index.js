// One validated hierarchy for tagging, scope roots and topic dossiers.
function createTopicIndex(topics) {
  const byId = new Map();
  for (const t of topics) { if (!t.id || byId.has(t.id)) throw new Error(`Duplicate or missing topic id: ${t.id}`); byId.set(t.id, t); }
  const ancestors = new Map(), descendants = new Map(topics.map(t => [t.id, []]));
  for (const t of topics) {
    const path = [], seen = new Set([t.id]); let parent = t.parent;
    while (parent) {
      if (!byId.has(parent)) throw new Error(`Missing parent ${parent} for ${t.id}`);
      if (seen.has(parent)) throw new Error(`Topic cycle at ${parent}`);
      seen.add(parent); path.push(parent); parent = byId.get(parent).parent;
    }
    ancestors.set(t.id, Object.freeze(path));
    for (const id of path) descendants.get(id).push(t.id);
  }
  for (const list of descendants.values()) Object.freeze(list);
  const empty = Object.freeze([]);
  return { byId, ancestors: id => ancestors.get(id) || empty, descendants: id => descendants.get(id) || empty, rootOf: id => ancestors.get(id)?.at(-1) || id };
}
module.exports = { createTopicIndex };
