// Animated explainer for a paper response (REQ-058, REQ-060; proposed), drawn with Manim Community (the open-source
// math-animation engine, MIT licence). Our own palette and layouts; no characters or branding from anyone's channel.
//
// Alignment is the point: the plan gives every beat a list of lines, each one spoken sentence with the one animation
// cue it triggers. Each line is voiced on its own, its length measured, and the scene plays the cue as the sentence
// starts and holds until it ends, so a bar grows while its number is said and a step appears as it's named.
//
// Low cost: everything runs on a CPU, off the web server (scripts/respond.js or the Learn worker).
//   voice: Kokoro (open-weight neural TTS, Apache-2.0, run locally through kokoro-onnx) when its model files are
//          present; else Piper (PIPER_MODEL); else espeak-ng; else captions only, timed from word counts.
//   picture: scene.py, one Manim scene, no LaTeX needed.  captions.srt: one cue per sentence, on the same clock.
//   ffmpeg: picture + voice + a subtitle track -> video.mp4.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { execFileSync } = require("node:child_process");
const has = (cmd, args = ["--version"]) => { try { execFileSync(cmd, args, { stdio: "ignore", timeout: 60000 }); return true; } catch { return false; } };
const py = (s) => JSON.stringify(String(s));
const PALETTE = { bg: "#0f1218", panel: "#171b23", ink: "#eceae4", mute: "#8d93a0", faint: "#3a404c", backed: "#5cc0a8", described: "#7fa3d6", partly: "#e0b45a", missing: "#6b7280", bad: "#e07a62", accent: "#5cc0a8" };
const LEVEL_COLOR = { backed: "backed", described: "described", "partly backed": "partly", "not found in the body": "missing" };
const LEVEL_TAG = { backed: "backed by a result", described: "described, not shown", "partly backed": "partly backed", "not found in the body": "no result found" };
const GAP = 0.12, TAIL = 0.45, HEAD = 0.3;

// ---------- voice ----------
const KOKORO = { model: process.env.KOKORO_MODEL || path.join(os.homedir(), ".cache", "si-voices", "kokoro-v1.0.int8.onnx"), voices: process.env.KOKORO_VOICES || path.join(os.homedir(), ".cache", "si-voices", "voices-v1.0.bin"), voice: process.env.KOKORO_VOICE || "af_heart", speed: process.env.KOKORO_SPEED || "0.86" }; // slower than default: at 1.0 and 0.94 short lines ran past 220 spoken words a minute (learning L2, qa:pace)
function voice() {
  const want = process.env.RESPONSE_VOICE || "";
  if (want !== "espeak" && want !== "none" && fs.existsSync(KOKORO.model) && fs.existsSync(KOKORO.voices) && has("python3", ["-c", "import kokoro_onnx, soundfile"])) return { id: "kokoro", label: `Kokoro neural voice (${KOKORO.voice}, local)` };
  if (want !== "espeak" && want !== "none" && process.env.PIPER_MODEL && fs.existsSync(process.env.PIPER_MODEL) && has("piper", ["--help"])) return { id: "piper", label: "Piper neural voice (local)" };
  if (want !== "none" && has("espeak-ng")) return { id: "espeak-ng", label: "espeak-ng (local, robotic: install Kokoro for a natural voice)" };
  return { id: "none", label: "no voice installed: captions only" };
}
// Voice every line, reusing any sentence already voiced with the same voice (a cache keyed by voice and text), so a
// re-render costs nothing for lines that didn't change. Kokoro voices all new lines in one model load.
function speakAll(lines, dir, v) {
  fs.mkdirSync(dir, { recursive: true });
  if (v.id === "none") return { files: [], seconds: lines.map((t) => Math.max(1.2, t.split(/\s+/).length / 2.6)) };
  const cache = process.env.VOICE_CACHE || path.join(dir, "..", "..", ".voice-cache"); fs.mkdirSync(cache, { recursive: true });
  const tag = v.id === "kokoro" ? `kokoro:${KOKORO.voice}:${KOKORO.speed}` : v.id === "piper" ? `piper:${process.env.PIPER_MODEL}` : `espeak:${process.env.ESPEAK_VOICE || "en-us"}:${process.env.ESPEAK_RATE || "158"}`;
  const jobs = lines.map((t, i) => ({ text: t, cached: path.join(cache, require("node:crypto").createHash("sha1").update(`${tag}\n${t}`).digest("hex") + ".wav"), file: path.join(dir, `line-${String(i + 1).padStart(3, "0")}.wav`) }));
  const todo = jobs.filter((j) => !fs.existsSync(j.cached));
  if (todo.length) {
    if (v.id === "kokoro") execFileSync("python3", [path.join(__dirname, "tts_kokoro.py")], { input: JSON.stringify({ model: KOKORO.model, voices: KOKORO.voices, voice: KOKORO.voice, speed: Number(KOKORO.speed), jobs: todo.map((j) => ({ text: j.text, file: j.cached })) }), maxBuffer: 16 * 1024 * 1024, timeout: 3600000 });
    else if (v.id === "piper") for (const j of todo) execFileSync("piper", ["--model", process.env.PIPER_MODEL, "--output_file", j.cached], { input: j.text, timeout: 300000 });
    else for (const j of todo) execFileSync("espeak-ng", ["-v", process.env.ESPEAK_VOICE || "en-us", "-s", process.env.ESPEAK_RATE || "158", "-w", j.cached, j.text], { timeout: 300000 });
  }
  for (const j of jobs) fs.copyFileSync(j.cached, j.file);
  return { files: jobs.map((j) => j.file), seconds: jobs.map((j) => duration(j.file)), reused: jobs.length - todo.length };
}
const duration = (file) => { try { return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim()) || 0; } catch { return 0; } };

