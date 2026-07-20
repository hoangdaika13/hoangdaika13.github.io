const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-typography-pro.js");
const source = fs.readFileSync(file, "utf8");
const typography = require(file);

test("Typography Pro exposes the expected UMD lifecycle and global API", () => {
  assert.equal(typography.VERSION, 1);
  assert.equal(typography.FORMAT, "hh-typography-pro-project");
  assert.equal(typography.STORAGE_KEY, "hh.graphic-typography-pro.project.v1");
  assert.equal(typeof typography.mount, "function");
  assert.equal(typeof typography.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicTypographyPro = api/);
  assert.match(source, /mounted\.has\(root\)/);
  assert.match(source, /mounted\.delete\(root\)/);
});

test("default project contains reusable heading, body and caption styles plus a font manifest", () => {
  const project = typography.createDefaultProject();
  assert.equal(project.format, typography.FORMAT);
  assert.deepEqual(typography.STYLE_ROLES.map((role) => role.id), ["heading", "body", "caption"]);
  assert.deepEqual(Object.keys(project.styles), ["heading", "body", "caption"]);
  assert.ok(project.fonts.length >= 3);
  assert.ok(project.fonts.every((font) => font.family && Array.isArray(font.axes)));
  assert.deepEqual(project.fonts.find((font) => font.id === "font-inter").axes.map((axis) => axis.tag), ["wght", "slnt"]);
  assert.equal(project.styles.heading.autoSize, true);
  assert.equal(project.styles.body.autoSize, false);
});

test("normalizer bounds project data and sanitizes CSS-facing font metadata", () => {
  const project = typography.normalizeProject({
    meta: { id: "../../bad id", name: "<img src=x onerror=alert(1)>" },
    canvas: { width: 1, height: 99999, background: "red" },
    activeStyle: "unknown",
    fonts: [{
      id: "../../font-one",
      family: 'Bad";}@import url(https://evil.invalid)',
      fallback: "serif; color: red",
      source: "remote",
      axes: [
        { tag: "wght", name: "Weight", min: -5000, max: 99999, default: 500 },
        { tag: "bad!", min: 0, max: 1, default: 0 }
      ]
    }],
    styles: {
      heading: {
        fontId: "../../font-one",
        text: '<script>globalThis.pwned = true</script>',
        fontSize: 9999,
        minFontSize: -2,
        maxFontSize: 9999,
        lineHeight: 9,
        tracking: 5,
        color: "expression(alert(1))",
        align: "diagonal",
        path: { enabled: true, type: "polygon", bend: 900, offset: -10 }
      }
    }
  });

  assert.equal(project.meta.id, "badid");
  assert.equal(project.canvas.width, 320);
  assert.equal(project.canvas.height, 1200);
  assert.equal(project.canvas.background, "#10151C");
  assert.equal(project.activeStyle, "heading");
  assert.equal(project.fonts[0].id, "font-one");
  assert.doesNotMatch(project.fonts[0].family, /[@{};():/]/);
  assert.doesNotMatch(project.fonts[0].fallback, /[;:]/);
  assert.equal(project.fonts[0].source, "local");
  assert.deepEqual(project.fonts[0].axes.map((axis) => axis.tag), ["wght"]);
  assert.equal(project.fonts[0].axes[0].min, -1000);
  assert.equal(project.fonts[0].axes[0].max, 4000);
  assert.equal(project.styles.heading.fontSize, 400);
  assert.equal(project.styles.heading.lineHeight, 3);
  assert.equal(project.styles.heading.tracking, 1);
  assert.equal(project.styles.heading.path.type, "arc");
  assert.equal(project.styles.heading.path.bend, 100);
  assert.equal(project.styles.heading.path.offset, 0);
});

