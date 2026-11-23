#!/usr/bin/env node
// Backend-only reference audit. No server, database, network or publication action.
const fs = require('node:fs'), path = require('node:path');
const { createVocabulary, renderDictionary } = require('../lib/vocabulary');
const root = path.join(__dirname, '..'), output = path.join(root, 'docs/DATA_DICTIONARY.md');
function inputs() {
  return { schema: require('../schema/types.json'), ontology: require('../lib/ontology.json'),
    concepts: require('../modules/learn/data/concepts.json'), glossary: require('../modules/learn/data/glossary.json'), namespaces: require('../lib/ids').NAMESPACES };
}
function run(command = 'gen') {
  if (!['gen','check','report'].includes(command)) throw new Error('Use dictionary.js gen, check or report.');
  const vocabulary = createVocabulary(inputs()), text = renderDictionary(vocabulary);
  if (command === 'gen') fs.writeFileSync(output, text);
  if (command === 'check' && (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== text)) throw new Error('docs/DATA_DICTIONARY.md is stale; run node scripts/dictionary.js gen.');
  const counts = { namespaces: vocabulary.namespaces.length, fields: vocabulary.fields.length, entries: vocabulary.entries.length, relationships: vocabulary.edges.length };
  if (command === 'report') console.log(JSON.stringify({ schema_version: vocabulary.version, ...counts, status: 'validated', public_exposure: false }, null, 2));
  else console.log(`Dictionary ${command}: ${counts.namespaces} namespaces, ${counts.fields} fields, ${counts.entries} entries, ${counts.relationships} relationships; validated.`);
  return counts;
}
module.exports = { inputs, run };
if (require.main === module) { try { run(process.argv[2]); } catch(e) { console.error(e.message); process.exitCode = 1; } }
