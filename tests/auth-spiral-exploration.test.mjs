import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HOME,
  SYSTEMS,
  newMap,
  projection,
  galaxyFrame,
  screen,
  entries,
  visit,
  overview,
  setSpread,
  orbit,
  pan,
  zoomAt,
  advance
} from "../auth-spiral-map.mjs";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url));
const catalog = JSON.parse(read("data/auth-planets/catalog.json"));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, a + " versus " + b);
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const groups = (s, w = 820, h = 405) => entries(s, projection(s, w, h));

test("every selectable world has Vietnamese measurements, a NASA source and a local WebP", () => {
  const ids = SYSTEMS.flatMap((sys) => sys.bodies.map((b) => b.id));
  assert.equal(new Set(ids).size, 15);
  assert.deepEqual(Object.keys(catalog.planets).sort(), ids.sort());
  const solar = SYSTEMS[0].bodies;
  assert.deepEqual(
    solar.map((b) => b.name),
    ["Sao Thủy", "Sao Kim", "Trái Đất", "Sao Hỏa", "Sao Mộc", "Sao Thổ", "Sao Thiên Vương", "Sao Hải Vương"]
  );
  for (const system of SYSTEMS) {
    let lastDistance = 0,
      lastPeriod = 0;
    for (const body of system.bodies) {
      const fact = catalog.planets[body.id];
      assert.equal(fact.system, system.id);
      assert.equal(fact.name, body.name);
      for (const field of ["source", "imageSource"]) {
        const url = new URL(fact[field]);
        assert.equal(url.protocol, "https:");
        assert.ok(url.hostname.endsWith(".nasa.gov"), url.href);
      }
      assert.match(fact.image, new RegExp("^assets/auth-planets/" + body.id + "\\.webp$"));
      assert.equal(read(fact.image).subarray(8, 12).toString(), "WEBP");
      assert.ok(fact.summary.length > 35 && fact.feature.length > 35);
      assert.ok(fact.distanceAu > lastDistance && fact.periodDays > lastPeriod && fact.diameterKm > 4000);
      lastDistance = fact.distanceAu;
      lastPeriod = fact.periodDays;
    }
  }
  assert.equal(catalog.planets.saturn.diameterKm, 116464);
  assert.equal(catalog.planets.earth.distanceAu, 1);
});

test("system and orbit expansion are independent of zoom and move moons with their planets", () => {
  const s = newMap();
  visit(s, "sol", 820, 405, true);
  const start = groups(s),
    zoom = s.camera.zoom;
  setSpread(s, "all", 2.4);
  const global = groups(s);
  const length = (entry, key) => distance(entry.pos, entry.planets[key].p);
  near(distance(global[0].pos, global[1].pos) / distance(start[0].pos, start[1].pos), 2.4);
  near(length(global[0], 5) / length(start[0], 5), 2.4);
  near(
    distance(global[0].planets[5].p, global[0].planets[5].moon) /
      distance(start[0].planets[5].p, start[0].planets[5].moon),
    2.4
  );
  setSpread(s, "local", 1.6);
  const local = groups(s);
  assert.deepEqual(local[0].pos, global[0].pos);
  near(length(local[0], 5) / length(global[0], 5), 1.6);
  near(length(local[1], 4), length(global[1], 4));
  for (const planet of local[0].planets) assert.deepEqual(planet.pt, screen(planet.p, projection(s, 820, 405)));
  near(s.camera.zoom, zoom);
  zoomAt(s, 1.2, 120, 180, 820, 405);
  assert.deepEqual(
    groups(s)[0].planets.map((p) => p.p),
    local[0].planets.map((p) => p.p)
  );
});

test("exiting either system restores manual orientation and fits both fully extended systems", () => {
  for (const [w, h] of [
    [320, 255],
    [343, 350],
    [830, 400],
    [1440, 380]
  ]) {
    const s = newMap();
    orbit(s, 144, -72);
    const { yaw, tilt } = s.camera;
    setSpread(s, "all", 2.4);
    for (const sys of SYSTEMS) {
      visit(s, sys.id, w, h, true);
      setSpread(s, "local", 2.4);
    }
    overview(s, w, h);
    advance(s, 0.34, false);
    assert.ok(s.travel);
    advance(s, 0.4, false);
    assert.equal(s.travel, null);
    near(s.camera.yaw, yaw);
    near(s.camera.tilt, tilt);
    for (const group of groups(s, w, h))
      for (const pt of [group.anchor, ...group.planets.map((p) => p.pt)]) {
        assert.ok(pt.x >= 0 && pt.x <= w && pt.y >= 0 && pt.y <= h, JSON.stringify(pt));
      }
    overview(s, w, h, true, true);
    near(s.camera.yaw, HOME.yaw);
    near(s.camera.tilt, HOME.tilt);
  }
});

test("pan moves by CSS pixels, pointer-anchored zoom fixes its point, and pause freezes orbits", () => {
  const s = newMap(),
    w = 343,
    h = 350;
  visit(s, "sol", w, h, true);
  const v = groups(s, w, h)[0].planets[5].pt;
  pan(s, 24, -31, projection(s, w, h));
  const shifted = groups(s, w, h)[0].planets[5].pt;
  near(shifted.x - v.x, 24);
  near(shifted.y - v.y, -31);
  zoomAt(s, 1.25, shifted.x, shifted.y, w, h);
  const zoomed = groups(s, w, h)[0].planets[5].pt;
  near(zoomed.x, shifted.x);
  near(zoomed.y, shifted.y);
  advance(s, 1, false);
  near(s.elapsed, 0);
  advance(s, 1, true);
  near(s.elapsed, 1);
  assert.notDeepEqual(groups(s, w, h)[0].planets[5].pt, zoomed);
});

test("the distant galaxy spans the full login even at minimum map zoom", () => {
  for (const [width, height] of [
    [1727, 847],
    [2560, 1080],
    [375, 812],
    [712, 402]
  ]) {
    const camera = { ...newMap().camera, zoom: 0.15, panX: -50, panY: 50 };
    const sky = galaxyFrame(camera, width, height);
    assert.ok(sky.scale * 11.85 > width && sky.scale * 11.85 > height);
    assert.ok(sky.x > width * 0.3 && sky.x < width * 0.65 && sky.y > 0 && sky.y < height);
    assert.equal(sky.roll !== 0, height > width);
    const close = galaxyFrame({ ...camera, zoom: 26, detail: 1 }, width, height);
    assert.ok(close.scale / sky.scale < 1.5);
    assert.ok(close.light < sky.light);
    assert.equal(galaxyFrame({ ...camera, detail: 1 }, width, height, false).light, 1);
  }
});

test("login can install the small map offline while the GPU, fact catalog and illustrations load on demand", () => {
  const worker = read("sw.js").toString(),
    core = worker.match(/const CORE = \[([\s\S]*?)\];/)[1];
  assert.match(core, /auth-spiral-map\.mjs/);
  assert.match(core, /auth-spiral-facts\.mjs/);
  assert.doesNotMatch(core, /auth-spiral-space\.mjs|data\/auth-planets|assets\/auth-planets|three\.module/);
  const shell = read("index.html").toString().split('<template id="spiral-atlas-template">')[0];
  assert.doesNotMatch(shell, /src="assets\/auth-planets\//);
  for (const key of [
    "data-space-open",
    "data-space-spread",
    "data-space-planet",
    "data-space-overview",
    "data-space-pan",
    "data-space-reset",
    "data-spiral-explore"
  ])
    assert.ok(shell.includes(key), key);
});