test("CSS export includes real variable axes, kerning, tracking, ligatures and OpenType toggles", () => {
  const project = typography.createDefaultProject();
  project.styles.heading.axes.wght = 745;
  project.styles.heading.tracking = 0.035;
  project.styles.heading.kerning = false;
  project.styles.heading.ligatures = false;
  project.styles.heading.features.dlig = true;
  const heading = typography.styleToCss(project, "heading");
  const css = typography.exportCss(project);

  assert.match(heading, /font-variation-settings: "wght" 745, "slnt" 0/);
  assert.match(heading, /font-kerning: none/);
  assert.match(heading, /letter-spacing: 0\.035em/);
  assert.match(heading, /font-variant-ligatures: none/);
  assert.match(heading, /"dlig" 1/);
  assert.match(css, /\.hh-type-heading/);
  assert.match(css, /\.hh-type-body/);
  assert.match(css, /\.hh-type-caption/);
  assert.match(css, /no remote font files are embedded/);
  assert.doesNotMatch(css, /@import|url\s*\(/i);
});

test("auto-size engine finds a fitting size and reports overflow for fixed text", () => {
  const measure = (text, size) => String(text).length * size;
  const fitted = typography.fitTextBox("ABCDEFGHIJ KLMNOPQRST", {
    width: 120,
    height: 42,
    minFontSize: 6,
    maxFontSize: 60,
    fontSize: 60,
    lineHeight: 1,
    tracking: 0,
    autoSize: true
  }, measure);
  assert.ok(fitted.fontSize >= 6 && fitted.fontSize < 60);
  assert.ok(fitted.width <= 120.01);
  assert.ok(fitted.height <= 42.01);
  assert.equal(fitted.overflow, false);
  assert.ok(fitted.lines.length >= 2);

  const fixed = typography.fitTextBox("ABCDEFGHIJ", {
    width: 40,
    height: 20,
    minFontSize: 6,
    maxFontSize: 60,
    fontSize: 30,
    lineHeight: 1,
    tracking: 0,
    autoSize: false
  }, measure);
  assert.equal(fixed.fontSize, 30);
  assert.equal(fixed.overflow, true);
});

test("SVG renderer creates textPath output and escapes user-authored content", () => {
  const project = typography.createDefaultProject();
  project.styles.heading.text = '<script>alert("x")</script> & more';
  project.styles.heading.name = 'Heading "unsafe" <name>';
  project.styles.heading.path = { enabled: true, type: "wave", bend: 40, offset: 35, reverse: false };
  const svg = typography.renderTextSvg(project, "heading");

  assert.match(svg, /^<svg/);
  assert.match(svg, /<textPath href="#hhtp-path-heading" startOffset="35%">/);
  assert.match(svg, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; more/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /font-feature-settings:/);
  assert.match(svg, /font-variation-settings:/);
  assert.notEqual(
    typography.createTextPathD({ type: "arc", bend: 30, reverse: false }, 800, 300),
    typography.createTextPathD({ type: "wave", bend: 30, reverse: false }, 800, 300)
  );
  assert.notEqual(
    typography.createTextPathD({ type: "arc", bend: 30, reverse: false }, 800, 300),
    typography.createTextPathD({ type: "arc", bend: 30, reverse: true }, 800, 300)
  );
});

test("missing-font audit reports available, missing and unknown without overclaiming axes", () => {
  const project = typography.createDefaultProject();
  const result = typography.auditFonts(project, (family) => ({ Inter: true, Arial: false, Georgia: null }[family]), {
    variableFonts: true,
    openType: true,
    kerning: true,
    textPath: true,
    fontAudit: true,
    autoSize: true
  });
  assert.equal(result.find((font) => font.family === "Inter").status, "available");
  assert.equal(result.find((font) => font.family === "Inter").variableStatus, "manifest-axes");
  assert.equal(result.find((font) => font.family === "Arial").status, "missing");
  assert.equal(result.find((font) => font.family === "Georgia").status, "unknown");

  const unsupported = typography.auditFonts(project, () => true, { variableFonts: false });
  assert.equal(unsupported.find((font) => font.family === "Inter").variableStatus, "unsupported-browser");
});

test("capability detection returns truthful unsupported states when browser APIs are absent", () => {
  assert.deepEqual(typography.detectCapabilities({}), {
    variableFonts: false,
    openType: false,
    kerning: false,
    textPath: false,
    fontAudit: false,
    autoSize: true
  });

  const supported = typography.detectCapabilities({
    CSS: { supports(property) { return property !== "font-feature-settings"; } },
    document: {
      createElement() { return { getContext() { return { measureText() { return { width: 10 }; } }; } }; },
      createElementNS() { return {}; }
    }
  });
  assert.equal(supported.variableFonts, true);
  assert.equal(supported.openType, false);
  assert.equal(supported.kerning, true);
  assert.equal(supported.textPath, true);
  assert.equal(supported.fontAudit, true);
});

test("project and font manifest exports remain reusable local-first JSON", () => {
  const project = typography.createDefaultProject();
  const audit = typography.auditFonts(project, () => true, { variableFonts: true });
  const exported = JSON.parse(typography.exportProject(project));
  const manifest = JSON.parse(typography.exportFontManifest(project, audit));

  assert.equal(exported.format, typography.FORMAT);
  assert.equal(manifest.format, "hh-typography-font-manifest");
  assert.equal(manifest.projectId, project.meta.id);
  assert.deepEqual(manifest.fonts.find((font) => font.id === "font-inter").usedBy, ["heading"]);
  assert.equal(manifest.fonts.find((font) => font.id === "font-inter").audit, "available");
  assert.ok(manifest.fonts.every((font) => !Object.hasOwn(font, "url")));
});

test("UI contract is local-first, responsive, keyboard operable and explicit about unsupported features", () => {
  for (const marker of [
    "data-graphic-typography-pro",
    "data-htp-axes",
    "data-htp-features",
    "data-htp-toggle=\"kerning\"",
    "data-htp-toggle=\"ligatures\"",
    "data-htp-toggle=\"autoSize\"",
    "data-htp-toggle=\"path\"",
    "data-htp-font-list",
    "data-htp-action=\"export-css\"",
    "data-htp-action=\"export-project\"",
    "data-htp-action=\"export-manifest\"",
    "aria-live=\"polite\"",
    "role=\"tablist\"",
    "ArrowLeft",
    "focus-visible",
    "@media(max-width:420px)",
    "prefers-reduced-motion:reduce",
    "Trình duyệt không hỗ trợ font-variation-settings",
    "không tải font từ mạng",
    "FileReader",
    "localStorage"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.match(source, /escapeHtml\(style\.text\)/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /@import\s|cdn\.|unpkg|jsdelivr/i);
});
