"use strict";

// Deliberately small DOM double: these verify lifecycle/data behavior, not browser layout or devices.
const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../tool-workspace-pro.js");
const decode = value => String(value).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function hostDouble() {
  const host = { dataset: {}, nodes: new Map(), inputs: new Map(), events: new Map(), contains: () => true,
    addEventListener(name, callback) { this.events.set(name, callback); },
    removeEventListener(name, callback) { if (this.events.get(name) === callback) this.events.delete(name); },
    querySelector(selector) {
      const name = selector.match(/^\[data-tool-input="([^"]+)"\]$/)?.[1];
      if (name) return this.inputs.get(name) || null;
      if (selector === '[data-tool-state="running"]') return this.nodes.get("[data-tool-state]")?.dataset.toolState === "running" ? this.nodes.get("[data-tool-state]") : null;
      return this.nodes.get(selector) || null;
    },
    querySelectorAll(selector) { return selector === "[data-tool-input]" ? [...this.inputs.values()] : []; }
  };
  Object.defineProperty(host, "innerHTML", { set(html) {
    this.inputs.clear(); this.nodes.clear();
    for (const match of html.matchAll(/<(input|textarea|select)\b([^>]*\bdata-tool-input="([^"]+)"[^>]*)>(?:([^]*?)<\/\1>)?/g)) {
      const [, tag, attrs, name, body = ""] = match;
      const value = tag === "textarea" ? decode(body) : tag === "select" ? decode(body.match(/<option[^>]*value="([^"]*)"/)?.[1] || "") : decode(attrs.match(/\bvalue="([^"]*)"/)?.[1] || "");
      this.inputs.set(name, { value, dataset: { toolInput: name }, type: attrs.match(/type="([^"]+)"/)?.[1], focus() {}, matches(selector) { return selector.includes(`[data-tool-input="${name}"]`) || (selector === '[data-tool-input]'); } });
    }
    for (const attr of ["data-tool-state", "data-tool-notice", "data-tool-output", "data-tool-tabs", "data-tool-save-state", "data-tool-editor", "data-tool-editor-status"]) {
      if (html.includes(attr)) this.nodes.set(`[${attr}]`, { dataset: { toolState: "idle" }, textContent: attr === "data-tool-output" ? "Chưa có kết quả." : "", innerHTML: "", className: "" });
    }
    this.nodes.set("[data-hh-tool]", {});
  } });
  return host;
}
function click(host, tool, action, extra = {}) {
  const node = { dataset: { toolAction: action, ...extra }, closest: () => node };
  return api.handleClick({ target: node, preventDefault() {} }, host, tool);
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("draft flush survives tool change and is never restored to another account", async () => {
  const host = hostDouble();
  let mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "draft-A" } }); await mounted.ready;
  host.inputs.get("source").value = "A confidential draft";
  mounted.cleanup(); await tick();
  mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "draft-B" } }); await mounted.ready;
  assert.equal(host.inputs.get("source").value, "");
  mounted.cleanup(); await tick();
  mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "draft-A" } }); await mounted.ready;
  assert.equal(host.inputs.get("source").value, "A confidential draft");
  mounted.cleanup(); await tick();
});

test("Workspace Tabs saves the current unsaved content before opening a new tab", async () => {
  const host = hostDouble(); const mounted = api.mount(host, { toolId: "workspace-tabs", currentUser: { id: "tabs-A" } }); await mounted.ready;
  const originalId = host.dataset.activeTab;
  host.inputs.get("title").value = "My original"; host.inputs.get("document").value = "Unsaved body";
  await click(host, "workspace-tabs", "new-tab");
  assert.notEqual(host.dataset.activeTab, originalId);
  const row = await api.storage.get("records", originalId, "account:tabs-A");
  assert.equal(row.title, "My original"); assert.equal(row.content, "Unsaved body");
  await click(host, "workspace-tabs", "select-tab", { recordId: originalId });
  assert.equal(host.inputs.get("document").value, "Unsaved body");
  mounted.cleanup(); await tick();
});

test("old cleanup cannot remove the new tool handlers or cancel its state", async () => {
  const host = hostDouble(); const first = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "lifecycle" } }); await first.ready;
  const second = api.mount(host, { toolId: "ai-image-prompt-generator", currentUser: { id: "lifecycle" } }); await second.ready;
  first.cleanup();
  assert.equal(host.events.size, 3);
  host.inputs.get("source").value = "A rainy cafe at night";
  await click(host, "ai-image-prompt-generator", "generate-image-prompt");
  assert.match(host.nodes.get("[data-tool-output]").textContent, /PROMPT/);
  second.cleanup(); assert.equal(host.events.size, 0); await tick();
});

test("unrecognized actions fail visibly instead of showing success", async () => {
  const host = hostDouble(); const mounted = api.mount(host, { toolId: "ai-prompt-optimizer", currentUser: { id: "bad-action" } }); await mounted.ready;
  await click(host, "ai-prompt-optimizer", "fake-action");
  assert.equal(host.nodes.get("[data-tool-state]").dataset.toolState, "error");
  assert.match(host.nodes.get("[data-tool-notice]").textContent, /chưa được hỗ trợ/);
  mounted.cleanup(); await tick();
});

test("a delayed prompt read cannot populate the same host after an account switch", async () => {
  const host = hostDouble(); let mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "race-A" } }); await mounted.ready;
  const original = api.storage.get; let release;
  api.storage.get = (store, id, owner) => id === "private-prompt" ? new Promise(resolve => { release = resolve; }) : original.call(api.storage, store, id, owner);
  try {
    const pending = click(host, "ai-prompt-library", "use-prompt", { recordId: "private-prompt" });
    await tick(); assert.equal(typeof release, "function");
    mounted.cleanup(); mounted = api.mount(host, { toolId: "ai-prompt-library", currentUser: { id: "race-B" } }); await mounted.ready;
    release({ id: "private-prompt", title: "Private A", content: "Secret A", tags: [] }); await pending;
    assert.equal(host.inputs.get("title").value, ""); assert.equal(host.inputs.get("content").value, "");
  } finally { api.storage.get = original; mounted.cleanup(); await tick(); }
});
