const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-export-center.js");
const source = fs.readFileSync(file, "utf8");
const exportsCenter = require(file);

function capability(supported, reason = "") {
  return { supported, state: supported ? "supported" : "unsupported", reason };
}

function capabilities(overrides = {}) {
  return Object.fromEntries(Object.keys(exportsCenter.FORMATS).map((id) => [id, overrides[id] || capability(true)]));
}

function fakeCanvas(options = {}) {
  const calls = [];
  const context = {
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    setTransform(...args) { calls.push(["setTransform", ...args]); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    clearRect(...args) { calls.push(["clearRect", ...args]); },
    beginPath() {}, rect() {}, clip() {}, fill() {}, ellipse() {},
    translate() {}, rotate() {}, scale() {},
    drawImage(...args) { calls.push(["drawImage", ...args]); },
    measureText(text) { return { width: String(text).length * 9 }; },
    fillText(...args) { calls.push(["fillText", ...args]); },
    set fillStyle(value) { calls.push(["fillStyle", value]); },
    set globalAlpha(value) { calls.push(["alpha", value]); },
    set font(value) { calls.push(["font", value]); },
    set textAlign(value) { calls.push(["align", value]); },
    set textBaseline(value) { calls.push(["baseline", value]); }
  };
  const canvas = {
    width: 0,
    height: 0,
    calls,
    getContext(kind) { return kind === "2d" ? context : null; },
    toDataURL(mime) {
      const actual = options.dataUrlType?.(mime) || mime;
      return `data:${actual};base64,AA==`;
    },
    toBlob(callback, mime, quality) {
      calls.push(["toBlob", mime, quality]);
      const actual = options.blobType?.(mime) || mime;
      callback(new Blob([actual], { type: actual }));
    }
  };
  return canvas;
}

test("Export Center exposes a versioned UMD/global API", () => {
  assert.equal(exportsCenter.VERSION, 1);
  assert.equal(exportsCenter.FORMAT, "hh-graphic-export-center");
  assert.equal(exportsCenter.MANIFEST_FORMAT, "hh-graphic-export-manifest");
  assert.equal(exportsCenter.STORAGE_KEY, "hh.graphic-export-center.workspace.v1");
  assert.equal(globalThis.HHGraphicExportCenter, exportsCenter);
  assert.equal(typeof exportsCenter.mount, "function");
  assert.equal(typeof exportsCenter.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicExportCenter = api/);
  assert.match(source, /module\.exports = api/);
});

test("Social presets and naming rules normalize untrusted input", () => {
  assert.deepEqual(Object.keys(exportsCenter.SOCIAL_PRESETS), [
    "instagram-post", "instagram-story", "facebook-cover", "x-post", "linkedin-post", "youtube-thumbnail"
  ]);
  const story = exportsCenter.createSocialArtboard("instagram-story", { name: '<img onerror="bad()"> Launch' });
  assert.equal(story.width, 1080);
  assert.equal(story.height, 1920);
  assert.equal(exportsCenter.escapeHtml('<>&"\''), "&lt;&gt;&amp;&quot;&#39;");
  const filename = exportsCenter.renderFileName("{project}/{artboard}-{scale}x", {
    project: "Client <script>", artboard: "Story:final", scale: 3
  }, "jpeg");
  assert.equal(filename, "Client-script-Story-final-3x.jpg");
  assert.doesNotMatch(filename, /[<>:/\\]/);
});

test("Capabilities are explicit and AVIF is enabled only for an exact Canvas encoder", () => {
  const fallbackCanvas = fakeCanvas({ dataUrlType: (mime) => mime === "image/avif" ? "image/png" : mime });
  function MediaRecorder() {}
  MediaRecorder.isTypeSupported = (type) => type.startsWith("video/webm");
  function HTMLCanvasElement() {}
  HTMLCanvasElement.prototype.captureStream = () => ({});
  const runtime = { Blob, document: { createElement: () => fallbackCanvas }, MediaRecorder, HTMLCanvasElement, URL: { createObjectURL() {} } };
  const detected = exportsCenter.detectCapabilities(runtime, fallbackCanvas);
  assert.equal(detected.png.supported, true);
  assert.equal(detected.jpeg.supported, true);
  assert.equal(detected.webp.supported, true);
  assert.equal(detected.avif.supported, false);
  assert.equal(detected.avif.state, "unsupported");
  assert.match(detected.avif.reason, /AVIF/);
  assert.equal(detected.webm.supported, true);
  assert.equal(detected["sprite-sheet"].supported, true);
  assert.equal(detected.pdf.supported, false);
  assert.match(detected.pdf.reason, /PDF/);

  const avifCanvas = fakeCanvas();
  assert.equal(exportsCenter.detectCapabilities(runtime, avifCanvas).avif.supported, true);
});

test("Canvas renderer paints at 1x/2x/3x and applies a real watermark", () => {
  const canvas = fakeCanvas();
  const artboard = exportsCenter.normalizeArtboard({
    id: "poster", name: "Poster", width: 320, height: 180, background: "#111111",
    elements: [
      { id: "box", type: "rect", x: 10, y: 10, width: 80, height: 40, fill: "#ff00aa" },
      { id: "title", type: "text", x: 12, y: 70, width: 280, height: 80, text: "Canvas output", fontSize: 24, maxLines: 2 }
    ]
  }, 0);
  const rendered = exportsCenter.renderArtboard(canvas, artboard, {
    scale: 3,
    settings: { scale: 3, watermark: { enabled: true, text: "DRAFT", position: "center", opacity: 0.4 } }
  });
  assert.equal(rendered, true);
  assert.equal(canvas.width, 960);
  assert.equal(canvas.height, 540);
  assert.ok(canvas.calls.some((entry) => entry[0] === "setTransform" && entry[1] === 3));
  assert.ok(canvas.calls.some((entry) => entry[0] === "fillText" && entry[1] === "Canvas output"));
  assert.ok(canvas.calls.some((entry) => entry[0] === "fillText" && entry[1] === "DRAFT"));
});

test("PNG, JPEG and WebP exports use canvas.toBlob and reject MIME fallback", async () => {
  const artboard = exportsCenter.createSocialArtboard("x-post");
  for (const format of ["png", "jpeg", "webp"]) {
    const canvas = fakeCanvas();
    const result = await exportsCenter.exportArtboard(artboard, { format, scale: 2, projectName: "Launch" }, {
      Blob, canvasFactory: () => canvas, capabilities: capabilities()
    });
    assert.equal(result.mimeType, exportsCenter.FORMATS[format].mime);
    assert.equal(result.width, artboard.width * 2);
    assert.ok(result.blob instanceof Blob);
    assert.ok(canvas.calls.some((entry) => entry[0] === "toBlob" && entry[1] === exportsCenter.FORMATS[format].mime));
  }

  const fallback = fakeCanvas({ blobType: () => "image/png" });
  await assert.rejects(() => exportsCenter.exportArtboard(artboard, { format: "avif" }, {
    Blob, canvasFactory: () => fallback, capabilities: capabilities()
  }), /image\/png.*image\/avif/);
});

test("SVG and project JSON exports escape markup and reject unsafe image URLs", async () => {
  const artboard = exportsCenter.normalizeArtboard({
    id: "unsafe", name: 'Poster "unsafe"', width: 300, height: 200,
    assets: [{ id: "remote", type: "image/png", src: "javascript:alert(1)", width: 100, height: 100 }],
    elements: [
      { id: "copy", type: "text", text: '<script>globalThis.pwned=1</script> & hello', x: 10, y: 10, width: 250, height: 80, fontSize: 20 },
      { id: "photo", type: "image", assetId: "remote", x: 0, y: 100, width: 100, height: 100 }
    ]
  }, 0);
  const svg = exportsCenter.serializeSvg(artboard, { watermark: { enabled: true, text: '<b onload="bad()">DRAFT</b>' } });
  assert.match(svg, /&lt;script&gt;globalThis\.pwne/);
  assert.match(svg, /d=1&lt;\/script&gt; &amp; hello/);
  assert.match(svg, /&lt;b onload=&quot;bad\(\)&quot;&gt;DRAFT&lt;\/b&gt;/);
  assert.doesNotMatch(svg, /javascript:|<script>|<b\s+onload=/);

  const result = await exportsCenter.exportArtboard(artboard, { format: "project-json", projectName: "Safe" }, {
    Blob, capabilities: capabilities()
  });
  const parsed = JSON.parse(await result.blob.text());
  assert.equal(parsed.format, exportsCenter.FORMAT);
  assert.equal(parsed.project.artboards[0].assets[0].dataUrl, "");
});

test("Preflight reports fonts, low resolution, text overflow and asset size", () => {
  const artboard = exportsCenter.normalizeArtboard({
    id: "preflight", name: "Preflight", width: 1000, height: 1000,
    assets: [
      { id: "photo", name: "small.png", type: "image/png", width: 120, height: 120, size: 3000000 },
      { id: "font", name: "Brand.woff2", type: "font/woff2", size: 1000, loaded: false, fontFamily: "Brand Font" }
    ],
    elements: [
      { id: "copy", type: "text", text: "This sentence needs many more lines than its frame can contain", x: 0, y: 0, width: 120, height: 20, fontFamily: "Brand Font", fontSize: 28, maxLines: 1 },
      { id: "hero", type: "image", assetId: "photo", x: 0, y: 100, width: 500, height: 500 }
    ]
  }, 0);
  const report = exportsCenter.runPreflight([artboard], { settings: { scale: 2 }, maxAssetBytes: 2000000, availableFonts: [] });
  const codes = new Set(report.issues.map((issue) => issue.code));
  assert.equal(report.valid, true);
  for (const code of ["font-missing", "low-resolution", "text-overflow", "asset-oversize"]) assert.ok(codes.has(code), `missing ${code}`);
});

test("Sprite sheet export composes multiple rendered artboards on one PNG canvas", async () => {
  const canvases = [];
  const result = await exportsCenter.exportSpriteSheet([
    exportsCenter.normalizeArtboard({ id: "a", width: 100, height: 50 }, 0),
    exportsCenter.normalizeArtboard({ id: "b", width: 50, height: 100 }, 1)
  ], { format: "sprite-sheet", spriteColumns: 2, spritePadding: 10, scale: 1, projectName: "Sprites" }, {
    Blob,
    capabilities: capabilities(),
    canvasFactory() { const canvas = fakeCanvas(); canvases.push(canvas); return canvas; }
  });
  assert.equal(result.width, 230);
  assert.equal(result.height, 120);
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.artboardIds.length, 2);
  assert.ok(canvases[0].calls.some((entry) => entry[0] === "drawImage"));
  assert.ok(canvases[0].calls.some((entry) => entry[0] === "toBlob"));
});

