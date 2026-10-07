"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), jwt = require("jsonwebtoken");
const { MemoryDb } = require("./helpers/study-room-db");
const fs = require("node:fs"), path = require("node:path");
const { handle, configuration } = require("../utils/study-together").__test;
const host = { _id:"650000000000000000000001", name:"QA Host" }, learner = { _id:"650000000000000000000002", name:"QA Learner" };
const config = configuration({LIVEKIT_URL:"wss://qa.livekit.example",LIVEKIT_API_KEY:"qa-key",LIVEKIT_API_SECRET:"qa-only-not-a-real-key"});
function setup() {
  const db=new MemoryDb(), calls=[];
  const client=Object.fromEntries(["createRoom","deleteRoom","updateRoomMetadata","updateParticipant","removeParticipant","mutePublishedTrack"].map(k=>[k,async(...args)=>{calls.push({action:k,args});return {};}]));
  client.listParticipants=async()=>[];client.getParticipant=async()=>({tracks:[{sid:"qa-track",source:2,muted:false}]});
  const call=async(action,body={},user=host,method="POST")=>{const res={status(n){this.statusCode=n;return this;},json(data){return data;}};return handle({method,query:{action,roomId:body.roomId}},res,{db,body:{action,...body},user,config,client,rateLimit:async()=>{}});};
  return {db,calls,client,call};
}
test("LiveKit readiness rejects insecure production endpoints and never supplies fake keys",()=>{
  assert.equal(configuration({}),null);
  assert.equal(configuration({NODE_ENV:"production",LIVEKIT_URL:"ws://127.0.0.1:7880",LIVEKIT_API_KEY:"qa",LIVEKIT_API_SECRET:"qa"}),null);
  assert.equal(configuration({LIVEKIT_URL:"wss://qa:secret@example.test",LIVEKIT_API_KEY:"qa",LIVEKIT_API_SECRET:"qa"}),null);
  assert.ok(configuration({LIVEKIT_URL:"ws://127.0.0.1:7880",LIVEKIT_API_KEY:"qa",LIVEKIT_API_SECRET:"qa"}));
});
test("server identity and room grants cannot be supplied by the caller",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA study",capacity:999,userId:learner._id,identity:"owner",roomAdmin:true});
  const claims=jwt.verify(r.token,config.secret,{algorithms:["HS256"]});
  assert.equal(claims.sub,"u_"+host._id);assert.equal(claims.video.room,r.room.id);assert.equal(claims.video.roomAdmin,undefined);assert.equal(claims.video.roomCreate,undefined);
  assert.ok(claims.exp<=Math.floor(Date.now()/1000)+91);assert.equal(r.room.capacity,32);
  const stored=await h.db.collection("studyTogetherRooms").findOne({_id:r.room.id});assert.notEqual(stored.codeHash,r.code);assert.equal(stored.ownerId,host._id);assert.equal(r.room.codeHash,undefined);
});
test("guests and restricted accounts cannot create or mint room access",async()=>{
  const h=setup();await assert.rejects(h.call("create",{title:"QA"},null),{statusCode:401});await assert.rejects(h.call("create",{title:"QA"},{...host,restrictedFeatures:["study-together"]}),{statusCode:403});assert.equal(h.calls.length,0);
});
test("waiting room is enforced before token issuance and only the host can admit",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA",settings:{waitingRoom:true}});
  const waiting=await h.call("join",{code:r.code},learner);assert.equal(waiting.waiting,true);assert.equal(waiting.token,undefined);
  await assert.rejects(h.call("admit",{roomId:r.room.id,userId:learner._id},learner),{statusCode:403});
  await h.call("admit",{roomId:r.room.id,userId:learner._id});
  assert.ok((await h.call("join",{roomId:r.room.id},learner)).token);
});
test("a room ID is not an invitation and room metadata is member-only",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});
  await assert.rejects(h.call("join",{roomId:r.room.id},learner),{statusCode:403});
  await assert.rejects(h.call("status",{roomId:r.room.id},learner,"GET"),{statusCode:403});
  assert.ok((await h.call("join",{code:r.code},learner)).token);
});
test("screen and microphone permissions are signed from host policy",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA",settings:{allowMicrophone:false,allowScreenShare:false}});
  const joined=await h.call("join",{code:r.code},learner),claims=jwt.verify(joined.token,config.secret,{algorithms:["HS256"]});
  assert.deepEqual(claims.video.canPublishSources,["camera"]);
});
test("rotation and kicking deny renewed access; moderation cannot target the host",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});await h.call("join",{code:r.code},learner);
  await assert.rejects(h.call("kick",{roomId:r.room.id,identity:"u_"+host._id}),{statusCode:400});
  await h.call("mute",{roomId:r.room.id,identity:"u_"+learner._id});assert.ok(h.calls.some(c=>c.action==="mutePublishedTrack"));
  await h.call("kick",{roomId:r.room.id,identity:"u_"+learner._id});await assert.rejects(h.call("join",{code:r.code},learner),{statusCode:403});
  const next=await h.call("rotate-invite",{roomId:r.room.id});assert.notEqual(next.code,r.code);await assert.rejects(h.call("join",{code:r.code},learner),{statusCode:404});
});
test("timer is host-authoritative and broadcasts through LiveKit room metadata",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});await h.call("join",{code:r.code},learner);
  await assert.rejects(h.call("timer",{roomId:r.room.id,mode:"start"},learner),{statusCode:403});
  const timer=await h.call("timer",{roomId:r.room.id,mode:"start",duration:1500});assert.equal(timer.room.timer.running,true);assert.ok(timer.room.timer.deadline>Date.now());
  assert.ok(h.calls.some(c=>c.action==="updateRoomMetadata"&&JSON.parse(c.args[1]).timer?.running));
});
test("closing denies new tokens and can be retried after a transport failure",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});h.client.deleteRoom=async()=>{throw Error("private-secret-that-must-not-escape");};
  await assert.rejects(h.call("close",{roomId:r.room.id}),e=>e.statusCode===503&&!e.message.includes("private-secret"));
  await assert.rejects(h.call("join",{code:r.code},learner),{statusCode:404});
  h.client.deleteRoom=async()=>{};assert.equal((await h.call("close",{roomId:r.room.id})).ok,true);
});
test("malformed settings are safely normalized without truthy privilege escalation",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA",settings:null});
  assert.deepEqual(r.room.settings,{waitingRoom:false,allowScreenShare:true,allowMicrophone:true,chatEnabled:true});
  const changed=await h.call("settings",{roomId:r.room.id,settings:{allowMicrophone:false,allowScreenShare:"true"}});
  assert.equal(changed.room.settings.allowMicrophone,false);assert.equal(changed.room.settings.allowScreenShare,true);
});
test("room closure during remote setup prevents token issuance",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});
  h.client.createRoom=async()=>h.db.collection("studyTogetherRooms").updateOne({_id:r.room.id},{$set:{status:"closed"}});
  await assert.rejects(h.call("join",{code:r.code},learner),{statusCode:403,code:"ROOM_ACCESS_CHANGED"});
});
test("Study Together is a lazy child route in the existing shell and has versioned runtime assets",()=>{
  const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8"),router=read("script.js"),loader=read("performance-loader.js"),worker=read("sw.js");
  assert.match(router,/id: "study-together", title: "Học cùng nhau", route: "\/learn\/study-together"/);
  assert.match(router,/window\.HHStudyTogether\?\.unmount\?\.\(\)/);
  assert.ok(loader.indexOf('value === "/learn/study-together"')<loader.indexOf('value.startsWith("/learn")'));
  for(const asset of["study-together.js?v=1","study-together.css?v=1","vendor/livekit-client-2.22.3.umd.js?v=1"]){assert.ok(loader.includes(asset));assert.ok(worker.includes(asset));}
  assert.match(read("vercel.json"),/"source": "\/api\/study-together"/);
  assert.match(read("api/modules/[moduleId]/actions.js"),/return handleStudyTogether\(req, res\)/);
  const client=read("study-together.js");assert.doesNotMatch(client,/LIVEKIT_API_KEY|LIVEKIT_API_SECRET/);assert.match(client,/hh\.studyTogether\.notes\.v1/);assert.match(client,/pub\.track\?\.stop\(\)/);
  assert.match(read("study-together.css"),/prefers-reduced-motion/);assert.match(read("study-together.css"),/forced-colors/);
});
