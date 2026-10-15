const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('../graphic-design-export-center.js');

function documentFixture() {
  return { name: 'Ảnh mẫu', activeFrameId: 'one', frames: [
    { id: 'one', name: 'Khung đỏ', width: 320, height: 180 },
    { id: 'two', name: 'Khung xanh', width: 100, height: 240 }
  ], layers: [] };
}

function controllerFixture() {
  let document = documentFixture();
  const calls = [];
  return {
    get document() { return structuredClone(document); },
    changeDocument(next) { document = structuredClone(next); }, calls,
    getAsset() { return null; },
    async prepareExportSVG(options) {
      calls.push(options);
      const frame = document.frames.find(item => item.id === options.frameId) || document.frames[0];
      return { svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', width: Math.round(frame.width * (options.scale || 1)), height: Math.round(frame.height * (options.scale || 1)), warnings: [] };
    }
  };
}

function environment(options = {}) {
  const urls = [], revoked = [], canvases = [];
  class Image {
    set src(value) {
      this.source = value;
      if (value && !options.deferImage) queueMicrotask(() => options.imageError ? this.onerror?.() : this.onload?.());
    }
    get src() { return this.source; }
  }
  const runtime = {
    Blob, TextEncoder, Image,
    URL: { createObjectURL(blob) { const url = `blob:local-${urls.length}`; urls.push({ url, blob }); return url; }, revokeObjectURL(url) { revoked.push(url); } }
  };
  const canvasFactory = () => {
    const calls = [];
    const context = {
      clearRect(...args) { calls.push(['clearRect', ...args]); },
      fillRect(...args) { calls.push(['fillRect', this.fillStyle, ...args]); },
      drawImage(...args) { calls.push(['drawImage', ...args]); }
    };
    const canvas = { width: 0, height: 0, calls, getContext() { return context; },
      toBlob(callback, mime, quality) {
        calls.push(['encode', mime, quality, canvas.width, canvas.height]);
        const type = options.fallbackMime || mime;
        // Minimal byte fixture for unit structure checks, not a real JPEG decode.
        callback(new Blob([type === 'image/jpeg' ? new Uint8Array([255, 216, 1, 2, 255, 217]) : 'encoded'], { type }));
      }
    };
    canvases.push(canvas);
    return canvas;
  };
  return { runtime, canvasFactory, urls, revoked, canvases };
}

test('Shared export plans validate frame, scale and original document dimensions without mutation', () => {
  const controller = controllerFixture(), before = controller.document;
  const plan = api.sharedExportPlan(controller, 'png', { frameId: 'two', scale: 2 });
  assert.equal(plan.pages.length, 1);
  assert.equal(plan.pages[0].width, 200);
  assert.equal(plan.pages[0].height, 480);
  assert.deepEqual(controller.document, before);
  for (const scale of [0, 4, Infinity, 'bad']) assert.throws(() => api.sharedExportPlan(controller, 'png', { scale }), /Tỉ lệ/);
  assert.throws(() => api.sharedExportPlan(controller, 'png', { frameId: 'missing' }), /Chọn từ/);
  assert.throws(() => api.sharedExportPlan(controller, 'avif'), /chưa được hỗ trợ/);
});

test('Shared export caps per-frame size, total pixels and PDF page count before allocating Canvas', () => {
  const controller = controllerFixture();
  controller.changeDocument({ frames: [{ id: 'large', width: 10000, height: 10000 }], activeFrameId: 'large' });
  assert.throws(() => api.sharedExportPlan(controller, 'png'), /32 megapixel/);
  controller.changeDocument({ frames: Array.from({ length: 33 }, (_, id) => ({ id: String(id), width: 32, height: 32 })) });
  assert.throws(() => api.sharedExportPlan(controller, 'pdf', { allFrames: true }), /32 khung/);
  controller.changeDocument({ frames: Array.from({ length: 4 }, (_, id) => ({ id: String(id), width: 5600, height: 5600 })) });
  assert.throws(() => api.sharedExportPlan(controller, 'pdf', { allFrames: true }), /96 megapixel/);
  controller.changeDocument({ frames: [{ id: 'bad', width: NaN, height: 20 }] });
  assert.throws(() => api.sharedExportPlan(controller, 'png'), /32 megapixel/);
});

test('JPEG/PDF flatten transparent underlay to white; invalid background strings are rejected', () => {
  const controller = controllerFixture();
  assert.equal(api.sharedExportPlan(controller, 'jpeg').background, '#ffffff');
  assert.equal(api.sharedExportPlan(controller, 'pdf').background, '#ffffff');
  assert.equal(api.sharedExportPlan(controller, 'png').background, 'transparent');
  assert.equal(api.sharedExportPlan(controller, 'png', { background: '#aabbcc' }).background, '#aabbcc');
  for (const background of ['url(secret)', '#12345', 'var(--anything)', 'javascript:bad']) assert.throws(() => api.sharedExportPlan(controller, 'png', { background }), /Màu nền/);
});

test('Shared PNG/JPEG/WebP perform real encode adapter calls at chosen scale and exact MIME', async () => {
  for (const kind of ['png', 'jpeg', 'webp']) {
    const env = environment(), controller = controllerFixture();
    const result = await api.exportSharedDocument(controller, kind, { ...env, frameId: 'two', scale: 2, quality: .75 });
    assert.equal(result.mimeType, api.FORMATS[kind].mime);
    assert.equal(result.blob.type, result.mimeType);
    assert.equal(result.width, 200);
    assert.equal(result.height, 480);
    assert.ok(env.canvases[0].calls.some(call => call[0] === 'encode' && call[1] === result.mimeType && call[2] === .75 && call[3] === 200 && call[4] === 480));
    assert.equal(controller.calls[0].frameId, 'two');
    assert.equal(env.canvases[0].width, 0);
    assert.equal(env.canvases[0].height, 0);
    assert.deepEqual(env.revoked, env.urls.map(item => item.url));
    assert.ok(env.canvases[0].calls.some(call => call[0] === 'drawImage'));
    if (kind === 'jpeg') assert.ok(env.canvases[0].calls.some(call => call[0] === 'fillRect' && call[1] === '#ffffff'));
  }
});

test('Shared raster rejects wrong MIME fallback and clears temporary image/canvas resources', async () => {
  const env = environment({ fallbackMime: 'image/png' });
  await assert.rejects(api.exportSharedDocument(controllerFixture(), 'webp', env), /image\/png.*image\/webp/);
  assert.equal(env.canvases[0].width, 0);
  assert.deepEqual(env.revoked, env.urls.map(item => item.url));
});

test('Shared export never substitutes a different frame or skips source preflight failure', async () => {
  const controller = controllerFixture(), env = environment();
  controller.prepareExportSVG = async () => ({ svg: '<svg/>', width: 1, height: 1 });
  await assert.rejects(api.exportSharedDocument(controller, 'png', env), /sai khung hoặc kích thước/);
  assert.equal(env.canvases.length, 0);
  controller.prepareExportSVG = async () => { throw new Error('Preflight: thiếu ảnh gốc'); };
  await assert.rejects(api.exportSharedDocument(controller, 'png', env), /thiếu ảnh gốc/);
  assert.equal(env.canvases.length, 0);
});

test('Shared export rejects wrong frame identity even when frame dimensions match', async () => {
  const controller = controllerFixture(), env = environment();
  controller.prepareExportSVG = async () => ({ svg: '<svg/>', frameId: 'wrong', width: 320, height: 180 });
  await assert.rejects(api.exportSharedDocument(controller, 'png', env), /sai khung/);
  assert.equal(env.canvases.length, 0);
});

test('Shared SVG decode failure rejects and releases its Blob URL and canvas', async () => {
  const env = environment({ imageError: true });
  await assert.rejects(api.exportSharedDocument(controllerFixture(), 'png', env), /Không giải mã/);
  assert.equal(env.canvases[0].width, 0);
  assert.deepEqual(env.revoked, env.urls.map(item => item.url));
});

test('Cancel during SVG decode promptly rejects and revokes URL without an encoded file', async () => {
  const env = environment({ deferImage: true }), abort = new AbortController();
  const exporting = api.exportSharedDocument(controllerFixture(), 'png', { ...env, signal: abort.signal });
  await new Promise(resolve => setImmediate(resolve));
  abort.abort();
  await assert.rejects(exporting, { name: 'AbortError' });
  assert.deepEqual(env.revoked, env.urls.map(item => item.url));
  assert.equal(env.canvases[0].width, 0);
  assert.equal(env.canvases[0].calls.some(call => call[0] === 'encode'), false);
});

test('Cancel while original asset preparation is pending prevents canvas allocation and output', async () => {
  const env = environment(), abort = new AbortController(), controller = controllerFixture();
  let finish;
  controller.prepareExportSVG = () => new Promise(resolve => { finish = resolve; });
  const exporting = api.exportSharedDocument(controller, 'png', { ...env, signal: abort.signal });
  abort.abort(); finish({ svg: '<svg/>', width: 320, height: 180 });
  await assert.rejects(exporting, { name: 'AbortError' });
  assert.equal(env.canvases.length, 0);
});

test('Cancel during asynchronous Canvas encoding releases canvas immediately and ignores late callback', async () => {
  const env = environment(), abort = new AbortController();
  let lateCallback;
  const factory = env.canvasFactory;
  env.canvasFactory = () => { const canvas = factory(); canvas.toBlob = callback => { lateCallback = callback; }; return canvas; };
  const exporting = api.exportSharedDocument(controllerFixture(), 'png', { ...env, signal: abort.signal });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof lateCallback, 'function');
  abort.abort();
  await assert.rejects(exporting, { name: 'AbortError' });
  assert.equal(env.canvases[0].width, 0);
  lateCallback(new Blob(['late'], { type: 'image/png' }));
  assert.equal(env.canvases[0].height, 0);
});