test("Batch queue snapshots artboards, cancels a running job and retries it", async () => {
  const project = exportsCenter.createDefaultProject();
  const queue = exportsCenter.createExportQueue({
    capabilities: capabilities(),
    exporter: async (job, environment) => {
      if (job.attempts === 1) {
        await new Promise((resolve, reject) => {
          environment.signal.addEventListener("abort", () => reject(Object.assign(new Error("canceled"), { name: "AbortError" })), { once: true });
        });
      }
      return { blob: new Blob(["ok"], { type: "image/png" }), filename: "done.png", format: "png", mimeType: "image/png", width: 10, height: 10 };
    }
  });
  const [created] = queue.enqueue(project.artboards[0], { format: "png", scale: 1 });
  const firstRun = queue.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(queue.snapshot()[0].status, "running");
  assert.equal(queue.cancel(created.id), true);
  await firstRun;
  assert.equal(queue.snapshot()[0].status, "canceled");
  assert.equal(queue.retry(created.id), true);
  await queue.start();
  assert.equal(queue.snapshot()[0].status, "completed");
  assert.equal(queue.snapshot()[0].attempts, 2);

  const aggregate = exportsCenter.createExportQueue({ capabilities: capabilities() });
  aggregate.enqueue(project.artboards.slice(0, 2), { format: "sprite-sheet" });
  assert.equal(aggregate.snapshot().length, 1);
  assert.equal(aggregate.snapshot()[0].artboards.length, 2);
});

