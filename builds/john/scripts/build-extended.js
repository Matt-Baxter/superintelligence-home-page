// Builds the extended version's browser files (all module blocks and pages) before the browser test, which runs the
// extended site. Preflight builds the spec version, so without this the test could run against the wrong bundle.
const { execSync } = require("node:child_process");
execSync("npm run build", { stdio: "inherit", env: { ...process.env, SITE_PROFILE: "extended" } });
