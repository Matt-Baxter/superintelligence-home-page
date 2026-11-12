// Vercel entry point: every /api/* request is handled by the same Express app used locally.
module.exports = require("../server").app;
