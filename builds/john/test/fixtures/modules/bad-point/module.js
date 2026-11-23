module.exports = { id: "bad-point", version: "0.0.1", description: "Uses an extension point nobody declared (test data)", setup(ctx) { ctx.point("nothing.here").add({}); } };
