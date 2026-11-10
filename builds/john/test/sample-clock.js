// The synthetic fixture feeds are dated 2026-11-02 to 2026-11-05, and the feed and brief default to "last week".
// Without this, every sample run silently loses stories as real time moves on (the browser test failed on 2026-11-09
// once the oldest fixture passed seven days). The sample server starts its clock at SAMPLE_NOW instead, and the clock
// keeps running, so durations and expiries still work. Test servers only; never loaded by server.js.
// SAMPLE_NOW=real turns it off.
const want = process.env.SAMPLE_NOW || "2026-11-06T12:00:00Z";
if (want !== "real") {
  const Real = Date, shift = Real.parse(want) - Real.now();
  if (Number.isFinite(shift) && shift < 0) {
    class SampleDate extends Real {
      constructor(...a) { if (a.length) super(...a); else super(Real.now() + shift); }
      static now() { return Real.now() + shift; }
    }
    globalThis.Date = SampleDate;
  }
}
