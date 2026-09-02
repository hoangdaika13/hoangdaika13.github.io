const assert = require("node:assert/strict");
const test = require("node:test");
const media = require("../galaxy-layer-one-media.js");

function localFile(name, type, size) {
  return { name, type, size };
}

test("UMD API is frozen and classifies only bounded local media files", () => {
  assert.equal(global.HHGalaxyLayerOneMedia, media);
  assert.ok(Object.isFrozen(media));
  assert.ok(Object.isFrozen(media.LIMITS));
  assert.equal(media.validateMediaFile(localFile("voice.mp3", "audio/mpeg", 1024)).kind, "audio");
  assert.equal(media.validateMediaFile(localFile("clip.mp4", "video/mp4", 2048)).kind, "video");
  assert.equal(media.validateMediaFile(localFile("clip.webm", "video/webm", 2048)).kind, "video");
  assert.equal(media.validateMediaFile(localFile("voice.webm", "audio/webm", 2048)).kind, "audio");
  assert.equal(media.validateMediaFile(localFile("captions.vtt", "text/vtt", 200)).kind, "subtitle");
  assert.equal(media.validateMediaFile(localFile("voice.flac", "", 1024)).kind, "audio", "blank browser MIME may fall back to an allowlisted extension");
  assert.throws(() => media.validateMediaFile(localFile("clip.mp4", "audio/mpeg", 100)), { code: "FILE_MIME_MISMATCH" });
  assert.throws(() => media.validateMediaFile(localFile("script.html", "text/html", 100)), { code: "FILE_TYPE_UNSUPPORTED" });
  assert.throws(() => media.validateMediaFile(localFile("huge.srt", "text/plain", media.LIMITS.subtitleBytes + 1)), { code: "FILE_TOO_LARGE" });
  assert.throws(() => media.validateMediaFile(localFile("empty.wav", "audio/wav", 0)), { code: "FILE_SIZE_INVALID" });
});

test("timestamps format and parse SRT/VTT clock values deterministically", () => {
  assert.equal(media.parseTimestamp("01:02:03,004"), 3723004);
  assert.equal(media.parseTimestamp("02:03.004"), 123004);
  assert.equal(media.parseTimestamp("00:99:00.000"), null);
  assert.equal(media.formatTimestamp(3723004), "01:02:03.004");
  assert.equal(media.formatTimestamp(123004, { srt: true, alwaysHours: false }), "02:03,004");
  assert.throws(() => media.formatTimestamp(-1), { code: "TIMESTAMP_INVALID" });
});

test("subtitle parser returns bounded, chronological, non-executable cue text", () => {
  const srt = `2\n00:00:05,000 --> 00:00:07,000\nSecond <b>literal</b>\n\n1\n00:00:01,000 --> 00:00:03,250\n<img src=x onerror=alert(1)>`;
  const parsed = media.parseSubtitles(srt);
  assert.equal(parsed.format, "srt");
  assert.equal(parsed.cues.length, 2);
  assert.equal(parsed.cues[0].startMs, 1000);
  assert.equal(parsed.cues[0].text, "<img src=x onerror=alert(1)>", "parser returns text and never converts it to markup");
  assert.ok(Object.isFrozen(parsed.cues));

  const vtt = media.parseSubtitles("WEBVTT\n\nintro\n00:00.000 --> 00:02.000 align:start\nHello\nworld");
  assert.equal(vtt.format, "vtt");
  assert.equal(vtt.cues[0].id, "intro");
  assert.equal(vtt.cues[0].text, "Hello\nworld");
  assert.throws(() => media.parseSubtitles("1\n00:00:05,000 --> 00:00:04,000\nBad"), { code: "SUBTITLE_TIMING_INVALID" });
  assert.throws(() => media.parseSubtitles("1\n00:00:00,000 --> 00:00:01,000\nA\n\n2\n00:00:02,000 --> 00:00:03,000\nB", { maxCues: 1 }), { code: "SUBTITLE_TOO_MANY_CUES" });
});

