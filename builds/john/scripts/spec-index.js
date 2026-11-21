#!/usr/bin/env node
// Snapshot of the specs for the Project page's Specs view (REQ-030, proposed), written by `npm run build`.
// Vercel bundles only {lib,views,kernel,modules,schema}/** with the API function, so specs/ and docs/ aren't there at
// request time; GET /api/admin/project/specs reads the live files when present and this snapshot otherwise.
//   node scripts/spec-index.js     writes modules/project/data/specs.json (git-ignored, regenerated on every build)
const { writeSnapshot, SNAPSHOT } = require("../modules/project/specs");
const d = writeSnapshot();
console.log(`spec index: ${d.reqs.length} requirements in ${d.specs.length} specs -> ${require("node:path").relative(process.cwd(), SNAPSHOT)}`);
