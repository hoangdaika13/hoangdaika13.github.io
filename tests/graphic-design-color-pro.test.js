const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-color-pro.js");
const source = fs.readFileSync(file, "utf8");
const color = require(file);

function close(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message || `${actual} is not within ${tolerance} of ${expected}`);
}

function closeRgb(actual, expected, tolerance = 0.6) {
  close(actual.r, expected.r, tolerance, "red channel");
  close(actual.g, expected.g, tolerance, "green channel");
  close(actual.b, expected.b, tolerance, "blue channel");
}

test("Color Pro exposes a versioned UMD lifecycle and local-first project", () => {
  assert.equal(color.VERSION, 1);
  assert.equal(color.FORMAT, "hh-graphic-color-pro-project");
  assert.equal(color.STORAGE_KEY, "hh.graphic-color-pro.project.v1");
  assert.equal(typeof color.mount, "function");
  assert.equal(typeof color.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicColorPro = api/);
  assert.match(source, /mounted\.has\(root\)/);
  assert.match(source, /mounted\.delete\(root\)/);

  const project = color.createDefaultProject();
  assert.equal(project.format, color.FORMAT);
  assert.equal(project.version, color.VERSION);
  assert.ok(project.mesh.points.length >= 4);
  assert.equal(project.lut.type, "3D");
  assert.equal(project.lutEnabled, false);
  assert.deepEqual(Object.keys(project.brand), ["name", "primary", "secondary", "accent", "neutral", "background", "text"]);
});

test("RGB and HSL conversion handles primary colors and round-trips", () => {
  assert.deepEqual(color.hexToRgb("#f00"), { r: 255, g: 0, b: 0 });
  assert.equal(color.rgbToHex({ r: 51, g: 102, b: 153 }), "#336699");
  assert.deepEqual(color.rgbToHsl("#FF0000"), { h: 0, s: 100, l: 50 });
  assert.deepEqual(color.rgbToHsl("#00FF00"), { h: 120, s: 100, l: 50 });
  assert.deepEqual(color.rgbToHsl("#0000FF"), { h: 240, s: 100, l: 50 });
  closeRgb(color.hslToRgb(color.rgbToHsl("#7A3FD1")), color.hexToRgb("#7A3FD1"));
});

test("CIELAB D65 conversion matches reference values and round-trips sRGB", () => {
  const red = color.rgbToLab("#FF0000");
  close(red.l, 53.2408, 0.001);
  close(red.a, 80.0925, 0.001);
  close(red.b, 67.2032, 0.001);

  const original = color.hexToRgb("#336699");
  closeRgb(color.labToRgb(color.rgbToLab(original)), original, 0.02);
  assert.equal(color.labToRgbReport({ l: 80, a: 180, b: 150 }).inGamut, false);
});

test("OKLab and OKLCH conversion preserves hue and reports out-of-gamut values", () => {
  const red = color.rgbToOklch("#FF0000");
  close(red.l, 0.627955, 0.00001);
  close(red.c, 0.257683, 0.00001);
  close(red.h, 29.2338, 0.001);
  closeRgb(color.oklchToRgb(red), { r: 255, g: 0, b: 0 }, 0.02);
  assert.equal(color.colorReport("#FF5F87").inSrgbGamut, true);

  const report = color.oklchToRgbReport({ l: 0.7, c: 0.5, h: 40 });
  assert.equal(report.inGamut, false);
  assert.equal(report.clipped, true);
  assert.ok(report.raw.r > 255 || report.raw.g < 0 || report.raw.b < 0);

  const mapped = color.mapOklchToSrgb({ l: 0.7, c: 0.5, h: 40 });
  assert.equal(mapped.inGamut, true);
  assert.equal(mapped.chromaReduced, true);
  assert.ok(mapped.mapped.c < 0.5);
});

