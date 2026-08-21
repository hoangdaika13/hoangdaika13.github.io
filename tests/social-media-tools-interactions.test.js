"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const core=require("../social-media-tools-core.js");
const interactions=require("../social-media-interactions.js");

test("interaction registry has no duplicate catalog ids and covers interactive families",()=>{
  const audit=interactions.validateCatalog(core.TOOL_CATALOG);
  assert.deepEqual(audit.duplicate,[]);
  assert.equal(core.TOOL_CATALOG.length,85);
  assert.ok(audit.covered>=12);
  assert.ok(interactions.controlsFor("case-converter").includes("case-mode"));
  assert.ok(interactions.controlsFor("emoji-picker").includes("emoji-insert"));
  assert.ok(interactions.controlsFor("publishing-queue").includes("queue-action"));
});

test("platform families expose interaction contracts instead of decorative-only controls",()=>{
  for(const id of ["instagram-post","x-composer","threads-composer","whatsapp-mockup","imessage-mockup","profile-picture","brand-kit"]){
    assert.ok(interactions.controlsFor(id).length>0,id);
  }
});