test("timestamp notes are bounded, sorted and mutate only through the manager", () => {
  let id = 0;
  const notes = media.createTimestampNotes([], { maxNotes: 2, idFactory: () => `n-${++id}` });
  const later = notes.add(5000, "Later");
  const earlier = notes.add(1000, "Earlier");
  assert.deepEqual(notes.list().map((note) => note.id), [earlier.id, later.id]);
  assert.throws(() => notes.add(9000, "Over limit"), { code: "NOTES_LIMIT_REACHED" });
  assert.equal(notes.update(later.id, { atMs: 500, text: "First" }).text, "First");
  assert.equal(notes.list()[0].id, later.id);
  assert.equal(notes.remove("missing"), false);
  assert.equal(notes.remove(earlier.id), true);
  assert.deepEqual(notes.toJSON(), [{ id: later.id, atMs: 500, text: "First" }]);
  notes.clear();
  assert.equal(notes.list().length, 0);
});

test("waveform downsampling emits a clamped peak envelope", () => {
  const samples = new Float32Array([0, -0.5, 0.25, 2, Number.NaN, -0.75, 0.1, 0.2]);
  const peaks = media.downsampleWaveform(samples, 4);
  assert.ok(peaks instanceof Float32Array);
  assert.deepEqual(Array.from(peaks), [0.5, 1, 0.75, 0.20000000298023224]);
  assert.throws(() => media.downsampleWaveform([0, 1], 2), { code: "WAVEFORM_INPUT_INVALID" });
  assert.throws(() => media.downsampleWaveform(samples, media.LIMITS.waveformPoints + 1), { code: "WAVEFORM_POINTS_INVALID" });
});

test("trim metadata remains inside verified media duration", () => {
  assert.deepEqual(media.createTrimRange(1000, 4500, 10000), { startMs: 1000, endMs: 4500, durationMs: 10000, lengthMs: 3500 });
  assert.throws(() => media.createTrimRange(5000, 4000, 10000), { code: "TRIM_RANGE_INVALID" });
  assert.throws(() => media.createTrimRange(0, 11000, 10000), { code: "TRIM_RANGE_INVALID" });
});

test("Object URL leases accept only blob URLs and revoke exactly once", () => {
  const calls = [];
  const urlApi = {
    createObjectURL(file) { calls.push(["create", file.name]); return "blob:hh-local-media"; },
    revokeObjectURL(url) { calls.push(["revoke", url]); }
  };
  const lease = media.createObjectUrlLease(localFile("clip.mp4", "video/mp4", 100), { urlApi });
  assert.equal(lease.url, "blob:hh-local-media");
  assert.equal(lease.isReleased(), false);
  assert.equal(lease.release(), true);
  assert.equal(lease.release(), false);
  assert.equal(lease.isReleased(), true);
  assert.deepEqual(calls, [["create", "clip.mp4"], ["revoke", "blob:hh-local-media"]]);

  assert.throws(() => media.createObjectUrlLease(localFile("clip.mp4", "video/mp4", 100), {
    urlApi: { createObjectURL() { return "https://example.com/video.mp4"; }, revokeObjectURL() {} }
  }), { code: "OBJECT_URL_INVALID" });
});

test("thumbnail helper fails closed without DOM or for remote sources", async () => {
  await assert.rejects(media.captureThumbnail({ videoWidth: 100, videoHeight: 100 }), { code: "CANVAS_UNAVAILABLE" });
  await assert.rejects(media.captureThumbnail({ currentSrc: "https://example.com/video.mp4", videoWidth: 100, videoHeight: 100 }, {
    document: { createElement() { throw new Error("must not create canvas for remote media"); } }
  }), { code: "REMOTE_SOURCE_FORBIDDEN" });

  const blob = { size: 12, type: "image/jpeg" };
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return { drawImage() {} }; },
    toBlob(callback, type) { blob.type = type; callback(blob); }
  };
  const result = await media.captureThumbnail({ currentSrc: "blob:local", videoWidth: 1920, videoHeight: 1080, currentTime: 1.25 }, {
    document: { createElement(tag) { assert.equal(tag, "canvas"); return canvas; } },
    maxWidth: 960
  });
  assert.equal(result.width, 960);
  assert.equal(result.height, 540);
  assert.equal(result.timeMs, 1250);
  assert.equal(result.blob, blob);
});

test("source contains no autoplay, remote fetch or implicit media element", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "galaxy-layer-one-media.js"), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\.autoplay\s*=|createElement\(["'](?:audio|video|iframe)["']\)/i);
  assert.doesNotMatch(source, /https?:\/\/[A-Za-z0-9]/);
  assert.match(source, /revokeObjectURL/);
});