test("harmony generator works in OKLCH and preserves explicit gamut warnings", () => {
  const triadic = color.generateHarmony("#FF0000", "triadic");
  assert.equal(triadic.length, 3);
  close((triadic[1].oklch.h - triadic[0].oklch.h + 360) % 360, 120, 0.01);
  close((triadic[2].oklch.h - triadic[0].oklch.h + 360) % 360, 240, 0.01);
  assert.ok(triadic.every((entry) => /^#[0-9A-F]{6}$/.test(entry.hex)));
  assert.ok(triadic.some((entry) => entry.gamutWarning));
  assert.deepEqual(color.generateHarmonyHex("#336699", "complementary"), color.generateHarmony("#336699", "complementary").map((entry) => entry.hex));
  assert.equal(color.generateHarmony("#336699", "monochromatic").length, 5);
});

test("gradient mesh model normalizes controls and samples deterministic colors", () => {
  const mesh = color.normalizeGradientMesh({
    width: 2,
    height: 99999,
    points: [
      { id: "unsafe id", x: -2, y: 0, strength: 99, color: "red" },
      { id: "safe", x: 1, y: 1, strength: 1, color: "#0000FF" }
    ]
  });
  assert.equal(mesh.width, 64);
  assert.equal(mesh.height, 4096);
  assert.equal(mesh.points[0].id, "unsafeid");
  assert.equal(mesh.points[0].x, 0);
  assert.equal(mesh.points[0].strength, 3);
  assert.equal(mesh.points[0].color, "#FF5F87");

  const first = color.sampleGradientMesh(mesh, 0.2, 0.2);
  const second = color.sampleGradientMesh(mesh, 0.8, 0.8);
  assert.match(first.hex, /^#[0-9A-F]{6}$/);
  assert.notEqual(first.hex, second.hex);
  assert.equal(color.drawGradientMesh({}, mesh).supported, false);
});

test("palette extraction uses local pixels, ignores transparent pixels and separates dominant colors", () => {
  const values = [];
  for (let index = 0; index < 20; index += 1) values.push(255, 0, 0, 255);
  for (let index = 0; index < 12; index += 1) values.push(0, 0, 255, 255);
  for (let index = 0; index < 50; index += 1) values.push(0, 255, 0, 0);
  const palette = color.extractPaletteFromPixels(new Uint8ClampedArray(values), 4);
  assert.deepEqual(palette, ["#FF0000", "#0000FF"]);
  assert.deepEqual(color.extractPaletteFromPixels(null, 6), []);
});

test("WCAG contrast and RGB/CMYK soft-proof expose honest approximation metadata", () => {
  close(color.contrastRatio("#000000", "#FFFFFF"), 21, 0.0001);
  assert.deepEqual(color.evaluateContrast("#000000", "#FFFFFF", 16, false), {
    ratio: 21,
    largeText: false,
    aa: true,
    aaa: true,
    aaThreshold: 4.5,
    aaaThreshold: 7,
    label: "AAA"
  });
  assert.equal(color.evaluateContrast("#777777", "#FFFFFF", 16, false).aa, false);
  assert.equal(color.evaluateContrast("#777777", "#FFFFFF", 24, false).aa, true);

  const cmyk = color.rgbToCmykApproximation("#FF0000");
  assert.deepEqual([cmyk.c, cmyk.m, cmyk.y, cmyk.k], [0, 100, 100, 0]);
  assert.equal(cmyk.approximate, true);
  assert.match(cmyk.notice, /xấp xỉ/i);
  closeRgb(color.cmykToRgbApproximation(cmyk), { r: 255, g: 0, b: 0 }, 0.01);

  const proof = color.softProofRgb("#FF5F87", { dotGain: 0.2, inkLimit: 260, paper: "#F4F0E6" });
  assert.equal(proof.approximate, true);
  assert.equal(proof.profile, "generic-cmyk-soft-proof");
  assert.match(proof.notice, /không thay thế ICC profile/i);
  assert.notEqual(proof.hex, "#FF5F87");
});

test("3D .cube parser, exporter and trilinear application preserve identity", () => {
  const identity = color.createIdentityLut(2);
  const exported = color.exportCubeLut(identity, "Identity Test");
  const parsed = color.parseCubeLut(exported);
  assert.equal(parsed.title, "Identity Test");
  assert.equal(parsed.type, "3D");
  assert.equal(parsed.size, 2);
  assert.equal(parsed.data.length, 8);
  closeRgb(color.applyCubeLut({ r: 24, g: 128, b: 242 }, parsed), { r: 24, g: 128, b: 242 }, 0.01);

  const invert = color.createIdentityLut(2);
  invert.title = "Invert";
  invert.data = invert.data.map(([red, green, blue]) => [1 - red, 1 - green, 1 - blue]);
  closeRgb(color.applyCubeLut("#204080", invert), { r: 223, g: 191, b: 127 }, 0.01);

  const pixels = color.applyLutToPixels(new Uint8ClampedArray([32, 64, 128, 77]), invert);
  assert.deepEqual(Array.from(pixels), [223, 191, 127, 77]);
});

test("1D .cube parser interpolates channels and rejects malformed or oversized LUTs", () => {
  const oneDimensional = color.parseCubeLut([
    'TITLE "Gamma preview"',
    "LUT_1D_SIZE 3",
    "DOMAIN_MIN 0 0 0",
    "DOMAIN_MAX 1 1 1",
    "0 0 0",
    "0.25 0.5 0.75",
    "1 1 1"
  ].join("\n"));
  assert.equal(oneDimensional.type, "1D");
  closeRgb(color.applyCubeLut({ r: 127.5, g: 127.5, b: 127.5 }, oneDimensional), { r: 63.75, g: 127.5, b: 191.25 }, 0.01);

  assert.throws(() => color.parseCubeLut("LUT_3D_SIZE 2\n0 0 0"), /8 mẫu/);
  assert.throws(() => color.parseCubeLut("LUT_3D_SIZE 64"), /2 đến 33/);
  assert.throws(() => color.parseCubeLut("LUT_3D_SIZE 2\nUNKNOWN 1"), /không được hỗ trợ/);
  assert.throws(() => color.normalizeCubeLut({ type: "3D", size: 2, data: [] }), /8 mẫu/);
});

test("project normalization bounds data, escapes display input and exports safe brand tokens", () => {
  const project = color.normalizeProject({
    meta: { id: "../../bad id", name: '<img src=x onerror="alert(1)">' },
    activeTab: "remote",
    baseColor: "expression(alert(1))",
    palette: ["red", "#123456", "<script>"],
    mesh: { points: [{ color: "javascript:alert(1)" }, { color: "#FFFFFF" }] },
    brand: { name: "Bad */ body{color:red}", primary: "url(evil)", text: "#FFFFFF" },
    proof: { dotGain: 9, inkLimit: 999, paper: "transparent" }
  });
  assert.equal(project.meta.id, "badid");
  assert.equal(project.activeTab, "convert");
  assert.equal(project.baseColor, "#FF5F87");
  assert.deepEqual(project.palette, ["#FF5F87", "#123456", "#FF5F87"]);
  assert.equal(project.proof.dotGain, 0.4);
  assert.equal(project.proof.inkLimit, 400);
  assert.equal(color.escapeHtml(project.meta.name), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

  const css = color.exportBrandCss(project.brand);
  assert.doesNotMatch(css, /\*\/ body/);
  assert.doesNotMatch(css, /url\s*\(/i);
  assert.match(css, /--hh-color-primary: #[0-9A-F]{6}/);
  const exported = JSON.parse(color.exportProject(project));
  assert.equal(exported.format, color.FORMAT);
  assert.equal(exported.version, color.VERSION);
});

test("capability detection returns truthful unsupported browser states", () => {
  const unsupported = color.detectCapabilities({});
  assert.equal(unsupported.canvas2d.supported, false);
  assert.equal(unsupported.localImage.supported, false);
  assert.equal(unsupported.fileImport.supported, false);
  assert.equal(unsupported.download.supported, false);
  assert.equal(unsupported.localStorage.supported, false);
  assert.match(unsupported.localImage.reason, /Không thể/);

  const supported = color.detectCapabilities({
    document: { createElement() { return { getContext() { return {}; } }; } },
    FileReader: function FileReader() {},
    Image: function Image() {},
    Blob: function Blob() {},
    URL: { createObjectURL() {} },
    localStorage: {},
    matchMedia() { return { matches: true }; }
  });
  assert.equal(supported.canvas2d.supported, true);
  assert.equal(supported.localImage.supported, true);
  assert.equal(supported.fileImport.supported, true);
  assert.equal(supported.download.supported, true);
  assert.equal(supported.localStorage.supported, true);
  assert.equal(supported.reducedMotion, true);
});

test("UI contract is responsive, keyboard operable, local-only and explicit about limitations", () => {
  for (const marker of [
    "data-graphic-color-pro",
    "data-hhc-mesh-canvas",
    "data-hhc-image-file",
    "data-hhc-lut-file",
    "data-hhc-capabilities",
    "data-hhc-contrast-preview",
    "role=\"tablist\"",
    "role=\"tabpanel\"",
    "aria-live=\"polite\"",
    "ArrowLeft",
    "ArrowRight",
    "focus-visible",
    "@media(max-width:420px)",
    "prefers-reduced-motion:reduce",
    "FileReader không được hỗ trợ",
    "Canvas 2D không khả dụng",
    "CMYK xấp xỉ",
    "không thay thế ICC profile",
    "localStorage",
    "hh.graphic-color-pro.project.v1"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);

  assert.match(source, /escapeHtml\(capability\.reason\)/);
  assert.match(source, /escapeHtml\(role\.label\)/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /@import\s|cdn\.|unpkg|jsdelivr/i);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
});
