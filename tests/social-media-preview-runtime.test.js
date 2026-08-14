"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const runtime = require("../social-media-preview-runtime.js");

function harness(hidden = false) {
  let nextId = 1;
  let clock = 0;
  const frames = new Map();
  const listeners = new Map();
  const document = {
    hidden,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); }
  };
  return {
    document,
    now:() => clock,
    raf(callback) { const id=nextId++;frames.set(id,callback);return id; },
    caf(id) { frames.delete(id); },
    run(time) { clock=time;const [id,callback]=frames.entries().next().value||[];if(!callback)return false;frames.delete(id);callback(time);return true; },
    size:() => frames.size,
    visibility(value) { document.hidden=value;listeners.get("visibilitychange")?.(); }
  };
}

test("preview coalesces rapid edits into the next animation frame", () => {
  const h=harness(),renders=[],metrics=[];
  const controller=runtime.create({document:h.document,raf:h.raf,caf:h.caf,now:h.now,render:(value)=>renders.push(value),onMetrics:(value)=>metrics.push(value)});
  controller.schedule({caption:"a"});
  controller.schedule({caption:"ab"});
  controller.schedule({caption:"abc"});
  assert.equal(h.size(),1);
  h.run(12);
  assert.deepEqual(renders,[{caption:"abc"}]);
  assert.equal(controller.metrics().droppedUpdates,2);
  h.run(100);
  h.run(820);
  assert.ok(controller.metrics().fps>0);
  controller.destroy();
  assert.equal(h.size(),0);
  assert.ok(metrics.length>=2);
});

test("preview pauses while the tab is hidden and resumes with the latest value", () => {
  const h=harness(true),renders=[];
  const controller=runtime.create({document:h.document,raf:h.raf,caf:h.caf,now:h.now,render:(value)=>renders.push(value)});
  controller.schedule("first");
  controller.schedule("latest");
  assert.equal(h.size(),0);
  h.visibility(false);
  assert.equal(h.size(),1);
  h.run(16);
  assert.deepEqual(renders,["latest"]);
  h.visibility(true);
  assert.equal(controller.metrics().paused,true);
  controller.destroy();
});

test("flush renders pending content immediately", () => {
  const h=harness(),renders=[];
  const controller=runtime.create({document:h.document,raf:h.raf,caf:h.caf,now:h.now,render:(value)=>renders.push(value)});
  controller.schedule("ready");
  assert.equal(controller.flush(),true);
  assert.deepEqual(renders,["ready"]);
  assert.equal(controller.flush(),false);
  controller.destroy();
});
