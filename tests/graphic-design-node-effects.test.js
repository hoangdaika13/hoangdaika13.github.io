const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const effects = require("../graphic-design-node-effects.js");

test("starter graph contains every supported effect node in a valid DAG", () => {
  const graph = effects.createDefaultGraph();
  assert.equal(graph.format, effects.FORMAT);
  assert.equal(graph.version, effects.VERSION);
  assert.deepEqual(new Set(graph.nodes.map((node) => node.type)), new Set([
    "Source", "Blur", "Glow", "Shadow", "Distortion", "Color", "Mask", "Blend", "Output"
  ]));
  assert.equal(graph.connections.length, 9);
  assert.deepEqual(effects.validateGraph(graph), { valid: true, errors: [], warnings: [] });
});

test("normalizer bounds imported data, sanitizes user text, and removes unsafe links", () => {
  const graph = effects.normalizeGraph({
    format: effects.FORMAT,
    meta: { name: '<img src=x onerror="globalThis.pwned=1">My graph' },
    preview: { width: 99999, height: -10 },
    nodes: [
      { id: "<source>", type: "Source", name: "<script>bad()</script> Local", x: -40, params: { text: "<b>Hello</b>", imageData: "javascript:alert(1)" } },
      { id: "blur", type: "Blur", name: '<svg onload="bad()">Blur</svg>', params: { radius: 999 } },
      { id: "glow", type: "Glow", params: { opacity: -4, color: "url(evil)" } },
      { id: "output", type: "Output", params: { background: "javascript:red" } }
    ],
    connections: [
      { id: "one", from: "<source>", to: "blur", input: 0 },
      { id: "two", from: "blur", to: "glow", input: 0 },
      { id: "cycle", from: "glow", to: "blur", input: 0 },
      { id: "dangling", from: "missing", to: "output", input: 0 },
      { id: "three", from: "glow", to: "output", input: 0 }
    ],
    groups: [{ id: "team", name: "<b>Unsafe group</b>", nodeIds: ["blur", "missing"] }]
  });

  assert.equal(graph.meta.name, "My graph");
  assert.equal(graph.preview.width, 1920);
  assert.equal(graph.preview.height, 180);
  assert.equal(graph.nodes[0].id, "source");
  assert.equal(graph.nodes[0].name, "bad() Local");
  assert.equal(graph.nodes[0].params.text, "Hello");
  assert.equal(graph.nodes[0].params.imageData, "");
  assert.equal(graph.nodes[1].params.radius, 36);
  assert.equal(graph.nodes[2].params.opacity, 0);
  assert.equal(graph.connections.some((link) => link.id === "cycle"), false);
  assert.equal(graph.connections.some((link) => link.id === "dangling"), false);
  assert.deepEqual(graph.groups[0].nodeIds, ["blur"]);
  assert.equal(graph.groups[0].name, "Unsafe group");
  assert.doesNotMatch(effects.serializeGraph(graph), /onerror|javascript:|<script/i);
});

test("graph operations connect ports, reject cycles, and preserve immutable input", () => {
  const original = effects.createDefaultGraph();
  const originalJson = JSON.stringify(original);
  const connected = effects.connectNodes(original, "source", "color", 0);
  const colorInputs = connected.connections.filter((link) => link.to === "color" && link.input === 0);

  assert.equal(colorInputs.length, 1);
  assert.equal(colorInputs[0].from, "source");
  assert.equal(JSON.stringify(original), originalJson);
  assert.throws(() => effects.connectNodes(original, "color", "blur", 0), /cycle/i);
  assert.throws(() => effects.connectNodes(original, "output", "blur", 0), /not supported/i);
  assert.throws(() => effects.connectNodes(original, "source", "source", 0), /not supported/i);
});

test("nodes can be added, reordered, toggled, grouped, ungrouped, and removed", () => {
  const original = effects.createDefaultGraph();
  let graph = effects.addNode(original, "Glow", { id: "extra-glow", name: "Accent glow" });
  assert.equal(graph.nodes.at(-1).id, "extra-glow");

  graph = effects.reorderNode(graph, "extra-glow", 0);
  assert.equal(graph.nodes[0].id, "extra-glow");
  assert.deepEqual(graph.nodes.map((node) => node.order), graph.nodes.map((_, index) => index));

  graph = effects.toggleNode(graph, "extra-glow");
  assert.equal(graph.nodes.find((node) => node.id === "extra-glow").enabled, false);

  graph = effects.groupNodes(graph, ["extra-glow", "blur"], '<i>Hero effects</i>');
  assert.equal(graph.groups.length, 1);
  assert.equal(graph.groups[0].name, "Hero effects");
  assert.deepEqual(new Set(graph.groups[0].nodeIds), new Set(["extra-glow", "blur"]));

  graph = effects.ungroupNodes(graph, ["blur"]);
  assert.deepEqual(graph.groups[0].nodeIds, ["extra-glow"]);
  assert.equal(graph.nodes.find((node) => node.id === "blur").groupId, null);

  graph = effects.removeNode(graph, "extra-glow");
  assert.equal(graph.nodes.some((node) => node.id === "extra-glow"), false);
  assert.equal(graph.groups.length, 0);
  assert.equal(original.nodes.some((node) => node.id === "extra-glow"), false);
});

test("presets and portable export round-trip through the public API", () => {
  const graph = effects.applyPreset(effects.createDefaultGraph(), "liquid-wave");
  const distortion = graph.nodes.find((node) => node.type === "Distortion");
  assert.equal(graph.meta.name, "Liquid wave");
  assert.equal(distortion.params.amount, 18);

  const serialized = effects.serializeGraph(graph);
  const rawRoundTrip = effects.deserializeGraph(serialized);
  assert.equal(rawRoundTrip.nodes.find((node) => node.type === "Distortion").params.wavelength, 54);

  const exported = JSON.parse(effects.exportGraph(graph));
  assert.equal(exported.format, effects.FORMAT);
  assert.equal(exported.extension, ".hheffects");
  const exportRoundTrip = effects.deserializeGraph(JSON.stringify(exported));
  assert.equal(exportRoundTrip.meta.name, "Liquid wave");
  assert.throws(() => effects.deserializeGraph('{"format":"unknown"}'), /unsupported graph format/i);
  assert.throws(() => effects.applyPreset(graph, "missing"), /unknown preset/i);
});

test("HTML escaping and unsupported rendering states are explicit", () => {
  assert.equal(effects.escapeHtml('<node name="x">&\'</node>'), "&lt;node name=&quot;x&quot;&gt;&amp;&#39;&lt;/node&gt;");
  assert.deepEqual(effects.renderGraph(effects.createDefaultGraph(), null), {
    supported: false,
    reason: "Canvas2D is unavailable",
    warnings: []
  });
});

test("browser contract exposes UMD mount, local-first state, access, and responsive fallbacks", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "graphic-design-node-effects.js"), "utf8");
  for (const token of [
    "globalScope.HHGraphicNodeEffects", "module.exports", "function mount", "function unmount",
    "hh.graphic-node-effects.graph.v1", "aria-live=\"polite\"", "data-ne-connect-from",
    "data-ne-connect-start", "Canvas2D is not supported", "FileReader", "localStorage",
    "prefers-reduced-motion:reduce", "@media(max-width:390px)", "focus-visible",
    "keydown", "pointerdown", "serializeGraph", "exportGraph"
  ]) assert.ok(source.includes(token), `missing browser contract: ${token}`);
  assert.doesNotMatch(source, /<script[^>]+src=/i);
  assert.doesNotMatch(source, /https?:\/\//i);
});
