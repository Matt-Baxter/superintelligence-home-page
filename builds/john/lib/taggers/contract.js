// REQ-005/007: fail-loud adapter boundaries share the canonical identity and method vocabularies.
// Syntax validation is separate from vocabulary membership or database-row existence.
const ids = require('../ids');
const methods = new Set(require('../../schema/types.json').enums.TagMethod.values);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && Array.from(value).every(text);
const fail = (adapter, field, detail) => { throw new Error(`Tagger ${adapter?.id || '(unnamed)'} ${field}: ${detail}`); };
function qualified(value) {
  if (typeof value !== 'string') return null;
  const parsed = ids.parse(value);
  return parsed && parsed.qid === value ? parsed : null;
}
function adapter(value) {
  if (!object(value)) fail(value, 'contract', 'adapter must be an object');
  if (typeof value.namespace !== 'string' || !Object.hasOwn(ids.NAMESPACES, value.namespace)) fail(value, 'namespace', 'must be a registered namespace');
  if (typeof value.tag !== 'function') fail(value, 'tag', 'must be a function');
  if (value.edges !== undefined && typeof value.edges !== 'function') fail(value, 'edges', 'must be a function when provided');
  return value;
}
function tags(owner, output) {
  adapter(owner);
  if (!Array.isArray(output)) fail(owner, 'tags', 'must return an array');
  for (const [index, tag] of output.entries()) {
    const field = `tags[${index}]`;
    if (!object(tag)) fail(owner, field, 'must be an object');
    const node = qualified(tag.qid);
    if (!node || node.ns !== owner.namespace) fail(owner, `${field}.qid`, 'must be a canonical qualified id in the adapter namespace');
    if (!text(tag.label)) fail(owner, `${field}.label`, 'must be a nonempty string');
    if (!strings(tag.matched)) fail(owner, `${field}.matched`, 'must be an array of nonempty strings; an empty array is allowed');
    if (!methods.has(tag.method)) fail(owner, `${field}.method`, 'must be a canonical TagMethod');
    if (tag.score != null && (typeof tag.score !== 'number' || !Number.isFinite(tag.score) || tag.score < 0 || tag.score > 1)) fail(owner, `${field}.score`, 'must be finite and within [0,1], or null');
    if (tag.via != null && (node.ns !== 'topic' || typeof tag.via !== 'string' || !qualified(`topic:${tag.via}`))) fail(owner, `${field}.via`, 'must be a bare child-topic id on a topic tag, or null');
  }
  return output;
}
function edges(owner, output) {
  adapter(owner);
  if (!Array.isArray(output)) fail(owner, 'edges', 'must return an array');
  for (const [index, edge] of output.entries()) {
    const field = `edges[${index}]`;
    if (!object(edge)) fail(owner, field, 'must be an object');
    if (!qualified(edge.src) || !qualified(edge.dst)) fail(owner, field, 'endpoints must be canonical qualified ids');
    if (!text(edge.rel)) fail(owner, `${field}.rel`, 'must be a nonempty string');
    if (typeof edge.weight !== 'number' || !Number.isFinite(edge.weight) || edge.weight < 0) fail(owner, `${field}.weight`, 'must be finite and nonnegative');
    if (!strings(edge.evidence)) fail(owner, `${field}.evidence`, 'must be an array of nonempty strings; an empty array is allowed');
  }
  return output;
}
module.exports = { adapter, tags, edges };
