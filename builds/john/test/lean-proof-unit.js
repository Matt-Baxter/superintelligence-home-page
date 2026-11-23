#!/usr/bin/env node
// REQ-038/024: synthetic proof admission, including actual Lean negative controls.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {auditReport, checkSource} = require('../lib/lean-proof');
const lean = process.env.LEAN || 'lean', dir = fs.mkdtempSync(path.join(os.tmpdir(), 'si-lean-admission-'));
let n = 0;
const check = (fn, label) => {fn(); n++; console.log('✓ '+label);};
try {
  check(() => assert.throws(() => auditReport("'sample' does not depend on any axioms\n", ['missing'])), 'wrong theorem name cannot satisfy the audit');
  check(() => assert.throws(() => auditReport("'sample' does not depend on any axioms\n'sample' does not depend on any axioms\n", ['sample'])), 'duplicate reports cannot forge completeness');
  check(() => assert.throws(() => auditReport('', ['sample'])), 'missing report fails closed');
  check(() => assert.throws(() => auditReport("'sample' depends on axioms: [Sample.assume]\n", ['sample'])), 'custom assumptions fail admission');
  const run = source => checkSource({lean, source, theorems:['sample'], auditFile:path.join(dir,'Sample.lean')});
  check(() => assert.deepEqual(run('theorem sample : 2 + 2 = 4 := by decide').theorems, ['sample']), 'actual Lean accepts a completed synthetic proof');
  check(() => assert.throws(() => run('theorem sample : False := by sorry'), /Unfinished proof/), 'Lean-accepted sorry is rejected by admission');
  check(() => assert.throws(() => run('axiom invented : False\ntheorem sample : False := invented'), /Unapproved axiom/), 'Lean-accepted custom axiom cannot manufacture a proof');
  check(() => assert.throws(() => run('theorem sample : 2 + 2 = 5 := by decide')), 'compiler rejection cannot become success');
  check(() => assert.throws(() => run('def sample := 4')), 'a definition with no theorem audit is rejected');
  console.log(`Lean admission: ${n} passed, 0 failed.`);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
