const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "..", "cosmic-solar-system-3d.js"), "utf8");

test("solar renderer exposes the complete lifecycle API", () => {
  assert.match(source, /window\.HHUniverseSolar3D\s*=\s*api/);
  for (const method of ["mount", "updateTime", "selectBody", "setQuality", "resize", "unmount", "getState"]) {
    assert.match(source, new RegExp(`${method}\\s*\\(`), `missing ${method}`);
  }
});

test("positions and sampled orbits come from Astronomy Engine without a fake fallback", () => {
  assert.match(source, /Astronomy Engine chưa sẵn sàng; không dùng vị trí giả/);
  assert.match(source, /\.HelioVector\(/);
  assert.match(source, /\.GeoVector\(/);
  assert.match(source, /orbitSamples/);
  assert.doesNotMatch(source, /Math\.(?:sin|cos)\([^\n]+period[^\n]+\)/);
});

test("WebGL2, Canvas Lite and context recovery are implemented", () => {
  assert.match(source, /getContext\("webgl2"/);
  assert.match(source, /getContext\("2d"\)/);
  assert.match(source, /webglcontextlost/);
  assert.match(source, /webglcontextrestored/);
  assert.match(source, /deleteBuffer/);
  assert.match(source, /deleteProgram/);
});

test("input, visibility and cleanup contracts are present", () => {
  for (const signal of ["pointerdown", "pointermove", "pointercancel", "lostpointercapture", "wheel", "keydown", "visibilitychange"]) assert.match(source, new RegExp(signal));
  assert.match(source, /ResizeObserver/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /removeEventListener/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /data-solar3d-status[^>]+aria-live/, "rapid visual status must not flood screen readers");
  assert.match(source, /data-solar3d-live[^>]+aria-live="polite"/);
});

test("playback keeps controls explicit and avoids rebuilding static orbit DOM every frame", () => {
  assert.match(source, /ngày\/giây/);
  assert.match(source, /data-solar3d-date/);
  assert.match(source, /data-solar3d-scale/);
  assert.match(source, /syncTimeControls/);
  assert.match(source, /orbitBuffers/);
  assert.match(source, /STATIC_DRAW/);
  assert.doesNotMatch(source, /updateLabels[\s\S]{0,350}replaceChildren/);
  assert.match(source, /aria-pressed="false"/);
  assert.doesNotMatch(source, /aria-selected/);
});

test("renderer consumes the selectors styled by the solar workspace stylesheet", () => {
  for (const selector of ["stage", "gl", "fallback", "labels", "hud", "status", "body-list", "inspector", "controls", "timeline", "quality", "time-range"]) {
    assert.match(source, new RegExp(`data-solar3d-${selector}`), `missing data-solar3d-${selector}`);
  }
});
