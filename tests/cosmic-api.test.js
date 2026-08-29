const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const handler = require(path.resolve(__dirname, "..", "utils", "cosmic-data-gateway.js"));

function responseHarness() {
  const headers = new Map();
  let statusCode = 200;
  let body;
  return {
    setHeader(key, value) { headers.set(String(key).toLowerCase(), value); },
    status(value) { statusCode = value; return this; },
    json(value) { body = value; return this; },
    result() { return { headers, statusCode, body }; }
  };
}

function upstream(payload, status = 200) {
  const text = JSON.stringify(payload);
  return { ok: status >= 200 && status < 300, status, headers: { get(name) { return String(name).toLowerCase() === "content-length" ? String(Buffer.byteLength(text)) : null; } }, async text() { return text; } };
}

test("date ranges use ISO days and enforce a bounded window", () => {
  const normal = handler._test.boundedDateRange({ start: "2026-08-20", end: "2026-08-25" }, 31);
  assert.deepEqual(normal, { start: "2026-08-20", end: "2026-08-25" });
  const bounded = handler._test.boundedDateRange({ start: "2026-08-20", end: "2027-08-25" }, 31);
  assert.deepEqual(bounded, { start: "2026-08-20", end: "2026-09-20" });
});

test("JPL CAD rows are normalized with source, units and uncertainty context", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/ssd-api\.jpl\.nasa\.gov\/cad\.api/);
    return upstream({
      fields: ["des", "fullname", "cd", "dist", "dist_min", "dist_max", "v_rel", "h", "diameter", "orbit_id"],
      data: [["2026 AB", "(2026 AB)", "2026-Aug-30 12:30", "0.041", "0.040", "0.042", "13.5", "22.1", "0.12", "17"]]
    });
  };
  try {
    const req = { method: "GET", headers: {}, socket: { remoteAddress: "test-asteroid" }, query: { source: "asteroids", start: "2026-08-29", end: "2026-08-31", distance: "0.1" } };
    const res = responseHarness();
    await handler(req, res);
    const { statusCode, body, headers } = res.result();
    assert.equal(statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.sourceName, "JPL CNEOS Close-Approach Data");
    assert.equal(body.dataType, "observed");
    assert.equal(body.units.distance, "au");
    assert.equal(body.data.records[0].designation, "2026 AB");
    assert.equal(body.data.records[0].distanceAu, 0.041);
    assert.match(headers.get("cache-control"), /stale-while-revalidate/);
  } finally { global.fetch = originalFetch; }
});

test("NASA media results keep NASA ID, attribution and bounded metadata", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/images-api\.nasa\.gov\/search/);
    return upstream({ collection: { metadata: { total_hits: 1 }, items: [{ href: "https://images-api.nasa.gov/asset/NASA_1", data: [{ nasa_id: "NASA_1", title: "A real nebula", description: "Observed by a NASA mission.", media_type: "image", date_created: "2026-01-01T00:00:00Z", center: "GSFC" }], links: [{ rel: "preview", href: "https://images-assets.nasa.gov/image/NASA_1/NASA_1~thumb.jpg" }] }] } });
  };
  try {
    const req = { method: "GET", headers: {}, socket: { remoteAddress: "test-media" }, query: { source: "media", q: "nebula", type: "image" } };
    const res = responseHarness();
    await handler(req, res);
    const { statusCode, body } = res.result();
    assert.equal(statusCode, 200);
    assert.equal(body.sourceName, "NASA Image and Video Library");
    assert.equal(body.data.items[0].nasaId, "NASA_1");
    assert.equal(body.data.items[0].center, "GSFC");
    assert.match(body.attribution, /NASA/);
  } finally { global.fetch = originalFetch; }
});

test("JPL Horizons vectors are parsed into bounded numeric flight records", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/ssd\.jpl\.nasa\.gov\/api\/horizons\.api/);
    assert.match(String(url), /EPHEM_TYPE=VECTORS/);
    return upstream({
      signature: { source: "NASA/JPL Horizons API", version: "1.2" },
      result: `Header\n$$SOE\n2461281.500000000, A.D. 2026-Aug-29 00:00:00.0000, 5.5E-1, 1.4E+0, 1.5E-2, -1.2E-2, 6.3E-3, 4.3E-4,\n2461282.500000000, A.D. 2026-Aug-30 00:00:00.0000, 5.4E-1, 1.41E+0, 1.6E-2, -1.25E-2, 6.2E-3, 4.2E-4,\n$$EOE\nFooter`
    });
  };
  try {
    const req = { method: "GET", headers: {}, socket: { remoteAddress: "test-horizons" }, query: { source: "horizons", target: "mars", start: "2026-08-29", end: "2026-08-30", step: "1" } };
    const res = responseHarness();
    await handler(req, res);
    const { statusCode, body } = res.result();
    assert.equal(statusCode, 200);
    assert.equal(body.sourceName, "JPL Horizons");
    assert.equal(body.dataType, "computed");
    assert.equal(body.data.target, "mars");
    assert.equal(body.data.apiVersion, "1.2");
    assert.equal(body.data.count, 2);
    assert.equal(body.data.records[0].julianDate, 2461281.5);
    assert.equal(body.data.records[0].positionAu.x, 0.55);
    assert.ok(body.data.records[0].distanceAu > 1);
    assert.ok(body.data.records[0].speedAuPerDay > 0);
  } finally { global.fetch = originalFetch; }
});

test("unsupported source and methods fail without contacting the network", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error("must not fetch"); };
  try {
    const resA = responseHarness();
    await handler({ method: "GET", headers: {}, socket: { remoteAddress: "test-invalid-a" }, query: { source: "arbitrary", url: "https://example.com" } }, resA);
    assert.equal(resA.result().statusCode, 404);
    const resB = responseHarness();
    await handler({ method: "POST", headers: {}, socket: { remoteAddress: "test-invalid-b" }, query: { source: "media" } }, resB);
    assert.equal(resB.result().statusCode, 405);
    assert.equal(calls, 0);
  } finally { global.fetch = originalFetch; }
});

test("the gateway only exposes the documented source allowlist", () => {
  assert.deepEqual([...handler._test.ALLOWED_SOURCES].sort(), ["asteroids", "earth-events", "exoplanets", "horizons", "media", "space-weather"]);
  assert.equal(handler._test.HORIZONS_TARGETS.mars, "499");
  assert.equal(handler._test.HORIZONS_TARGETS.earth, "399");
});
