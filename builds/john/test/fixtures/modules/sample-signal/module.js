// Test fixture: adds a significance signal through "analysis.signals" (synthetic).
module.exports = { id: "sample-signal", version: "0.0.1", description: "Sample signal module (test data)",
  setup(ctx) { ctx.point("analysis.signals").add({ factor: "Sample signal", max: 5, score: ({ text }) => (/sample-keyword/.test(text) ? { points: 9, detail: "found sample-keyword" } : null) }); } };
