"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
global.HHSocialMediaCore=require("../social-media-tools-core.js");
global.HHSocialToolWorkspaces=require("../social-media-tools-workspaces.js");
global.HHSocialToolContracts=require("../social-media-tool-contracts.js");
global.HHSocialLocalEngines=require("../social-media-local-engines.js");
const core=global.HHSocialMediaCore,contracts=global.HHSocialToolContracts,engines=global.HHSocialLocalEngines;

test("Tool Contract V5 covers every catalog item and never marks provider-only tools ready",()=>{const all=contracts.catalogContracts(core.TOOL_CATALOG);assert.equal(all.length,61);assert.ok(all.every(item=>Array.isArray(item.inputs)&&item.exports.length&&item.validator==="tool-specific"));assert.equal(contracts.contractFor(core.TOOL_CATALOG.find(t=>t.id==="bio-link")).readiness.code,"local-ready");assert.equal(contracts.contractFor(core.TOOL_CATALOG.find(t=>t.id==="alt-text-checker")).readiness.code,"local-ready");assert.equal(contracts.contractFor(core.TOOL_CATALOG.find(t=>t.id==="analytics")).readiness.operational,false);});

test("priority local engines validate, transform, apply back and export deterministic data",()=>{const p={...core.defaultProject({}),caption:"  Xin   CHÀO #HH hh #video  ",altText:"Ảnh của một người đẹp",blockedHashtags:"video",canonicalUrl:"https://hoang8.com/",utmSource:"facebook",utmMedium:"social",utmCampaign:"mua he",socialProvider:"instagram",textMode:"upper"};const alt=engines.altText(p);assert.ok(alt.score<100);assert.ok(alt.issues.some(i=>i.code==="redundant-prefix"));const counter=engines.characterCounter(p);assert.ok(counter.rows.some(row=>row.platform==="x"&&row.limit===280));assert.match(counter.csv,/platform/);assert.equal(engines.caseConverter(p).apply.caption,p.caption.toLocaleUpperCase("vi"));assert.equal(engines.whitespace(p).apply.caption,"Xin CHÀO #HH hh #video");const tags=engines.hashtag(p);assert.deepEqual(tags.allowed,["HH"]);assert.match(tags.csv,/blocked/);assert.match(engines.link(p,"utm-builder").output,/utm_campaign=mua-he/);});

test("contracts expose honest provider review states",()=>{const tiktokTool=core.TOOL_CATALOG.find(t=>t.id==="publishing-queue");const connected={providers:{tiktok:{configured:true,connected:true,audited:false}},provider:"tiktok"};assert.equal(contracts.readiness(tiktokTool,connected).code,"review-needed");const audited={providers:{tiktok:{configured:true,connected:true,audited:true}},provider:"tiktok"};assert.equal(contracts.readiness(tiktokTool,audited).code,"connected");});
