// Test fixture: adds a feed format through "feeds.formats" (synthetic).
module.exports = { id: "sample-format", version: "0.0.1", description: "Sample format module (test data)", requires: ["sample-signal"],
  setup(ctx) { ctx.point("feeds.formats").add("sample-lines", { label: "One item per line (test data)", parse: (body) => body.split("\n").filter(Boolean).map((t, i) => ({ title: t, url: `https://example.org/sample/${i}`, summary: "", published: null, authors: [] })) }); } };
