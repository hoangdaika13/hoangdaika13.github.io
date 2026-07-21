const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "video-editor-resolve.js");
const cssPath = path.join(root, "video-editor-resolve.css");
const source = fs.readFileSync(sourcePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const ops = require(sourcePath);

function timelineProject() {
  return ops.normalizeProject({
    fps: 30,
    clips: [
      { id: "a", name: "A", track: "V1", start: 0, duration: 5, sourceDuration: 20 },
      { id: "b", name: "B", track: "V1", start: 5, duration: 5, sourceDuration: 20 },
      { id: "c", name: "C", track: "V1", start: 10, duration: 5, sourceDuration: 20 }
    ]
  });
}

test("exports pure Resolve operations and declares seven Vietnamese workspaces", () => {
  for (const name of [
    "createProject", "normalizeProject", "snapTime", "applyTimelineOperation", "addSubtitle", "createNestedSequence",
    "planProxy", "createWaveformEnvelope", "addKeyframe", "setMulticam", "setMotionModel", "updateColor",
    "updateAudioChannel", "enqueueExport", "createHistory", "commitHistory", "undo", "redo"
  ]) assert.equal(typeof ops[name], "function", `missing operation ${name}`);
  for (const marker of [
    '["media", "Media", "Kho media"', '["cut", "Cut", "Cắt nhanh"', '["edit", "Edit", "Biên tập"',
    '["fusion", "Fusion", "Hiệu ứng"', '["color", "Color", "Màu sắc"', '["audio", "Audio", "Âm thanh"',
    '["deliver", "Deliver", "Xuất bản"'
  ]) assert.ok(source.includes(marker), `missing workspace ${marker}`);
});

test("normalizer bounds project collections and sanitizes persisted labels", () => {
  const project = ops.normalizeProject({
    tracks: Array.from({ length: 80 }, (_, index) => ({ id: `T${index}`, name: `<Track ${index}>` })),
    clips: Array.from({ length: 900 }, (_, index) => ({ id: `c${index}`, name: `<Clip ${index}>`, track: "T0", duration: 1 })),
    subtitles: Array.from({ length: 500 }, (_, index) => ({ id: `s${index}`, text: `<b>${index}</b>` })),
    keyframes: Array.from({ length: 800 }, (_, index) => ({ id: `k${index}`, time: index })),
    exportQueue: Array.from({ length: 80 }, (_, index) => ({ id: `q${index}` }))
  });
  assert.equal(project.tracks.length, ops.LIMITS.tracks);
  assert.equal(project.clips.length, ops.LIMITS.clips);
  assert.equal(project.subtitles.length, ops.LIMITS.subtitles);
  assert.equal(project.keyframes.length, ops.LIMITS.keyframes);
  assert.equal(project.exportQueue.length, ops.LIMITS.queue);
  assert.doesNotMatch(project.tracks[0].name, /[<>]/);
  assert.doesNotMatch(project.clips[0].name, /[<>]/);
  assert.doesNotMatch(project.subtitles[0].text, /[<>]/);
});

test("blade and ripple delete are immutable and preserve timeline continuity", () => {
  const original = timelineProject();
  const bladed = ops.applyTimelineOperation(original, { type: "blade", clipId: "a", at: 2, newId: "a-right" });
  assert.equal(original.clips.length, 3);
  assert.equal(bladed.clips.length, 4);
  assert.equal(bladed.clips.find((clip) => clip.id === "a").duration, 2);
  assert.deepEqual(
    bladed.clips.filter((clip) => clip.id === "a" || clip.id === "a-right").map((clip) => [clip.start, clip.duration, clip.sourceIn]).sort((a, b) => a[0] - b[0]),
    [[0, 2, 0], [2, 3, 2]]
  );
  const rippled = ops.applyTimelineOperation(original, { type: "ripple-delete", clipId: "b" });
  assert.equal(rippled.clips.some((clip) => clip.id === "b"), false);
  assert.equal(rippled.clips.find((clip) => clip.id === "c").start, 5);
});

test("slip, slide and snapping model professional timeline behavior", () => {
  const original = timelineProject();
  const slipped = ops.applyTimelineOperation(original, { type: "slip", clipId: "b", delta: 2 });
  assert.equal(slipped.clips.find((clip) => clip.id === "b").sourceIn, 2);
  assert.equal(slipped.clips.find((clip) => clip.id === "b").start, 5);
  assert.equal(slipped.clips.find((clip) => clip.id === "b").duration, 5);
  const slid = ops.applyTimelineOperation(original, { type: "slide", clipId: "b", delta: 1 });
  assert.equal(slid.clips.find((clip) => clip.id === "a").duration, 6);
  assert.equal(slid.clips.find((clip) => clip.id === "b").start, 6);
  assert.deepEqual({ start: slid.clips.find((clip) => clip.id === "c").start, duration: slid.clips.find((clip) => clip.id === "c").duration, sourceIn: slid.clips.find((clip) => clip.id === "c").sourceIn }, { start: 11, duration: 4, sourceIn: 1 });
  assert.equal(ops.snapTime(original, 5.04), 5);
  const snapOff = ops.applyTimelineOperation(original, { type: "toggle-snap", enabled: false });
  assert.equal(ops.snapTime(snapOff, 5.04), 5.04);
});

test("subtitle, nested sequence and multicam models retain source data", () => {
  const original = timelineProject();
  const subtitled = ops.addSubtitle(original, { id: "sub-1", start: 1, duration: 2.5, text: "Xin <chào>", language: "vi" });
  assert.deepEqual(subtitled.subtitles[0], { id: "sub-1", start: 1, duration: 2.5, text: "Xin  chào", language: "vi" });
  const nested = ops.createNestedSequence(original, ["a", "b"], "Mở đầu");
  assert.equal(nested.nestedSequences.length, 1);
  assert.equal(nested.nestedSequences[0].clips.length, 2);
  assert.equal(nested.clips.some((clip) => clip.type === "nested" && clip.duration === 10), true);
  const multicam = ops.setMulticam(original, [{ id: "cam-a", name: "Máy A", clipId: "a" }, { id: "cam-b", name: "Máy B", clipId: "b" }], 2);
  assert.equal(multicam.multicam.enabled, true);
  assert.equal(multicam.multicam.activeAngle, 2);
  assert.equal(multicam.multicam.angles.length, 2);
});

test("proxy planning and waveform envelopes are local and truthful", () => {
  const plan = ops.planProxy({ id: "asset-1", size: 100000000 }, .5);
  assert.equal(plan.status, "planned");
  assert.equal(plan.estimatedBytes, 25000000);
  assert.match(plan.notice, /chưa tạo|kế hoạch/i);
  const envelope = ops.createWaveformEnvelope([0, .5, -1, 1, -.25, .25, 0, .75], 4);
  assert.equal(envelope.length, 4);
  assert.deepEqual(envelope[0], { min: 0, max: .5, rms: Math.sqrt(.125) });
  assert.equal(envelope[1].min, -1);
  assert.equal(envelope[1].max, 1);
});

test("keyframe, motion, color and audio models remain bounded and non-destructive", () => {
  const original = timelineProject();
  const keyed = ops.addKeyframe(original, { id: "kf-1", property: "scale", time: 2, value: 120, easing: "ease-out" });
  const motion = ops.setMotionModel(keyed, "speedRamp", { enabled: true, points: [{ time: 0, speed: 1 }, { time: 2, speed: 2.5 }] });
  const stabilized = ops.setMotionModel(motion, "stabilization", { enabled: true, strength: 4, status: "local-transform" });
  const colored = ops.updateColor(stabilized, { lut: "cinema", curves: [{ x: 0, y: 0 }, { x: .5, y: .7 }, { x: 1, y: 1 }], addNode: { id: "node-2", type: "glow" } });
  const mixed = ops.updateAudioChannel(colored, "A1", { gain: 2, pan: -2, eq: { low: -40, mid: 4, high: 40 }, compressor: { enabled: true, threshold: -8, ratio: 30 }, noiseReduction: { enabled: true, amount: .4 }, automation: [{ time: 1, value: .7 }] });
  assert.equal(original.keyframes.length, 0);
  assert.equal(keyed.keyframes[0].easing, "ease-out");
  assert.equal(stabilized.motion.stabilization.strength, 1);
  assert.equal(colored.color.lut, "cinema");
  assert.equal(colored.color.nodes.length, 2);
  assert.deepEqual(mixed.audio.channels[0].eq, { low: -18, mid: 4, high: 18 });
  assert.equal(mixed.audio.channels[0].gain, 1.5);
  assert.equal(mixed.audio.channels[0].pan, -1);
  assert.equal(mixed.audio.channels[0].compressor.ratio, 20);
});

test("export queue never claims rendering or completion without browser capability", () => {
  const project = timelineProject();
  const unsupported = ops.enqueueExport(project, { id: "job-1", name: "MP4 giả", mime: "video/mp4", size: "1920x1080" }, { mediaRecorder: false, canvasCapture: true });
  assert.equal(unsupported.exportQueue[0].status, "unsupported");
  assert.match(unsupported.exportQueue[0].notice, /chưa hỗ trợ/i);
  const supported = ops.enqueueExport(project, { id: "job-2", name: "WebM thật", mime: "video/webm", size: "1280x720" }, { mediaRecorder: true, canvasCapture: true, isTypeSupported: (mime) => mime === "video/webm" });
  assert.equal(supported.exportQueue[0].status, "waiting");
  assert.doesNotMatch(supported.exportQueue[0].notice, /hoàn tất|đã xong/i);
  assert.equal(project.exportQueue.length, 0);
});

test("bounded undo and redo restore normalized project snapshots", () => {
  const original = timelineProject();
  let history = ops.createHistory(original);
  const next = ops.applyTimelineOperation(original, { type: "ripple-delete", clipId: "b" });
  history = ops.commitHistory(history, next);
  assert.equal(history.present.clips.length, 2);
  history = ops.undo(history);
  assert.equal(history.present.clips.length, 3);
  history = ops.redo(history);
  assert.equal(history.present.clips.length, 2);
  for (let index = 0; index < 100; index += 1) history = ops.commitHistory(history, { ...history.present, revision: index });
  assert.equal(history.past.length, ops.LIMITS.history);
});

test("UI contract exposes professional controls, truthful notices and accessibility", () => {
  for (const marker of [
    "data-vr-edit-ribbon", "timeline-blade", "timeline-ripple", "timeline-slip-back", "timeline-slide-forward", "timeline-snap",
    "subtitle-add", "nested-create", "pro-multicam", "motion-track", "motion-stabilize", "motion-ramp", "pro-keyframes",
    "data-vr-scope=\"waveform\"", "data-vr-scope=\"histogram\"", "data-vr-lut", "curve-contrast", "audio-automation",
    "Noise Reduction", "Compressor", "Hàng đợi kết xuất", "Chưa đánh dấu hoàn tất", "MediaRecorder", "captureStream",
    "Shift+1", "Shift+7", "event.key.toLowerCase() === \"b\"", "event.key.toLowerCase() === \"n\""
  ]) assert.ok(source.includes(marker), `missing UI contract ${marker}`);
  assert.doesNotMatch(source, /AIza|sk-[A-Za-z0-9]|mongodb(?:\+srv)?:\/\//i);
});

test("CSS supports focus, internal mobile scrolling and reduced motion at 375px", () => {
  for (const marker of [
    ".vr-edit-ribbon", ".vr-proxy-plan", ".vr-curve-model", ".vr-automation-lane", ".vr-render-queue article>span.unsupported",
    ":focus-visible", "@media(max-width:560px)", ".ve-resolve{min-width:0;width:100%}", "overflow-x:auto",
    "@media(prefers-reduced-motion:reduce)", "transition:none!important"
  ]) assert.ok(css.includes(marker), `missing CSS contract ${marker}`);
  assert.doesNotMatch(css, /font-size:\s*clamp\([^;]*vw[^;]*\)/i);
});