test('Multipage PDF reads one immutable document snapshot with original-asset controller access', async () => {
  const controller = controllerFixture(), env = environment(), seen = [], progress = [];
  env.runtime.HHGraphicDesignUniversal = { async prepareExportSVG(snapshot, options) {
    seen.push({ snapshot, options });
    const frame = snapshot.frames.find(item => item.id === options.frameId);
    if (seen.length === 1) controller.changeDocument({ name: 'New document', activeFrameId: 'new', frames: [{ id: 'new', width: 1, height: 1 }] });
    return { svg: '<svg/>', width: frame.width, height: frame.height };
  } };
  const result = await api.exportSharedDocument(controller, 'pdf', { ...env, allFrames: true, onProgress: item => progress.push(item) });
  assert.equal(result.blob.type, 'application/pdf');
  assert.equal(result.raster, true);
  assert.equal(result.pageCount, 2);
  assert.equal(seen[0].snapshot, seen[1].snapshot);
  assert.deepEqual(seen.map(item => item.options.frameId), ['one', 'two']);
  assert.equal(seen[1].options.readAsset('asset-id'), null);
  assert.deepEqual(progress, [{ completed: 1, total: 2 }, { completed: 2, total: 2 }]);
  assert.equal(env.canvases.every(canvas => canvas.width === 0 && canvas.height === 0), true);
});

