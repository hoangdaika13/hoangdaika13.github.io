const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadToolbox() {
  const events = [];
  const context = {
    window: {
      dispatchEvent(event) { events.push(event.type); }
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    URL,
    console
  };
  vm.runInNewContext(read("youtube-toolbox.js"), context);
  return { toolbox: context.window.HHYouTubeToolbox, events };
}

test("YouTube Utility Lab is a standalone lazy route", () => {
  const shell = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(shell, /route:\s*"\/youtube-tools"/);
  assert.match(shell, /HHYouTubeToolbox\?\.mount/);
  assert.match(shell, /YouTube Utility Lab/);
  assert.match(loader, /"youtube-tools":\s*\{/);
  assert.match(loader, /youtube-toolbox\.css\?v=2/);
  assert.match(loader, /youtube-toolbox\.js\?v=2/);
  assert.match(worker, /youtube-toolbox\.css\?v=2/);
  assert.match(worker, /youtube-toolbox\.js\?v=2/);
});

test("toolbox remains independent from channel management and OAuth", () => {
  const source = read("youtube-toolbox.js");
  assert.doesNotMatch(source, /HHYouTubeCreatorGalaxy|HHYouTubePublisher/);
  assert.doesNotMatch(source, /oauth|accessToken|refreshToken|channelId|videos\.insert/i);
  assert.match(source, /hh\.youtube-toolbox\.v1/);
  assert.match(source, /Không kết nối tài khoản/);
});

test("metadata inspector reports limits, duplicates and transparent advice", () => {
  const { toolbox, events } = loadToolbox();
  const result = toolbox.analyzeMetadata({
    title: "Học piano thư giãn trong 30 phút",
    description: "Một bài hướng dẫn piano thư giãn dành cho người mới bắt đầu. Nội dung được trình bày rõ ràng và dễ thực hành.",
    tags: "piano, thư giãn, Piano",
    keyword: "piano"
  });
  assert.equal(result.titleLength, 32);
  assert.equal(result.parsedTags.normalized, "piano, thư giãn");
  assert.deepEqual([...result.parsedTags.duplicates], ["Piano"]);
  assert.equal(result.blocking, 1);
  assert.ok(events.includes("hh:youtube-toolbox-ready"));
});

test("chapter builder validates ordering and normalizes timestamps", () => {
  const { toolbox } = loadToolbox();
  const valid = toolbox.parseChapters("00:00 Mở đầu\n00:30 Nội dung\n01:45 Tổng kết");
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.output, "00:00 Mở đầu\n00:30 Nội dung\n01:45 Tổng kết");
  const invalid = toolbox.parseChapters("00:30 Mở đầu\n00:20 Đi ngược\nabc");
  assert.ok(invalid.errors.length >= 3);
});

test("title comparison keeps variants local and selects readable candidates", () => {
  const { toolbox } = loadToolbox();
  const variants = toolbox.analyzeTitleVariants("Piano thư giãn cho buổi tối\nPiano thư giãn cho buổi tối\nMột tiêu đề dài hơn để kiểm tra khả năng đọc trên màn hình điện thoại", "piano");
  assert.equal(variants.length, 3);
  assert.equal(variants[1].duplicate, true);
  assert.equal(variants[0].keywordMatch, true);
  assert.equal(variants[0].valid, true);
  assert.equal(variants[2].readable, true);
});

test("caption lab parses SRT, detects overlap and exports SRT/VTT", () => {
  const { toolbox } = loadToolbox();
  const input = "1\n00:00:00,000 --> 00:00:02,000\nXin chào\n\n2\n00:00:02,500 --> 00:00:04,000\nBắt đầu thôi";
  const parsed = toolbox.parseCaptions(input, 1.5);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.cues[0].start, 1.5);
  assert.match(parsed.srt, /00:00:01,500 --> 00:00:03,500/);
  assert.match(parsed.vtt, /^WEBVTT/);
  const overlap = toolbox.parseCaptions("1\n00:00:00,000 --> 00:00:03,000\nA\n\n2\n00:00:02,000 --> 00:00:04,000\nB");
  assert.ok(overlap.errors.some((error) => /chồng/.test(error)));
});

test("link builder extracts supported YouTube URL forms", () => {
  const { toolbox } = loadToolbox();
  assert.equal(toolbox.parseYouTubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(toolbox.parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=30"), "dQw4w9WgXcQ");
  assert.equal(toolbox.parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(toolbox.parseYouTubeId("https://example.com/video"), "");
});

test("toolbox layout is responsive, accessible and reduced-motion safe", () => {
  const css = read("youtube-toolbox.css");
  const source = read("youtube-toolbox.js");
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /ArrowLeft/);
});
