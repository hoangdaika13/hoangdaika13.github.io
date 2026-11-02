'use strict';
/* Render original code-native SVG scenes to responsive WebP. No remote input or image edits. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const S = require('../hh-multiverse-scenes');
const ROOT = path.resolve(__dirname, '..'), SAMPLE = process.argv.includes('--sample'), FORCE = process.argv.includes('--force');
const DEST = path.join(ROOT, SAMPLE ? '.study-local/multiverse-scene-preview' : 'assets/multiverse/scenes');
const MANIFEST = SAMPLE ? path.join(DEST, 'scenes-manifest-v1.json') : path.join(ROOT, 'assets/multiverse/scenes-manifest-v1.json');
const QUALITY = Object.freeze({ 320: .54, 640: .50, 1280: .45 });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function playwright() {
  if (process.env.HH_QA_PLAYWRIGHT) return require(process.env.HH_QA_PLAYWRIGHT);
  for (const name of ['playwright', 'playwright-core']) { try { return require(name); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; } }
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache/_npx');
  if (fs.existsSync(cache)) for (const child of fs.readdirSync(cache)) {
    const folder = path.join(cache, child, 'node_modules/playwright-core');
    if (fs.existsSync(folder)) return require(folder);
  }
  throw Error('Set HH_QA_PLAYWRIGHT to the installed Playwright module; no dependency is downloaded.');
}
function executable() {
  if (process.env.HH_QA_CHROMIUM) return process.env.HH_QA_CHROMIUM;
  const folder = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(folder)) for (const child of fs.readdirSync(folder).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    for (const relative of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
      const file = path.join(folder, child, relative); if (fs.existsSync(file)) return file;
    }
  }
  return undefined;
}
async function render(page, svg, widths) {
  return page.evaluate(async ({ svg, widths, quality }) => {
    const image = new Image(), source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      image.src = source; await image.decode();
      const output = [];
      for (const width of widths) {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = Math.round(width * 9 / 16);
        const context = canvas.getContext('2d', { alpha: false });
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL('image/webp', quality[width]);
        if (!result.startsWith('data:image/webp;base64,')) throw Error('This Chromium cannot encode WebP.');
        output.push({ width, height: canvas.height, base64: result.slice(result.indexOf(',') + 1) });
        canvas.width = canvas.height = 1;
      }
      return output;
    } finally { URL.revokeObjectURL(source); }
  }, { svg, widths, quality: QUALITY });
}
async function main() {
  fs.mkdirSync(DEST, { recursive: true });
  const existing = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { items: [] };
  const known = new Map(existing.items.map(item => [item.id, item]));
  const rows = SAMPLE ? S.catalog.filter((_, index) => [0, 33, 66].includes(index % 100)) : S.catalog;
  const { chromium } = playwright(), browser = await chromium.launch({ headless: true, executablePath: executable() });
  const items = new Array(rows.length); let next = 0, complete = 0;
  const concurrency = Math.max(1, Math.min(8, Number(process.env.HH_SCENE_CONCURRENCY) || 4));
  try {
    await Promise.all(Array.from({ length: concurrency }, async () => {
      const page = await browser.newPage();
      try { while (next < rows.length) {
        const index = next++, scene = rows[index], source = S.svg(scene.id), sourceSha256 = sha(source), previous = known.get(scene.id);
        if (!FORCE && previous && previous.sourceSha256 !== sourceSha256) throw Error('Versioned SVG source changed: ' + scene.id + '. Use a new version before publishing, or --force for an unpublished build.');
        const reusable = !FORCE && previous && scene.widths.every(width => {
          const variant = previous.variants.find(item => item.width === width), file = path.join(DEST, scene.id + '-v1-' + width + '.webp');
          return variant && fs.existsSync(file) && sha(fs.readFileSync(file)) === variant.sha256;
        });
        if (reusable) items[index] = previous;
        else {
          const rendered = await render(page, source, scene.widths), variants = [];
          for (const variant of rendered) {
            const file = scene.id + '-v1-' + variant.width + '.webp', bytes = Buffer.from(variant.base64, 'base64');
            if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error('Invalid WebP: ' + file);
            fs.writeFileSync(path.join(DEST, file), bytes);
            variants.push({ file, width: variant.width, height: variant.height, bytes: bytes.length, sha256: sha(bytes) });
          }
          items[index] = { id: scene.id, theme: scene.theme, kind: 'scene', generation: 'deterministic procedural SVG illustration', sourceSha256, variants };
        }
        complete++;
        if (complete % 100 === 0 || complete === rows.length) console.log('Rendered ' + complete + '/' + rows.length + ' scenes');
      } } finally { await page.close(); }
    }));
  } finally { await browser.close(); }
  const totalBytes = items.reduce((sum, item) => sum + item.variants.reduce((n, v) => n + v.bytes, 0), 0);
  if (totalBytes > 35 * 1024 * 1024) throw Error('Scene package exceeds the 35MiB budget: ' + totalBytes);
  const manifest = {
    version: S.VERSION, generation: 'original code-native deterministic SVG illustrations',
    generator: 'hh-multiverse-scenes.js', renderer: 'native Chromium canvas WebP',
    purpose: 'Fictional concept landscapes, not images of simulation snapshots.',
    count: items.length, themes: S.THEMES.map(theme => theme.id), totalBytes, items
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ scenes: items.length, variants: items.length * 3, bytes: totalBytes, sample: SAMPLE }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { QUALITY, render };