test('Raster PDF serializes binary streams, page dimensions, object offsets and xref correctly', async () => {
  const bytes = new Uint8Array([255, 216, 0, 128, 226, 227, 255, 217]);
  const jpeg = new Blob([bytes], { type: 'image/jpeg' });
  const blob = await api.encodeRasterPDF([
    { blob: jpeg, width: 640, height: 360, sourceWidth: 320, sourceHeight: 180 },
    { blob: jpeg, width: 200, height: 480, sourceWidth: 100, sourceHeight: 240 }
  ]);
  const binary = new Uint8Array(await blob.arrayBuffer());
  const latin = Buffer.from(binary).toString('latin1');
  assert.match(latin, /^%PDF-1\.4/);
  assert.match(latin, /\/Count 2 \/Kids \[3 0 R 6 0 R\]/);
  assert.match(latin, /\/MediaBox \[0 0 240 135\]/);
  assert.match(latin, /\/MediaBox \[0 0 75 180\]/);
  assert.match(latin, /\/Filter \/DCTDecode \/Length 8/);
  assert.equal(Buffer.from(binary).indexOf(Buffer.from(bytes)) > 0, true);
  const start = Number(latin.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(latin.slice(start, start + 4), 'xref');
  const rows = latin.slice(start).split('\n').slice(3, 11);
  assert.equal(rows.length, 8);
  rows.forEach((row, index) => { const offset = Number(row.slice(0, 10)); assert.equal(latin.slice(offset, offset + `${index + 1} 0 obj`.length), `${index + 1} 0 obj`); });
});

test('Raster PDF rejects empty, false JPEG MIME, malformed bytes and unsafe paper dimensions', async () => {
  await assert.rejects(api.encodeRasterPDF([]), /Số trang/);
  await assert.rejects(api.encodeRasterPDF([{ blob: new Blob(['png'], { type: 'image/png' }), width: 1, height: 1 }]), /JPEG đúng MIME/);
  await assert.rejects(api.encodeRasterPDF([{ blob: new Blob(['not-jpeg'], { type: 'image/jpeg' }), width: 1, height: 1 }]), /JPEG mã hóa/);
  const jpeg = new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' });
  await assert.rejects(api.encodeRasterPDF([{ blob: jpeg, width: 1, height: 1, sourceWidth: Infinity }]), /Kích thước giấy/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(api.encodeRasterPDF([{ blob: jpeg, width: 1, height: 1 }], { signal: abort.signal }), { name: 'AbortError' });
});

test('Portable package preserves raw JSON rather than double encoding it and respects abort', async () => {
  const raw = '{"format":"hh-design-package","assets":[]}';
  const result = await api.exportSharedDocument({ async exportPackage() { return raw; } }, 'package');
  assert.equal(await result.blob.text(), raw);
  assert.equal(result.filename, 'hh-shared-design.hhdesign');
  const abort = new AbortController(); abort.abort();
  await assert.rejects(api.exportSharedDocument({ async exportPackage() { return raw; } }, 'package', { signal: abort.signal }), { name: 'AbortError' });
});

test('Existing metadata-less SVG adapter API remains compatible', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
  const result = await api.exportSharedDocument({ async prepareExportSVG() { return { svg }; } }, 'svg');
  assert.equal(result.blob.type, 'image/svg+xml');
  assert.equal(await result.blob.text(), svg);
});

test('Shared export UI labels raster PDF limitations, separates native queue, and guards late downloads', () => {
  const source = fs.readFileSync(path.join(__dirname, '../graphic-design-export-center.js'), 'utf8');
  for (const marker of ['data-hec-shared="frame"', 'data-hec-shared="format"', 'data-hec-shared="scale"', 'data-hec-shared="background"', 'data-hec-action="shared-cancel"', 'PDF là ảnh RGB', 'không có chữ tìm kiếm', 'artboard riêng', '@media(forced-colors:active)']) assert.ok(source.includes(marker), marker);
  assert.match(source, /if \(disposed \|\| abort\.signal\.aborted \|\| sharedAbort !== abort\) return/);
  assert.match(source, /sharedAbort\?\.abort\(\); sharedAbort = null/);
  assert.match(source, /canvas\.width = canvas\.height = 0/);
});
