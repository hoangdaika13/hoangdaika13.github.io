"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("parse5");

const root = path.resolve(__dirname, "..");
const page = parse(fs.readFileSync(path.join(root, "index.html"), "utf8"));
const attr = (node, key) => node.attrs?.find(attribute => attribute.name === key)?.value;

function descendants(node) {
  return [node, ...(node.childNodes || []).flatMap(descendants)];
}

const active = descendants(page); // Template fragments are separate, inert document trees.
const gate = active.find(node => attr(node, "id") === "authGate");
const find = (nodes, key, value) => nodes.find(node => attr(node, key) === value);

test("the live login owns one spiral canvas and only opens the previous galaxy on demand", () => {
  const live = descendants(gate);
  assert.equal(live.filter(node => node.tagName === "canvas").length, 1);
  assert.ok(find(live, "class", "spiral-view"));
  assert.ok(find(live, "data-spiral-motion", ""));
  assert.ok(find(live, "data-spiral-explore", ""));
  assert.ok(live.some(node => node.tagName === "dialog"));
  assert.ok(!live.some(node => node.tagName === "iframe" || attr(node, "data-hh-galaxy") !== undefined));
  assert.ok(!active.some(node => /auth-(?:neon-gateway|living-galaxy-3d|h-galaxy|solar-secret)\./.test(attr(node, "src") || attr(node, "href") || "")));
  const template = find(active, "id", "spiral-atlas-template");
  assert.equal(descendants(template.content).filter(node => attr(node, "data-hh-planet") !== undefined).length, 25);
});

test("the spiral uses the existing account forms, controls and inline errors", () => {
  const live = descendants(gate);
  for (const name of ["login", "register"]) {
    const tab = find(live, "data-auth-tab", name);
    const form = find(live, "data-auth-panel", name);
    assert.equal(attr(tab, "aria-controls"), attr(form, "id"));
    assert.equal(form.tagName, "form");
    for (const field of descendants(form).filter(node => node.tagName === "input")) {
      for (const id of (attr(field, "aria-describedby") || "").split(/\s+/).filter(Boolean)) {
        assert.ok(find(live, "id", id), "missing accessible description " + id);
      }
    }
  }
  for (const key of ["data-auth-guest", "data-forgot-panel", "data-email-verify-panel", "data-auth-privacy"]) {
    assert.ok(find(live, key, ""), key);
  }
});

test("the shipped worker installs the same spiral assets as the shell and a real WebP fallback", () => {
  const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const core = worker.match(/const CORE = \[([\s\S]*?)\];/)[1];
  for (const key of ["src", "href"]) {
    const node = active.find(item => /^auth-spiral\.(js|css)\?v=\d+$/.test(attr(item, key) || ""));
    const url = attr(node, key);
    assert.ok(core.includes('"./' + url + '"'), url);
  }
  const poster = "assets/brand/hh-spiral-galaxy.webp";
  assert.ok(core.includes('"./' + poster + '"'));
  const bytes = fs.readFileSync(path.join(root, poster));
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
});
