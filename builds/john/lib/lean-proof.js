// REQ-038/024: one axiom-admission policy for controlled, reviewed Lean sources.
// This audits proof assumptions; Lean execution is not a sandbox for untrusted code.
'use strict';
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const crypto = require('node:crypto');
const STANDARD_AXIOMS = Object.freeze(['propext', 'Classical.choice', 'Quot.sound']);
function auditReport(output, theorems) {
  assert.ok(theorems.length && new Set(theorems).size === theorems.length, 'Expected distinct theorem names');
  assert.doesNotMatch(output, /sorryAx|declaration uses 'sorry'/, 'Unfinished proof assumption');
  const reports = [...output.matchAll(/^'([^']+)' (?:depends on axioms: \[([^\]]*)\]|does not depend on any axioms)\s*$/gm)];
  assert.equal(reports.length, theorems.length, 'Each theorem must have exactly one axiom report');
  const found = new Set(), footprints = [];
  for (const [, name, list] of reports) {
    assert.ok(theorems.includes(name) && !found.has(name), 'Unexpected or duplicate theorem report: ' + name);
    found.add(name);
    const axioms = (list || '').split(',').map(s => s.trim()).filter(Boolean);
    footprints.push({name, axioms});
    for (const axiom of axioms) {
      assert.ok(STANDARD_AXIOMS.includes(axiom), 'Unapproved axiom: ' + axiom);
    }
  }
  return {theorems: [...theorems], footprints, allowedAxioms: [...STANDARD_AXIOMS]};
}
function checkSource({lean, source, theorems, auditFile}) {
  assert.ok(theorems.length && theorems.every(n => /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(n)), 'Explicit supported theorem names required');
  const toolVersion = execFileSync(lean, ['--version'], {encoding:'utf8', timeout:60000}).trim();
  assert.match(toolVersion, /^Lean \(version 4\./, 'Lean4 required');
  fs.writeFileSync(auditFile, source + '\n' + theorems.map(n => `example : ∃ P : Prop, P := ⟨_, @${n}⟩\n#print axioms ${n}`).join('\n') + '\n');
  const output = execFileSync(lean, [auditFile], {encoding:'utf8', timeout:300000, maxBuffer:4 * 1024 * 1024});
  return {...auditReport(output, theorems), toolVersion, sourceSha256:crypto.createHash('sha256').update(source).digest('hex'), output};
}
module.exports = {STANDARD_AXIOMS, auditReport, checkSource};
