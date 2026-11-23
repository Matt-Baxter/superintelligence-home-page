// REQ-030: status reports must retain negative evidence and reject incomplete measurements. Synthetic test data.
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { buildReport } = require('../scripts/spec-status');
let passed = 0; const t = (name, fn) => { fn(); passed++; };
const spec = '# Sample spec (test data)\n\n- **REQ-901**: The system MUST meet the sample requirement.\n\n- **SC-901**: Sample criterion.\n\n### User Story 1 - Sample work\n\n**Acceptance Scenarios**:\n1. A sample action succeeds.\n\n';
const evidence = (results) => ({ ranAt: '2026-11-07T12:00:00Z', browser: true, results });
const good = { ids: ['REQ-901', 'SC-901', 'US1-1'], pass: true, name: 'Sample success (test data)' };
const make = (results, people = {}) => buildReport(evidence(results), { spec, people });
t('a failure wins over a success for the same requirement', () => { const r = make([good, { ...good, pass: false }]); assert.equal(r.state('REQ-901'), 'failing'); assert.ok(r.problems); assert.match(r.markdown, /Open or failing checks remain/); });
t('missing evidence is open, never a pass', () => { const r = make([{ ids: ['OTHER'], pass: true }]); assert.equal(r.state('REQ-901'), 'open'); assert.ok(r.problems); });
t('a complete successful sample passes without claiming production deployment', () => { const r = make([good]); assert.equal(r.problems, 0); assert.match(r.markdown, /does not prove a production redeployment/); });
t('human checks do not become automated passes', () => assert.equal(make([good], { 'REQ-901': 'People decide.' }).state('REQ-901'), 'people'));
t('measurement dates follow the app timezone across UTC midnight', () => { const r = buildReport({ ...evidence([good]), ranAt: '2026-11-08T01:00:00Z' }, { spec, people: {}, timeZone: 'America/Chicago' }); assert.match(r.markdown, /Measured on 2026-11-07/); });
t('production redeployment persistence stays a people check even with passing local evidence', () => assert.equal(buildReport(evidence([{ ...good, ids: ['SC-007'] }])).state('SC-007'), 'people'));
t('a suite failure outside a particular requirement still fails the report', () => assert.ok(make([good, { ids: ['RUN'], pass: false }]).problems));
t('malformed and empty evidence is rejected', () => { for (const r of [null, evidence([]), evidence([{ ids: [], pass: 'yes' }]), evidence([null]), evidence([{ ids: [42], pass: true }]), { ...evidence([good]), uncovered: { invalid: true } }, { ...evidence([good]), ranAt: 12345 }]) assert.throws(() => buildReport(r), /malformed/); });
t('CLI writes an honest failing report and exits nonzero', () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'si-status-')); const input = path.join(dir, 'input.json'), output = path.join(dir, 'status.md'); fs.writeFileSync(input, JSON.stringify(evidence([good, { ...good, pass: false }]))); const r = spawnSync(process.execPath, [path.join(__dirname, '../scripts/spec-status.js'), `--from=${input}`, `--out=${output}`], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.match(fs.readFileSync(output, 'utf8'), /Open or failing checks remain/); fs.rmSync(dir, { recursive: true, force: true }); });
t('current shared-spec report retains the unresolved scope interpretation',()=>assert.match(buildReport(evidence([good])).markdown,/Unresolved scope interpretation/));
console.log(`spec status unit: ${passed} passed, 0 failed`);