test("Versioned local workspace and export manifest round-trip queue metadata", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const project = exportsCenter.createDefaultProject();
  const saved = exportsCenter.saveWorkspace({ project, selectedIds: [project.artboards[1].id], settings: { format: "webp", scale: 3 } }, storage);
  assert.equal(saved.ok, true);
  const envelope = JSON.parse(memory.get(exportsCenter.STORAGE_KEY));
  assert.equal(envelope.format, exportsCenter.FORMAT);
  assert.equal(envelope.version, exportsCenter.VERSION);
  const loaded = exportsCenter.loadWorkspace(storage);
  assert.equal(loaded.settings.format, "webp");
  assert.equal(loaded.settings.scale, 3);
  assert.deepEqual(loaded.selectedIds, [project.artboards[1].id]);
  assert.deepEqual(exportsCenter.saveWorkspace(project, null), { ok: false, reason: "unsupported" });

  const manifest = exportsCenter.createExportManifest({ project, settings: loaded.settings, capabilities: capabilities() });
  assert.equal(manifest.format, exportsCenter.MANIFEST_FORMAT);
  assert.equal(manifest.items.length, project.artboards.length);
  assert.equal(manifest.items[0].scale, 3);
  assert.equal(manifest.capabilities.pdf.state, "supported");
  assert.equal(JSON.parse(exportsCenter.exportManifest({ project, capabilities: capabilities() })).version, 1);
});

test("Workspace contract is accessible, responsive and contains no network or CDN path", () => {
  for (const marker of [
    "data-hh-graphic-export-center", "data-hec-artboard", "data-hec-action=\"enqueue\"", "data-hec-cancel",
    "data-hec-retry", "data-hec-setting=\"namingRule\"", "data-hec-watermark", "data-hec-issues",
    "canvas.toBlob", "captureStream", "MediaRecorder", "image/avif", "unsupported", "localStorage",
    "role=\"radiogroup\"", "role=\"status\"", "aria-live=\"polite\"", ":focus-visible",
    "@media(max-width:375px)", "@media(prefers-reduced-motion:reduce)", "ctrlKey", "Escape"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /https?:\/\/[^"'\s]+\.js/);
  assert.doesNotMatch(source, /secret|api[_-]?key|bearer\s+[a-z0-9]/i);
});
