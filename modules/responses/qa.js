// Quality checks on a built response (REQ-060, proposed), run after every render. Each check is guarded knowledge:
// it exists because a problem was found once (modules/responses/learnings.json says which, why, and the fix), and it
// fails loudly if that problem comes back. Some checks also feed measurements back into the production model
// (calibration), which is the part of "learning" that changes future plans rather than just catching mistakes.
//
// What counts as learned here: a problem is learned when it has (1) a recorded symptom and cause, (2) a fix, and
// (3) an automated guard - a QA check or a unit check - that would catch it again. learnings.json is that ledger;
// test/responses-unit.js fails if any entry's guard doesn't exist.
const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const Prod = require("../lab/production");
const has = (cmd, args = ["-version"]) => { try { execFileSync(cmd, args, { stdio: "ignore" }); return true; } catch { return false; } };
const dur = (f, stream) => { try { return Number(execFileSync("ffprobe", ["-v", "error", ...(stream ? ["-select_streams", stream] : []), "-show_entries", stream ? "stream=duration" : "format=duration", "-of", "default=nw=1:nk=1", f]).toString().trim().split("\n")[0]) || 0; } catch { return 0; } };

// One grey frame at time t, downscaled to w x h, as a byte array.
function frame(file, t, w = 160, h = 90) {
  return execFileSync("ffmpeg", ["-v", "error", "-ss", String(Math.max(0, t)), "-i", file, "-frames:v", "1", "-vf", `scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 });
}
const BG = 24; // the background's grey level is about 18

const CHECKS = {
  // L1: picture and voice drifted apart by frame rounding (0.8 s over 72 s) before the scene held to one clock.
  sync(pkg, dir) {
    const v = path.join(dir, "video.mp4"); if (!fs.existsSync(v)) return { skip: "no video.mp4" };
    const clock = pkg.plan.beats.reduce((n, b) => n + b.seconds, 0), pic = dur(v, "v:0"), aud = dur(v, "a:0");
    const worst = Math.max(Math.abs(pic - clock), aud ? Math.abs(aud - clock) : 0);
    return { ok: worst <= 0.35, value: Math.round(worst * 100) / 100, why: `picture ${pic.toFixed(2)} s, voice ${aud ? aud.toFixed(2) : "none"} s, narration clock ${clock.toFixed(2)} s` };
  },
  // L2: spoken lines read written labels aloud ("reports spread (seeds, runs, intervals or error bars)").
  speakable(pkg) {
    const bad = pkg.plan.beats.flatMap((b) => b.lines.filter((l) => /[()[\]{}]|\be\.g\.|\bi\.e\.|\bet al\b|\s[/&]\s/.test(l.text)).map((l) => `${b.id}: “${l.text.slice(0, 70)}”`));
    return { ok: !bad.length, value: bad.length, why: bad.length ? `written-only marks in spoken lines: ${bad.slice(0, 3).join("; ")}` : "every line reads aloud cleanly" };
  },
  // L2: very long or very fast lines are hard to follow; very slow ones drag.
  pace(pkg) {
    // Spoken words, not written ones: "41%" is said "forty-one percent".
    const spoken = (t) => t.split(/\s+/).reduce((n, w) => n + (/\d/.test(w) ? 2 : 1) + (/%/.test(w) ? 1 : 0), 0);
    // Speaking time only: the slot minus the gap and any deliberate pause (review fix).
    const rows = pkg.plan.beats.flatMap((b) => b.lines.map((l, i) => { const w = spoken(l.text), s = Math.max(0, ((b.slots || [])[i] || 0) - 0.12 - (l.pause || 0)); return { id: b.id, w, wpm: s ? (w / s) * 60 : 0, text: l.text }; }));
    // Learning L17: short phrases are naturally spoken fast (220+ words a minute is normal for a 7-word line), so the
    // per-line limit applies to lines of 12+ words; the whole narration is held to an explainer's pace.
    const long = rows.filter((r) => r.w > 28), odd = rows.filter((r) => r.wpm && r.w >= 12 && (r.wpm < 110 || r.wpm > 210));
    const W = rows.reduce((n, r) => n + r.w, 0), S = rows.reduce((n, r) => n + (r.wpm ? (r.w / r.wpm) * 60 : 0), 0), overall = S ? (W / S) * 60 : 0;
    const slow = overall && (overall < 130 || overall > 185);
    return { ok: !long.length && !odd.length && !slow, value: Math.round(overall), why: [long.length && `${long.length} lines over 28 words (${long.map((r) => r.id).join(", ")})`, odd.length && `${odd.length} long lines outside 110-210 words a minute`, slow && `overall ${Math.round(overall)} words a minute (aim for 130-185)`].filter(Boolean).join("; ") || `overall ${Math.round(overall)} spoken words a minute; ${rows.length} lines within pace` };
  },
  // L5: text that runs off the frame (first flow boxes spilled their labels). Looks at the frame just before each
  // beat fades out, when everything is on screen, for ink in the outer 3% of the picture.
  edges(pkg, dir) {
    const v = path.join(dir, "video.mp4"); if (!fs.existsSync(v) || !has("ffmpeg")) return { skip: "no video or ffmpeg" };
    const W = 160, H = 90, band = 3, hits = [];
    for (const b of pkg.plan.beats) {
      const px = frame(v, b.start + b.seconds - 0.6, W, H); let ink = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x < band || x >= W - band || y < band || y >= H - band) && px[y * W + x] > BG + 24) ink++; // +24: outlines (grey ~64) count too
      if (ink > 2) hits.push(`${b.id} (${ink} px)`);
    }
    return { ok: !hits.length, value: hits.length, why: hits.length ? `ink at the frame edge in: ${hits.join(", ")}` : "nothing touches the frame edge" };
  },
  // L5: a cue that should show something but the frame is nearly empty (an animation failed silently).
  blank(pkg, dir) {
    const v = path.join(dir, "video.mp4"); if (!fs.existsSync(v) || !has("ffmpeg")) return { skip: "no video or ffmpeg" };
    const W = 160, H = 90, empty = []; // content ink is text and fills, well above outlines
    for (const b of pkg.plan.beats) {
      let t = b.start, last = -1; b.lines.forEach((l, i) => { if (l.cue !== null) last = i; });
      if (last < 0) continue;
      for (let i = 0; i <= last; i++) t += b.slots[i];
      const px = frame(v, t - 0.25, W, H); let ink = 0; for (const p of px) if (p > BG + 40) ink++;
      if (ink < W * H * 0.004) empty.push(b.id);
    }
    return { ok: !empty.length, value: empty.length, why: empty.length ? `nearly empty frame after the last cue of: ${empty.join(", ")}` : "every beat shows its content" };
  },
  // L3: the plan's situation must agree with the analysis it came from.
  situation(pkg) {
    const S = Prod.parseSit(pkg.plan.search.situation), want = pkg.analysis.strength;
    return { ok: S.strength === want, value: S.strength === want ? 0 : 1, why: `plan: ${pkg.plan.search.situation}; analysis: ${want}` };
  },
  // L4: the model's assumed seconds per variant vs the seconds measured in this render. A gap is not a failure, but
  // a gap over 40% means plans were chosen on wrong lengths: calibrate (npm run respond -- ... --render --learn).
  calibration(pkg) {
    const V = Object.fromEntries(Prod.UNITS.flatMap((u) => u.variants.map((v) => [v.id, v])));
    const rows = pkg.plan.beats.filter((b) => V[b.variant]).map((b) => ({ variant: b.variant, model: V[b.variant].seconds, measured: b.seconds, ratio: b.seconds / V[b.variant].seconds }));
    const off = rows.filter((r) => r.ratio > 1.4 || r.ratio < 0.7);
    return { ok: !off.length, value: off.length, rows, why: off.length ? `model lengths off by more than 40%: ${off.map((r) => `${r.variant} ${r.model}→${r.measured.toFixed(1)} s`).join(", ")}` : "model lengths within 40% of the render" };
  },
  // L7: a number on screen or in the voice that the paper doesn't contain (the plan's own check, rerun on the package).
  cites(pkg) { const c = (pkg.checks || []).find((x) => x.id === "cites"); return c ? { ok: c.ok, value: c.ok ? 0 : 1, why: c.why } : { skip: "no plan checks" }; },
};

function run(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const results = Object.entries(CHECKS).map(([id, fn]) => { try { return { id, ...fn(pkg, dir) }; } catch (e) { return { id, ok: false, why: `check crashed: ${String(e.message).split("\n")[0]}` }; } });
  fs.writeFileSync(path.join(dir, "qa.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  return results;
}

// Fold measured beat lengths into the calibration file: a running mean per variant (learning L4).
function calibrate(dir, file = path.join(__dirname, "..", "lab", "production-calibration.json")) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  let cal = { about: "Seconds per explainer variant measured in real renders (running mean). Written by npm run respond -- <paper> --render --learn; read by modules/lab/production.js in place of the assumed seconds.", variants: {} };
  try { cal = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  // One measurement per paper per variant (re-learning the same paper replaces its value instead of piling on), and
  // the mean is over papers (review fix).
  for (const b of pkg.plan.beats) {
    const c = cal.variants[b.variant] || { seconds: 0, n: 0, by: {} }; c.by = c.by || {};
    c.by[pkg.slug] = Math.round(b.seconds * 100) / 100;
    const xs = Object.values(c.by); c.n = xs.length; c.seconds = Math.round((xs.reduce((t, x) => t + x, 0) / xs.length) * 100) / 100;
    cal.variants[b.variant] = c;
  }
  fs.writeFileSync(file, JSON.stringify(cal, null, 2) + "\n");
  Prod.applyCalibration(); // later papers in this process plan with what was just learned
  return cal;
}

module.exports = { run, calibrate, CHECKS };
