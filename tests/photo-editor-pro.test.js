"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "photo-editor-pro.js"), "utf8");

function api() {
  const context = { globalThis: {}, console, JSON, Date, Math };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.globalThis.HHPhotoEditorPro;
}

test("Photo Editor Pro exposes a standalone local project engine", () => {
  const engine = api();
  assert.equal(typeof engine.createProject, "function");
  const project = engine.createProject({ name: "Poster" });
  assert.equal(project.format, "HH Media Project");
  assert.equal(project.layers.length, 1);
  assert.equal(project.artboards.length, 1);
  assert.equal(project.capabilities.cloudAI, false);
});

test("project engine provides non-destructive layer primitives", () => {
  const engine = api();
  const project = engine.createProject();
  const group = engine.defaultLayer("group", "Nhóm ảnh");
  const adjustment = engine.defaultLayer("adjustment", "Curves");
  const smart = engine.defaultLayer("smart", "Logo");
  project.layers.push(group, adjustment, smart);
  const normalized = engine.normalizeProject(project);
  assert.equal(normalized.layers.find((layer) => layer.id === group.id).kind, "group");
  assert.equal(normalized.layers.find((layer) => layer.id === adjustment.id).adjustment.type, "curves");
  assert.equal(normalized.layers.find((layer) => layer.id === smart.id).smartFilters.length, 0);
});

test("normalization bounds hostile project input", () => {
  const engine = api();
  const project = engine.normalizeProject({
    layers: Array.from({ length: 230 }, (_, index) => ({ id: `layer-${index}`, kind: "smart", smartFilters: Array.from({ length: 40 }, () => ({ type: "Blur" })) })),
    batch: Array.from({ length: 120 }, () => ({ name: "Job" }))
  });
  assert.equal(project.layers.length, 200);
  assert.equal(project.batch.length, 100);
  assert.equal(project.layers[0].smartFilters.length, 30);
});

test("storage projection strips unsafe local media sources", () => {
  const engine = api();
  const project = engine.createProject();
  project.layers[0].source = "file:///private/source.png";
  const safe = engine.projectForStorage(project);
  assert.equal(safe.layers[0].source, null);
  project.layers[0].source = "https://cdn.example.com/source.png";
  assert.equal(engine.projectForStorage(project).layers[0].source, "https://cdn.example.com/source.png");
});

test("source contains bounded history and no client-side provider key", () => {
  assert.match(source, /const HISTORY_LIMIT = 36/);
  assert.match(source, /cloudAI: false/);
  assert.doesNotMatch(source, /AIza|GEMINI_API_KEY|OPENAI_API_KEY/);
});
