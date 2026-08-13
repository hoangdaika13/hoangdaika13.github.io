"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
global.HHSocialMediaCore=require("../social-media-tools-core.js");
const engines=require("../social-media-communication-engines.js");

const base={title:"Ra mắt HH",objective:"Tăng đăng ký đủ điều kiện",audience:"Nhà sáng tạo Việt Nam 18–35 tuổi",offer:"Workspace truyền thông hợp nhất",evidence:"Kết quả thử nghiệm nội bộ có nhật ký",tone:"Tin cậy, rõ ràng",channels:"Facebook, TikTok, YouTube",constraints:"Không cường điệu",caption:"Nội dung chiến dịch cần kiểm tra",stakeholder:"Trưởng truyền thông",deadline:"2026-09-30",hypothesis:"Hook có bằng chứng tăng CTR",primaryMetric:"Qualified signup",baseline:4,targetValue:2,budget:10000000,revenue:17000000,variantCount:4};

test("V7 registers exactly 24 explicit communication processors",()=>{assert.equal(engines.VERSION,1);assert.equal(Object.keys(engines.PROCESSORS).length,24);for(const [id,processor] of Object.entries(engines.PROCESSORS)){assert.equal(typeof processor,"function");assert.ok(engines.engineFor(id));}});

test("every communication button target produces reusable output and real downloads",()=>{for(const id of Object.keys(engines.PROCESSORS)){const p={...base};if(id==="press-kit-checklist")p.caption="Thông cáo đã duyệt\nLogo vector";const r=engines.run(id,p);assert.equal(r.toolId,id);assert.ok(r.output.length>10,`${id} output`);assert.ok(r.validation.valid);assert.ok(r.exports.txt);assert.doesNotThrow(()=>JSON.parse(r.exports.json));assert.equal(typeof r.apply,"object");}});

test("ROI calculator computes ROI ROAS and CPA instead of placeholder values",()=>{const r=engines.run("roi-calculator",base);assert.equal(r.data.profit,7000000);assert.equal(r.data.roi,70);assert.equal(r.data.roas,1.7);assert.equal(r.data.cpa,5000000);assert.match(r.output,/ROI: 70%/);assert.ok(r.exports.csv);});

test("safety, claims, sentiment and crisis workflows return actionable review gates",()=>{const safety=engines.run("brand-safety-audit",{...base,caption:"Cam kết 100% chỉ hôm nay"});assert.ok(safety.data.hits.length>=2);const claims=engines.run("claim-compliance-checker",{...base,caption:"Tốt nhất, tăng 90% và chữa mọi vấn đề"});assert.ok(claims.data.claims.length>=3);const triage=engines.run("sentiment-triage",{...base,caption:"Tôi sẽ khiếu nại báo chí vì lỗi này"});assert.equal(triage.data.priority,"urgent");assert.equal(triage.data.autoReply,false);const crisis=engines.run("crisis-response-builder",base);assert.equal(crisis.data.approvalRequired,undefined);assert.ok(crisis.validation.warnings.some(x=>x.code==="crisis-review"));});

test("engines fail closed when required input is missing",()=>{assert.throws(()=>engines.run("content-strategy-brief",{}),/không được để trống/);assert.throws(()=>engines.run("roi-calculator",{budget:0}),/lớn hơn 0/);assert.throws(()=>engines.run("not-real",base),/Không có Communication Engine/);});
