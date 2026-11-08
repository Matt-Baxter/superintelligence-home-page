// A source-owned block updates generated context while preserving notes outside it (REQ-030).
const BEGIN = '<!-- sync-source:start -->', END = '<!-- sync-source:end -->';
function keys(description) {
  const text = String(description || ''), start = text.indexOf(BEGIN), end = text.indexOf(END, start + BEGIN.length);
  const outside = start >= 0 && end >= start ? text.slice(0, start) + text.slice(end + END.length) : text;
  return outside.split(/\r?\n/).map((line) => line.match(/^sync-key: (.+)$/)?.[1]).filter(Boolean);
}
function descriptionFor(item, previous = '') {
  const source = String(item.description || '').replace(/<!-- sync-source:(?:start|end) -->/g, '(source block marker omitted)').trim(), marker = `sync-key: ${item.key}`;
  let notes = String(previous || '');
  const start = notes.indexOf(BEGIN), end = notes.indexOf(END, start + BEGIN.length);
  if (start >= 0 && end >= start) notes = notes.slice(0, start) + notes.slice(end + END.length);
  notes = notes.split(/\r?\n/).filter((line) => !/^sync-key: /.test(line)).join('\n').trim();
  if (start < 0 && notes === source) notes = '';
  // Unknown legacy content is retained, rather than guessing which text a person wrote.
  return `${BEGIN}\n${source}\n${END}\n\n${marker}${notes ? `\n\n${notes}` : ''}`;
}
function labelsFor(item, previous = []) {
  const authoritativeScope = item.labels.find((l) => /^spec:\d{3}$/.test(l));
  const product = /^product-(?:idea|slice):/.test(item.key || '');
  const sourceOwned = label => product && (/^(phase:|epic:)/.test(label) || ['scope-review','needs-spec'].includes(label));
  return [...new Set([...item.labels, ...previous.filter((l) => !sourceOwned(l) && (!authoritativeScope || !/^spec:\d{3}$/.test(l)))])];
}
module.exports = { keys, descriptionFor, labelsFor };