// ---------- timing: one slot per line ----------
// slot = the line's spoken length + a short gap; a beat = its slots + a tail for the fade-out.
function timeline(p, secondsPerLine) {
  let k = 0, t = 0;
  for (const b of p.beats) {
    b.slots = b.lines.map((l) => Math.round((secondsPerLine[k++] + GAP + (l.pause || 0)) * 100) / 100);
    b.start = Math.round(t * 100) / 100; b.seconds = Math.round((b.slots.reduce((s, x) => s + x, 0) + TAIL) * 100) / 100; t += b.seconds;
  }
  return t;
}
const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
// One caption cue per spoken line, on the same clock as the picture (long lines split in two, timed by length).
function captions(beats) {
  const out = []; let t = 0, n = 1;
  for (const b of beats) {
    const slots = b.slots || b.lines.map(() => Math.max(1.2, (b.seconds - TAIL) / b.lines.length));
    b.lines.forEach((l, i) => {
      const words = l.text.split(" "), parts = []; let cur = "";
      for (const w of words) { if ((cur + " " + w).trim().length > 84) { parts.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
      parts.push(cur);
      const total = parts.reduce((s, x) => s + x.length, 0) || 1; let at = t;
      for (const part of parts) { const d = (slots[i] - GAP - (l.pause || 0)) * (part.length / total); out.push(`${n++}\n${ts(at)} --> ${ts(at + d)}\n${part}\n`); at += d; }
      t += slots[i];
    });
    t += TAIL;
  }
  return out.join("\n");
}

// ---------- the Manim scene ----------
// Each visual kind builds its mobjects (hidden), then exposes cue i -> an animation. The scene plays, line by line,
// the cue of that line and holds for the rest of the line's slot.
function kindCode(v) {
  const L = [];
  const C = (s) => L.push(s);
  if (v.kind === "title") {
    C(`t = T(${py(v.title)}, 46, weight=BOLD, n=30)`);
    C(`s = T(${py(v.sub)}, 24, PAL['mute'], n=60).next_to(t, DOWN, buff=0.45)`);
    C("u = Line(LEFT * 1.6, RIGHT * 1.6, color=PAL['accent'], stroke_width=4).next_to(s, DOWN, buff=0.4)");
    C("VGroup(t, s, u).move_to(ORIGIN)");
    C("cues = [lambda: FadeIn(t, shift=UP * 0.25), lambda: AnimationGroup(FadeIn(s, shift=UP * 0.15), GrowFromCenter(u))]");
  } else if (v.kind === "claims") {
    C("head = T('What it claims', 26, PAL['mute']).to_edge(UP, buff=0.7)");
    if (v.mode === "one") {
      const it = v.items[0];
      C(`card = RoundedRectangle(corner_radius=0.25, width=11.4, height=3.4, fill_color=PAL['panel'], fill_opacity=1, stroke_color=PAL['faint'])`);
      C(`txt = T(${py(it.text)}, 32, n=42).move_to(card)`);
      C("txt.scale_to_fit_width(min(txt.width, card.width - 1.0)); txt.scale_to_fit_height(min(txt.height, card.height - 0.7)); txt.move_to(card)");
      C(`tag = VGroup(Dot(radius=0.12, color=PAL[${py(LEVEL_COLOR[it.level])}]), T(${py(LEVEL_TAG[it.level])}, 24, PAL[${py(LEVEL_COLOR[it.level])}])).arrange(RIGHT, buff=0.25).next_to(card, DOWN, buff=0.45)`);
      C("VGroup(card, txt, tag).move_to(DOWN * 0.2)");
      C("cues = [lambda: AnimationGroup(FadeIn(card), FadeIn(txt, shift=UP * 0.2), lag_ratio=0.3), lambda: FadeIn(tag, scale=1.2)]");
    } else {
      C("rows = VGroup()");
      for (const it of v.items) C(`rows.add(VGroup(Dot(radius=0.13, color=PAL[${py(LEVEL_COLOR[it.level])}]), T(${py(it.text)}, ${v.mode === "chips" ? 30 : 24}, n=${v.mode === "chips" ? 34 : 56}), T(${py(LEVEL_TAG[it.level])}, 20, PAL[${py(LEVEL_COLOR[it.level])}])).arrange(RIGHT, buff=0.35))`);
      C("rows.arrange(DOWN, aligned_edge=LEFT, buff=0.6); rows.scale_to_fit_width(min(rows.width, 12.4)); rows.move_to(DOWN * 0.3)");
      C("cues = [(lambda r=r: AnimationGroup(GrowFromCenter(r[0]), FadeIn(r[1], shift=RIGHT * 0.3), FadeIn(r[2]), lag_ratio=0.2)) for r in rows]");
    }
  } else if (v.kind === "flow") {
    C("head = T('How it works', 26, PAL['mute']).to_edge(UP, buff=0.7)");
    C("boxes = VGroup()");
    for (const s of v.steps) C(`boxes.add(VGroup(RoundedRectangle(corner_radius=0.22, width=3.5, height=1.9, fill_color=PAL['panel'], fill_opacity=1, stroke_color=PAL['faint'], stroke_width=2), T(${py(s)}, 24, n=20)))`);
    C("for b in boxes: b[1].scale_to_fit_width(min(b[1].width, b[0].width - 0.45)); b[1].move_to(b[0])");
    C("boxes.arrange(RIGHT, buff=0.8) if len(boxes) <= 3 else boxes.arrange_in_grid(rows=2, buff=(0.9, 0.8))");
    C("boxes.scale_to_fit_width(min(boxes.width, 12.6)).move_to(DOWN * 0.2)");
    C("arrows = [Arrow(boxes[i].get_right(), boxes[i + 1].get_left(), buff=0.1, color=PAL['accent'], stroke_width=5, max_tip_length_to_length_ratio=0.35) if len(boxes) <= 3 or i != 1 else Arrow(boxes[i].get_bottom(), boxes[i + 1].get_top(), buff=0.1, color=PAL['accent'], stroke_width=5) for i in range(len(boxes) - 1)]");
    C("def step_in(i):\n            parts = [FadeIn(boxes[i][0]), FadeIn(boxes[i][1], shift=UP * 0.15)]\n            if i > 0: parts.insert(0, GrowArrow(arrows[i - 1]))\n            return AnimationGroup(*parts, lag_ratio=0.25)");
    C("dot = Dot(radius=0.16, color=PAL['accent']).move_to(boxes[0].get_bottom() + DOWN * 0.35)");
    C("def loop():\n            path = VMobject().set_points_smoothly([b.get_bottom() + DOWN * 0.35 for b in boxes])\n            return Succession(FadeIn(dot), MoveAlongPath(dot, path, rate_func=smooth), *[Indicate(b[0], color=PAL['accent'], scale_factor=1.04) for b in boxes[-1:]])");
    C("cues = [(lambda i=i: step_in(i)) for i in range(len(boxes))] + [loop if len(boxes) > 1 else (lambda: Indicate(boxes[0][0], color=PAL['accent']))]");
  } else if (v.kind === "bars") {
    const max = Math.max(...v.bars.map((x) => Math.abs(x.value))) || 1, n = v.bars.length, gap = 9 / n;
    C(`head = T(${py(`From the paper: ${v.metric}`)}, 26, PAL['mute']).to_edge(UP, buff=0.7)`);
    C("base = Line(LEFT * 4.8, RIGHT * 4.8, color=PAL['faint'], stroke_width=3).shift(DOWN * 2.1)");
    C("bars, nums, labs, ks = [], [], [], []");
    v.bars.forEach((x, i) => {
      const h = Math.max(0.03, (Math.abs(x.value) / max) * 3.6), cx = (-4.5 + gap * (i + 0.5)).toFixed(2);
      C(`r = Rectangle(width=${(gap * 0.56).toFixed(2)}, height=0.001, fill_color=PAL['described'], fill_opacity=0.9, stroke_width=0).move_to([${cx}, -2.1, 0], aligned_edge=DOWN); bars.append((r, ${h.toFixed(3)}))`);
      C(`k = ValueTracker(0); ks.append((k, ${x.value})); nums.append(always_redraw(lambda r=r, k=k: T(f"{k.get_value():.${Number.isInteger(x.value) ? 0 : 1}f}${v.unit}", 28).next_to(r, UP, buff=0.15)))`);
      C(`labs.append(T(${py(x.label)}, 22, PAL['mute'], n=14).next_to([${cx}, -2.1, 0], DOWN, buff=0.25))`);
    });
    C(`note = T(${py(`Table ${v.table} of the paper · its numbers, not rerun by us`)}, 20, PAL['mute']).to_edge(DOWN, buff=0.45)`);
    C("self.add(base, *[b[0] for b in bars], *nums, *labs)");
    C("cues = [lambda: AnimationGroup(*[AnimationGroup(r.animate.stretch_to_fit_height(h, about_edge=DOWN), k.animate.set_value(val)) for (r, h), (k, val) in zip(bars, ks)], lag_ratio=0.35), lambda: FadeIn(note, shift=UP * 0.1)]");
  } else if (v.kind === "quote") {
    C(`q = T(${py(`“${v.text}”`)}, 32, n=44).move_to(UP * 0.2)`);
    C("bar = Line(UP, DOWN, color=PAL['described'], stroke_width=6).scale_to_fit_height(q.height + 0.2).next_to(q, LEFT, buff=0.45)");
    C(`src = T(${py(`the paper · ${v.section}`)}, 22, PAL['mute']).next_to(q, DOWN, buff=0.5).align_to(q, LEFT)`);
    C("cues = [lambda: AnimationGroup(Create(bar), FadeIn(q, shift=RIGHT * 0.2), lag_ratio=0.2), lambda: FadeIn(src)]");
  } else if (v.kind === "checklist") {
    C("head = T('How careful is it?', 26, PAL['mute']).to_edge(UP, buff=0.7)");
    C("met, miss = VGroup(), VGroup()");
    for (const it of v.items) C(`(${it.met ? "met" : "miss"}).add(VGroup(T(${py(it.met ? "✓" : "✗")}, 28, PAL[${py(it.met ? "backed" : "bad")}]), T(${py(it.label)}, 24, PAL[${py(it.met ? "ink" : "mute")}], n=48)).arrange(RIGHT, buff=0.3))`);
    C("rows = VGroup(*met, *miss).arrange(DOWN, aligned_edge=LEFT, buff=0.28) if len(met) + len(miss) else VGroup()");
    C("if len(rows): rows.scale_to_fit_height(min(rows.height, 5.0)); rows.move_to(LEFT * 1.8 + DOWN * 0.3)");
    C(`ring = Circle(radius=1.35, color=PAL['faint'], stroke_width=14).move_to((RIGHT * 4.3 if len(rows) else ORIGIN) + DOWN * 0.3)`);
    // Redrawn mobjects can't be faded (their points change every frame), so their opacity follows a tracker instead.
    C("k = ValueTracker(0); vis = ValueTracker(0); score = always_redraw(lambda: T(f'{k.get_value():.0f}', 54, weight=BOLD).move_to(ring.get_center()).set_opacity(vis.get_value()))");
    C("arc = always_redraw(lambda: Arc(radius=1.35, start_angle=PI / 2, angle=-TAU * max(k.get_value(), 0.2) / 100, color=PAL['accent'], stroke_width=14).move_arc_center_to(ring.get_center()).set_stroke(opacity=vis.get_value()).set_z_index(2))");
    C("self.add(arc, score)");
    C("of = T('out of 100', 20, PAL['mute']).next_to(ring, DOWN, buff=0.3)");
    C(`gauge = lambda: AnimationGroup(Create(ring), FadeIn(of), vis.animate.set_value(1), k.animate.set_value(${v.score}), lag_ratio=0.1)`);
    C("cues = [lambda: LaggedStart(*[FadeIn(r, shift=RIGHT * 0.2) for r in met], lag_ratio=0.25) if len(met) else Wait(0.1), lambda: LaggedStart(*[FadeIn(r, shift=RIGHT * 0.2) for r in miss], lag_ratio=0.25) if len(miss) else Wait(0.1), gauge]");
  } else if (v.kind === "curve") {
    const pts = v.series.map((s) => s.points.map(([x, y]) => [Number(x), Number(y)]));
    const xs = pts.flat().map((q) => q[0]), ys = pts.flat().map((q) => q[1]);
    // Pad a flat x or y range (one point, or all points at one x) so Axes never divides by zero (review fix).
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(0, ...ys);
    if (x1 - x0 < 1e-9) { x0 -= 1; x1 += 1; } if (y1 - y0 < 1e-9) y1 = y0 + 1;
    C(`head = T(${py(`Our toy check: ${v.title}`)}, 24, PAL['mute'], n=60).to_edge(UP, buff=0.6)`);
    const yTop = y1 + 0.12 * (y1 - y0);
    C(`ax = Axes(x_range=[${x0}, ${x1}, ${Math.max((x1 - x0) / 5, 1e-6).toFixed(4)}], y_range=[${y0.toFixed(3)}, ${yTop.toFixed(3)}, ${((yTop - y0) / 4).toFixed(4)}], x_length=9.6, y_length=4.4, axis_config={'color': PAL['faint'], 'include_numbers': False, 'stroke_width': 3}).move_to(DOWN * 0.35)`);
    C("curves, dots, keys = [], [], []");
    // A series of one point becomes a short flat stroke: a path needs at least two points (review fix, learning L15).
    pts.forEach((pt, i) => { if (pt.length < 2) pts[i] = [pt[0], [pt[0][0] + (x1 - x0) * 0.02, pt[0][1]]]; });
    pts.forEach((s, i) => {
      C(`c = VMobject(color=PAL[${py(i ? "partly" : "accent")}], stroke_width=5).set_points_as_corners([ax.c2p(x, y) for x, y in ${JSON.stringify(s)}]); curves.append(c)`);
      C(`dots.append(Dot(ax.c2p(*${JSON.stringify(s[0])}), radius=0.09, color=PAL[${py(i ? "partly" : "accent")}]))`);
      C(`keys.append(VGroup(Line(ORIGIN, RIGHT * 0.5, color=PAL[${py(i ? "partly" : "accent")}], stroke_width=5), T(${py(v.series[i].name)}, 18, PAL['mute'], n=50)).arrange(RIGHT, buff=0.2))`);
    });
    C("legend = VGroup(*keys).arrange(DOWN, aligned_edge=LEFT, buff=0.15).next_to(ax, DOWN, buff=0.25)");
    C(`verdict = T(${py(v.verdict || "toy scale")}, 26, PAL['accent']).next_to(ax, UP, buff=0.05).align_to(ax, RIGHT)`);
    C("cues = [lambda: Succession(Create(ax), AnimationGroup(*[AnimationGroup(Create(c), MoveAlongPath(d, c), rate_func=linear) for c, d in zip(curves, dots)], lag_ratio=0.5), FadeIn(legend)), lambda: FadeIn(verdict, scale=1.15)]");
  } else if (v.kind === "questions") {
    C("head = T('Still open', 26, PAL['mute']).to_edge(UP, buff=0.7)");
    C(`qs = VGroup(*[VGroup(T('?', 38, PAL['partly'], weight=BOLD), T(q, 28, n=46)).arrange(RIGHT, buff=0.35) for q in ${JSON.stringify(v.items)}]).arrange(DOWN, aligned_edge=LEFT, buff=0.55)`);
    C("qs.scale_to_fit_width(min(qs.width, 12.4)); qs.move_to(DOWN * 0.2)");
    C("cues = [(lambda q=q: FadeIn(q, shift=UP * 0.2)) for q in qs]");
  } else {
    C("head = T('Read it yourself', 26, PAL['mute']).to_edge(UP, buff=0.9)");
    C(`srcs = VGroup(*[T(s, 24, n=64) for s in ${JSON.stringify(v.items || [])}]).arrange(DOWN, buff=0.35)`);
    C("note = T('Our reading of the text, not a peer review.', 22, PAL['mute']).next_to(srcs, DOWN, buff=0.6)");
    C("cues = [lambda: AnimationGroup(FadeIn(srcs), FadeIn(note), lag_ratio=0.3)]");
  }
  return L;
}

function scene(p) {
  const font = process.env.RESPONSE_FONT || "Inter", cls = "PaperResponse";
  const L = [`# Generated by modules/responses/video.js for "${p.title.replace(/"/g, "'")}". Render: manim -qm scene.py ${cls}`,
    "from manim import *", "", `PAL = ${JSON.stringify(PALETTE)}`, `FONT = ${py(font)}`, "",
    "def wrap(s, n=44):", "    words, lines, cur = s.split(), [], ''", "    for w in words:", "        if len(cur) + len(w) + 1 > n: lines.append(cur); cur = w", "        else: cur = (cur + ' ' + w).strip()", "    lines.append(cur)", "    return '\\n'.join(lines)", "",
    "def T(s, size=26, color=None, n=44, weight=NORMAL):", "    return Text(wrap(s, n), font=FONT, font_size=size, color=color or PAL['ink'], line_spacing=0.85, weight=weight)", "",
    `class ${cls}(Scene):`,
    "    # Play line i's cue as its sentence starts, then hold until the sentence ends. Holds are measured against one",
    "    # clock (the narration's), so frame rounding never accumulates into drift between picture and voice.",
    "    clock = 0.0",
    "    def say(self, anim, slot):", "        self.clock += slot", "        left = self.clock - self.renderer.time",
    "        if anim is not None: self.play(anim, run_time=max(0.25, min(1.1, left * 0.6)))",
    "        left = self.clock - self.renderer.time", "        if left > 0.02: self.wait(left)", "",
    "    def end_beat(self, tail):", "        self.clock += tail", "        for m in self.mobjects: m.clear_updaters()",
    "        self.play(*[FadeOut(m) for m in self.mobjects], run_time=max(0.2, min(tail, self.clock - self.renderer.time)))",
    "        left = self.clock - self.renderer.time", "        if left > 0.02: self.wait(left)", "",
    "    def construct(self):", `        self.camera.background_color = PAL['bg']`];
  for (const b of p.beats) {
    const slots = b.slots || b.lines.map(() => Math.max(1.2, (b.seconds - TAIL) / b.lines.length));
    L.push(`        # --- ${b.id} (${b.variant}): ${String(b.goal || "").replace(/\n/g, " ")}`);
    L.push("        head = None");
    for (const line of kindCode(b.visual)) L.push("        " + line);
    // The heading fades in at the start of the beat, inside the first line's slot.
    L.push(`        if head is not None: self.play(FadeIn(head), run_time=${HEAD})`);
    b.lines.forEach((l, i) => L.push(`        self.say(${l.cue === null ? "None" : `cues[${l.cue}]()`}, ${slots[i]})`));
    L.push(`        self.end_beat(${TAIL})`);
  }
  return { file: "scene.py", className: cls, source: L.join("\n") + "\n" };
}

// The same beats for the browser explainer player (/m/explainer?r=<slug>): title, say, bars, graph.
function playerStoryboard(p) {
  return { id: `response-${p.slug}`, title: p.title, scenes: p.beats.map((b) => {
    const v = b.visual;
    if (v.kind === "title") return { kind: "title", text: v.title, sub: v.sub, seconds: b.seconds };
    if (v.kind === "bars") return { kind: "bars", title: `From the paper: ${v.metric} (table ${v.table})`, bars: v.bars.map((x) => ({ label: x.label, value: Math.max(0, Math.min(100, x.value)), note: `${x.value}${v.unit}` })), seconds: b.seconds };
    if (v.kind === "checklist" && v.items.length) return { kind: "bars", title: `How careful is it: ${v.score}/100`, bars: v.items.map((x) => ({ label: x.label, value: x.met ? 100 : 2, note: x.met ? `+${x.points}` : "missing" })), seconds: b.seconds };
    if (v.kind === "flow") return { kind: "graph", center: "How it works", nodes: v.steps.map((s, i) => ({ name: s, label: `step ${i + 1}` })), seconds: b.seconds };
    return { kind: "say", kicker: { claims: "What it claims", quote: "The paper reports", curve: "Our toy check", questions: "Still open", sources: "Read it yourself", checklist: "How careful is it" }[v.kind] || "", text: b.narration, small: b.narration.length > 220, seconds: b.seconds };
  }) };
}

// Build everything into outDir. Rendering is skipped (with the command to run) when Manim or ffmpeg isn't installed.
function build(p, outDir, { render = true, quality = process.env.RESPONSE_QUALITY || "m", log = () => {} } = {}) {
  const dir = path.resolve(outDir), adir = path.join(dir, "audio"); fs.rmSync(adir, { recursive: true, force: true }); fs.mkdirSync(adir, { recursive: true });
  const v = voice(), notes = [`Voice: ${v.label}.`];
  const lines = p.beats.flatMap((b) => b.lines.map((l) => l.text));
  log(`voicing ${lines.length} sentences (${v.id})…`);
  const spoken = speakAll(lines, adir, v);
  if (spoken.reused) notes.push(`Reused ${spoken.reused} of ${lines.length} voiced sentences from the cache.`);
  const total = timeline(p, spoken.seconds);
  const sc = scene(p);
  fs.writeFileSync(path.join(dir, sc.file), sc.source);
  fs.writeFileSync(path.join(dir, "captions.srt"), captions(p.beats));
  fs.writeFileSync(path.join(dir, "narration.txt"), p.beats.map((b) => `[${b.id} · ${b.variant} · ${b.seconds}s]\n${b.lines.map((l, i) => `  ${b.slots[i]}s  ${l.cue === null ? "      " : `cue ${l.cue} `} ${l.text}`).join("\n")}`).join("\n\n") + "\n");
  fs.writeFileSync(path.join(dir, "storyboard.json"), JSON.stringify(playerStoryboard(p), null, 2));
  const files = ["scene.py", "captions.srt", "narration.txt", "storyboard.json"];
  if (!render) { notes.push(`Not rendered (--no-render). Render: manim -q${quality} scene.py ${sc.className}`); return { files, notes, seconds: Math.round(total * 10) / 10, voice: v.id }; }
  if (!has("manim")) { notes.push(`Manim isn't installed (pip install manim). Render later: cd ${dir} && manim -q${quality} scene.py ${sc.className}`); return { files, notes, seconds: total, voice: v.id }; }
  log(`rendering ${total.toFixed(0)} s with Manim (-q${quality})…`);
  try { execFileSync("manim", [`-q${quality}`, "--disable_caching", "--media_dir", path.join(dir, "media"), "-o", "picture", path.join(dir, sc.file), sc.className], { cwd: dir, stdio: ["ignore", "ignore", "pipe"], timeout: 3600000 }); }
  catch (e) { throw new Error(`Manim couldn't render the scene: ${String(e.stderr || e.message).trim().split("\n").filter(Boolean).slice(-2).join(" ")}`); }
  const pic = findFile(path.join(dir, "media"), "picture.mp4"); if (!pic) throw new Error("Manim finished but no video was written.");
  if (!has("ffmpeg", ["-version"])) { fs.copyFileSync(pic, path.join(dir, "video.mp4")); notes.push("ffmpeg isn't installed: video.mp4 has no voice or subtitle track."); return { files: [...files, "video.mp4"], notes, seconds: total, voice: v.id }; }
  const args = ["-y", "-loglevel", "error", "-i", pic];
  if (spoken.files.length) {
    // One track: each sentence padded to its slot, each beat followed by its tail of silence, in order.
    const padded = []; let k = 0;
    p.beats.forEach((b) => b.slots.forEach((slot, i) => { const out = path.join(adir, `pad-${String(k).padStart(3, "0")}.wav`); const dur = slot + (i === b.slots.length - 1 ? TAIL : 0); execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", spoken.files[k], "-af", `apad=whole_dur=${dur}`, "-t", String(dur), "-ar", "24000", "-ac", "1", out]); padded.push(out); k++; }));
    fs.writeFileSync(path.join(adir, "list.txt"), padded.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(adir, "list.txt"), "-c:a", "pcm_s16le", path.join(dir, "narration.wav")]);
    args.push("-i", path.join(dir, "narration.wav"));
  }
  args.push("-i", path.join(dir, "captions.srt"), "-map", "0:v", ...(spoken.files.length ? ["-map", "1:a", "-c:a", "aac", "-b:a", "128k"] : []), "-map", `${spoken.files.length ? 2 : 1}:s`, "-c:v", "copy", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-movflags", "+faststart", path.join(dir, "video.mp4")); // no -shortest: the subtitle track ends early and would cut the last beat (learning L9)
  execFileSync("ffmpeg", args, { timeout: 600000 });
  const got = duration(path.join(dir, "video.mp4")), picLen = duration(pic);
  notes.push(`Rendered video.mp4 (${got.toFixed(1)} s; picture ${picLen.toFixed(1)} s vs voice clock ${total.toFixed(1)} s) with ${spoken.files.length ? "narration and " : ""}a subtitle track.`);
  return { files: [...files, ...(spoken.files.length ? ["narration.wav"] : []), "video.mp4"], notes, seconds: Math.round(total * 10) / 10, voice: v.id, drift: Math.round((picLen - total) * 100) / 100 };
}
function findFile(dir, name) { if (!fs.existsSync(dir)) return null; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { const f = findFile(p, name); if (f) return f; } else if (e.name === name) return p; } return null; }

module.exports = { scene, captions, timeline, playerStoryboard, build, voice, PALETTE, GAP, TAIL };
