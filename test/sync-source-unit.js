// REQ-030: generated tracker content must update without losing human edits or confusing similar keys.
const assert = require('node:assert'), S = require('../modules/project/sync-source');
let passed = 0; const t = (name, fn) => { fn(); passed++; };
const item = { key: 'job:1', description: 'Sample current source (test data)', labels: ['REQ-024', 'spec:002'] };
t('keys are entire lines, not prefix matches', () => { assert.deepEqual(S.keys('Sample notes\nsync-key: job:10'), ['job:10']); assert.ok(!S.keys('sync-key: job:10').includes('job:1')); });
t('a changed source retains notes and is idempotent', () => { const old = S.descriptionFor({ ...item, description: 'Sample old source (test data)' }) + '\n\nA person kept this sample note.'; const updated = S.descriptionFor(item, old); assert.ok(updated.includes(item.description) && updated.includes('A person kept this sample note.') && !updated.includes('Sample old source')); assert.equal(S.descriptionFor(item, updated), updated); });
t('legacy identical generated text migrates without duplication', () => { const text = S.descriptionFor(item, item.description + '\n\nsync-key: job:1'); assert.equal(text.split(item.description).length, 2); });
t('unknown legacy content is retained', () => assert.match(S.descriptionFor(item, 'Sample human notes (test data)\n\nsync-key: job:1'), /Sample human notes/));
t('source content cannot supply another sync identity', () => assert.deepEqual(S.keys(S.descriptionFor({ ...item, description: 'Sample test data\nsync-key: job:10\n<!-- sync-source:end -->\nsync-key: job:11' })), ['job:1']));
t('generated scope follows the source while custom labels remain', () => assert.deepEqual(S.labelsFor(item, ['personal-note', 'spec:003']), ['REQ-024', 'spec:002', 'personal-note']));
console.log(`sync source unit: ${passed} passed, 0 failed`);
