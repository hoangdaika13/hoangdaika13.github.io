const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-state-machine.js"), "utf8");
const engine = require("../graphic-design-state-machine.js");

test("State Machine exposes a standalone mount and unmount API", () => {
  assert.equal(engine.VERSION, 1);
  assert.equal(engine.FORMAT, "hh-graphic-state-machine");
  assert.equal(engine.STORAGE_KEY, "hh.graphic-state-machine.project.v1");
  assert.equal(typeof engine.mount, "function");
  assert.equal(typeof engine.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicStateMachine = api/);
  assert.match(source, /\[data-graphic-state-machine\]/);
  assert.match(source, /mounted\.delete\(root\)/);
});

test("Default graph contains six production states and complete event types", () => {
  const project = engine.createDefaultProject();
  assert.deepEqual(project.states.map((state) => state.name), ["Idle", "Hover", "Pressed", "Loading", "Success", "Error"]);
  assert.deepEqual(engine.EVENTS, ["click", "hover", "drag", "scroll", "keyboard", "timer"]);
  assert.ok(project.transitions.length >= 7);
  assert.ok(project.properties.some((item) => item.type === "trigger"));
  assert.ok(project.bindings.some((item) => item.direction === "source"));
});

test("Condition evaluator handles boolean, number, string and trigger deterministically", () => {
  const values = { enabled: true, progress: 72, label: "Xin chào HH", submit: true };
  assert.equal(engine.evaluateCondition({ type: "boolean", property: "enabled", operator: "equals", value: true }, values), true);
  assert.equal(engine.evaluateCondition({ type: "number", property: "progress", operator: "greater-equal", value: 70 }, values), true);
  assert.equal(engine.evaluateCondition({ type: "string", property: "label", operator: "contains", value: "HH" }, values), true);
  assert.equal(engine.evaluateCondition({ type: "trigger", property: "submit", operator: "triggered", value: true }, values), true);
  assert.equal(engine.evaluateCondition({ type: "number", property: "progress", operator: "less", value: 5 }, values), false);
});

test("Transition selection is stable by priority and id", () => {
  const project = engine.createDefaultProject();
  project.transitions.push(
    { id: "z-low", from: "idle", to: "error", event: "click", priority: 1, conditions: [], actions: [] },
    { id: "b-high", from: "idle", to: "success", event: "click", priority: 50, conditions: [], actions: [] },
    { id: "a-high", from: "idle", to: "hover", event: "click", priority: 50, conditions: [], actions: [] }
  );
  const picked = engine.selectTransition(project, "idle", "click", { enabled: true }, {});
  assert.equal(picked.id, "a-high");
  assert.equal(picked.to, "hover");
});

test("Simulator applies actions, records history and resets", () => {
  const project = engine.createDefaultProject();
  const simulator = engine.createSimulator(project);
  assert.equal(simulator.getState().stateId, "idle");
  assert.equal(simulator.dispatch("hover").runtime.stateId, "hover");
  assert.equal(simulator.dispatch("click").runtime.stateId, "pressed");
  assert.equal(simulator.dispatch("timer").runtime.stateId, "loading");
  const result = simulator.dispatch("timer");
  assert.equal(result.runtime.stateId, "success");
  assert.equal(result.runtime.properties.label, "Hoàn tất");
  assert.equal(result.runtime.history.length, 4);
  assert.equal(simulator.reset().history.length, 0);
});

test("Normalizer bounds coordinates, strips unsafe text and repairs references", () => {
  const project = engine.normalizeProject({
    meta: { name: "<script>alert(1)</script> Dự án" },
    states: [{ id: "bad id", name: "<b>Idle</b>", x: -500, y: 50000, color: "javascript:red" }],
    properties: [{ id: "p", name: "bad name", type: "oops", value: "<img>Text" }],
    transitions: [{ id: "t", from: "missing", to: "missing", event: "evil", conditions: [] }],
    bindings: [{ id: "b", property: "missing", target: "evil", selector: "<script>x</script>", direction: "evil", converter: "evil" }]
  });
  assert.equal(project.meta.name, "alert(1) Dự án");
  assert.equal(project.states[0].id, "bad-id");
  assert.equal(project.states[0].name, "Idle");
  assert.equal(project.states[0].x, 0);
  assert.equal(project.states[0].y, 1000);
  assert.equal(project.states[0].color, "#67e8f9");
  assert.equal(project.properties[0].name, "bad-name");
  assert.equal(project.properties[0].type, "string");
  assert.equal(project.transitions[0].from, project.states[0].id);
  assert.equal(project.transitions[0].event, "click");
  assert.equal(project.bindings[0].target, "text");
  assert.equal(project.bindings[0].direction, "source");
});

test("Project and Web Component exports are executable, safe and expose a real API", () => {
  const project = engine.createDefaultProject();
  project.meta.name = "Demo </script><script>alert(1)</script>";
  const json = JSON.parse(engine.exportProject(project));
  const html = engine.exportWebComponent(project);
  assert.equal(json.format, engine.FORMAT);
  assert.match(html, /class HHInteraction extends HTMLElement/);
  assert.match(html, /trigger\(eventName/);
  assert.match(html, /setProperty\(name,value\)/);
  assert.match(html, /getProperty\(name\)/);
  assert.match(html, /getState\(\)/);
  assert.match(html, /reset\(\)/);
  assert.match(html, /hh-state-change/);
  assert.match(html, /scheduleTimer\(\)/);
  assert.match(html, /applyBindings\(\)/);
  assert.match(html, /binding\.direction!=="target"/);
  assert.match(html, /button\.textContent=label/);
  assert.match(html, /catch\(_\)\{return;\}/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /Demo alert\(1\)/);
});

test("Workspace implements graph, conditions, bindings, simulator and file interactions", () => {
  for (const marker of [
    "data-sm-board", "data-sm-node", "pointerdown", "pointermove", "data-sm-connect", "data-sm-transition",
    "data-sm-condition-property", "data-sm-condition-operator", "data-sm-dispatch", "data-sm-history",
    "data-sm-property-list", "data-sm-binding-list", "data-sm-sample-data", "data-sm-file", "FileReader",
    "data-sm-binding-property", "data-sm-binding-target", "data-sm-binding-direction", "data-sm-binding-converter",
    "data-sm-copy-component", "data-sm-download-component", "localStorage", "aria-live=\"polite\"",
    "@media(max-width:820px)", "prefers-reduced-motion:reduce"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
});

test("Data Binding supports every requested target, direction and converter", () => {
  for (const target of ["text", "color", "position", "image", "state"]) assert.ok(engine.BINDING_TARGETS.includes(target));
  for (const direction of ["source", "target", "bidirectional"]) assert.ok(engine.BINDING_DIRECTIONS.includes(direction));
  for (const converter of ["none", "uppercase", "lowercase", "number", "boolean", "hex-color", "px", "url"]) assert.ok(engine.CONVERTERS.includes(converter));
});
