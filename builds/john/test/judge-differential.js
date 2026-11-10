#!/usr/bin/env node
// REQ-038/T051: execute real Lean, audit theorem axioms, compare with production-derived JS vectors.
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), cwd = path.join(root, 'proofs');
const lake = process.env.LAKE || 'lake';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'si-proof-check-'));
function run(args) {
  return execFileSync(lake, args, {cwd, encoding:'utf8', timeout:300000, maxBuffer:8 * 1024 * 1024});
}
try {
  // Check the vector fixture against the current production judge before using its expectations.
  execFileSync(process.execPath, ['test/judge-lean-vectors.js'], {cwd:root, stdio:'pipe'});
  const version = run(['env', 'lean', '--version']).trim();
  assert.match(version, /version 4\.15\.0\b/, 'Use the pinned Lean toolchain');
  const build = run(['build']);
  assert.doesNotMatch(build, /declaration uses 'sorry'|sorryAx/);
  const source = fs.readFileSync(path.join(cwd, 'Judge.lean'), 'utf8');
  const names = [...source.matchAll(/^theorem (\w+)/gm)].map(m => 'Judge.' + m[1]);
  const statements = ['import Judge'];
  const concepts = require('../modules/learn/data/concepts.json').concepts;
  let toys = 0;
  for (const c of concepts.filter(c => c.lean?.proved)) {
    assert.ok(!c.lean.needs, `Claimed proved concept still needs dependencies: ${c.id}`);
    const ns = 'Toy' + toys++;
    statements.push(`namespace ${ns}`, c.lean.statement, `end ${ns}`);
    const declarations = [...c.lean.statement.matchAll(/\btheorem (\w+)/g)];
    assert.ok(declarations.length, `No theorem in ${c.id}`);
    names.push(...declarations.map(m => ns + '.' + m[1]));
  }
  const audit = path.join(dir, 'Audit.lean');
  fs.writeFileSync(audit, statements.concat(names.map(n => '#print axioms ' + n)).join('\n'));
  const audited = run(['env', 'lean', audit]);
  require('../lib/lean-proof').auditReport(audited, names);
  const vectors = require('../proofs/vectors.json'), expected = [], commands = [];
  const nat = n => { assert.ok(Number.isSafeInteger(n) && n >= 0); return String(n); };
  const emit = (label, expr, value) => {
    commands.push(`  IO.println (${JSON.stringify(label + '=')} ++ (${expr}))`);
    expected.push(label + '=' + value);
  };
  for (const v of vectors.cases) {
    const p = '(fun f => match f with ' + vectors.families.map(f => `| .${f} => ${v.presence[f] ? 'true' : 'false'}`).join(' ') + ')';
    const r = `(Judge.rigor ${p})`, h = `(Judge.hype ${nat(v.u)} ${nat(v.k)} ${nat(v.w)})`;
    const c = `(Judge.credibility ${r} ${h})`;
    for (const [key, expr] of Object.entries({rigor:r, hype:h, credibility:c, cap:`(Judge.cap ${r})`, score:`(Judge.guarded ${nat(v.base)} ${r} ${v.inj ? 'true' : 'false'})`})) {
      emit(`${v.id}.${key}`, `toString ${expr}`, v.expect[key]);
    }
    for (const b of v.expect.bands) emit(`${v.id}.band.${b.T}.${b.m}`, `bandText (Judge.band ${nat(b.T)} ${nat(b.m)} ${c})`, b.band);
  }
  for (const [i, r] of vectors.ratings.entries()) emit(`rating.${i}`, `ratingText (Judge.rating ${nat(r.credible)} ${nat(r.linked)} ${nat(r.papers)})`, r.expect);
  const evaluator = path.join(dir, 'Evaluate.lean');
  fs.writeFileSync(evaluator, ['import Judge', 'set_option maxRecDepth 8192',
    'def bandText : Judge.Band → String | .low => "low" | .border => "border" | .high => "high"',
    'def ratingText : Judge.Rating → String | .noneYet => "none yet" | .thin => "thin" | .early => "early" | .someSupport => "some support"',
    'def main : IO Unit := do', ...commands].join('\n'));
  const actual = run(['env', 'lean', '--run', evaluator]).trim().split('\n');
  assert.deepEqual(actual, expected, 'Actual Lean evaluator must match current JS-derived expectations');
  console.log(`Lean proof audit: ${names.length} theorems checked, ${toys} Learn toys checked, 0 unapproved axioms.`);
  console.log(`Lean differential: ${expected.length} comparisons passed, 0 failed.`);
  console.log(version);
} finally {
  fs.rmSync(dir, {recursive:true, force:true});
}
