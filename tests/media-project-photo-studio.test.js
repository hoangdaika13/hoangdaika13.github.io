const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const studio = require(path.join(root, "media-project-photo-studio.js"));
const source = fs.readFileSync(path.join(root, "media-project-photo-studio.js"), "utf8");
const css = fs.readFileSync(path.join(root, "media-project-photo-studio.css"), "utf8");
const page = fs.readFileSync(path.join(root, "media-design-page.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("photo recipes are bounded, deterministic and non-destructive", () => {
  const recipe = studio.normalizeRecipe({ exposure: 99, contrast: -8, saturation: 999, temperature: -999, blur: 90, grayscale: 250, rotation: 91, quality: 3, format: "image/tiff" });
  assert.deepEqual(recipe, { exposure: 3, contrast: 20, saturation: 240, temperature: -100, blur: 12, grayscale: 100, rotation: 0, flipX: false, flipY: false, quality: 30, format: "image/webp" });
  assert.match(studio.recipeFilter(recipe), /brightness\(800%\).*contrast\(20%\).*saturate\(240%\)/);
  assert.deepEqual(studio.defaultRecipe(), { exposure: 0, contrast: 100, saturation: 100, temperature: 0, blur: 0, grayscale: 0, rotation: 0, flipX: false, flipY: false, quality: 92, format: "image/webp" });
});

test("histogram samples real RGB pixels into stable channels", () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  const histogram = studio.calculateHistogram(pixels, 8);
  assert.equal(histogram.samples, 4);
  assert.equal(histogram.red.reduce((a, b) => a + b, 0), 4);
  assert.equal(histogram.green.reduce((a, b) => a + b, 0), 4);
  assert.equal(histogram.blue.reduce((a, b) => a + b, 0), 4);
  assert.match(studio.histogramPath(histogram.luminance), /^M/);
});

test("Project Core and Photo Lab expose real workflows and shared Media Bin ingest", () => {
  ["data-mpp-checkpoint", "data-mpp-branch-form", "data-mpp-import-assets", "data-mpp-export-manifest", "data-mpp-photo-files", "data-mpp-photo-canvas", "data-mpp-recipe", "data-mpp-export-photo"].forEach((token) => assert.match(source, new RegExp(token)));
  assert.match(source, /createStateStore/);
  assert.match(source, /addAssetRecord/);
  assert.match(source, /saveAsset/);
  assert.match(source, /createImageBitmap/);
  assert.match(source, /OffscreenCanvas/);
  assert.match(page, /HHMediaProjectPhotoStudio\?\.mount/);
});

test("new studios are colorful, responsive, motion-safe and offline cached", () => {
  assert.match(css, /is-project/);
  assert.match(css, /is-photo/);
  assert.match(css, /mpp-photo-develop/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(loader, /media-project-photo-studio\.css\?v=3/);
  assert.match(loader, /media-project-photo-studio\.js\?v=2/);
  assert.match(worker, /media-project-photo-studio\.css\?v=3/);
  assert.match(worker, /media-project-photo-studio\.js\?v=2/);
});
