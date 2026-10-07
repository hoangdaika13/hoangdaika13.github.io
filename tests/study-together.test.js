"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), jwt = require("jsonwebtoken");
const { MemoryDb } = require("./helpers/study-room-db");
const fs = require("node:fs"), path = require("node:path");
const { handle, configuration, guestSecret, readGuestSession } = require("../utils/study-together").__test;
const host = { _id:"650000000000000000000001", name:"QA Host" }, learner = { _id:"650000000000000000000002", name:"QA Learner" };
const config = configuration({LIVEKIT_URL:"wss://qa.livekit.example",LIVEKIT_API_KEY:"qa-key",LIVEKIT_API_SECRET:"qa-only-not-a-real-key"});
function setup() {
  const db=new MemoryDb(), calls=[];
  const client=Object.fromEntries(["createRoom","deleteRoom","updateRoomMetadata","updateParticipant","removeParticipant","mutePublishedTrack"].map(k=>[k,async(...args)=>{calls.push({action:k,args});return {};}]));
  client.listParticipants=async()=>[];client.getParticipant=async()=>({tracks:[{sid:"qa-track",source:2,muted:false}]});
  const rateCalls=[];
  const call=async(action,body={},user=host,method="POST",headers={})=>{const res={status(n){this.statusCode=n;return this;},json(data){return data;}};return handle({method,headers,query:{action,roomId:body.roomId}},res,{db,body:{action,...body},user,config,client,rateLimit:async(...args)=>rateCalls.push(args)});};
  return {db,calls,client,call,rateCalls};
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
  assert.deepEqual(r.room.settings,{waitingRoom:false,allowScreenShare:true,allowMicrophone:true,chatEnabled:true,allowGuests:true,guestApproval:true});
  const changed=await h.call("settings",{roomId:r.room.id,settings:{allowMicrophone:false,allowScreenShare:"true"}});
  assert.equal(changed.room.settings.allowMicrophone,false);assert.equal(changed.room.settings.allowScreenShare,true);
});
test("guest invitation creates a random signed room-scoped identity and requires approval by default",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});
  const g=await h.call("join",{code:r.code,displayName:"QA Guest",userId:host._id,role:"host",identity:"u_"+host._id},null);
  assert.equal(g.waiting,true);assert.equal(g.room.host,false);assert.equal(g.token,undefined);assert.match(g.guestSession.id,/^g_[a-f0-9]{32}$/);
  const actor=readGuestSession(g.guestSession.token,config);assert.equal(actor._roomId,r.room.id);assert.equal(actor.name,"QA Guest");
  assert.throws(()=>jwt.verify(g.guestSession.token,config.secret),/signature/);
  await h.call("admit",{roomId:r.room.id,userId:g.guestSession.id});
  const joined=await h.call("join",{roomId:r.room.id},null,"POST",{authorization:"Bearer "+g.guestSession.token});
  const claims=jwt.verify(joined.token,config.secret);assert.equal(claims.sub,g.guestSession.id);assert.equal(JSON.parse(claims.metadata).role,"guest");assert.equal(claims.video.roomAdmin,undefined);assert.equal(claims.video.canUpdateOwnMetadata,false);
});
test("guest bootstrap is invite-only and rate-limited without persisting raw IP",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});
  await assert.rejects(h.call("join",{roomId:r.room.id,displayName:"QA"},null),{code:"INVITE_REQUIRED"});
  await assert.rejects(h.call("join",{code:r.code},null),{code:"GUEST_NAME_REQUIRED"});
  await h.call("join",{code:r.code,displayName:"QA"},null,"POST",{"x-forwarded-for":"192.0.2.123"});
  assert.ok(h.rateCalls.some(c=>String(c[1]).startsWith("study:guest-bootstrap:")&&c[2]===60&&c[3]===600000));assert.ok(h.rateCalls.every(c=>!String(c[1]).includes("192.0.2.123")));
});
test("guest approval may be disabled explicitly but receiving new guests may also be disabled",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA",settings:{guestApproval:false,allowScreenShare:false}});
  const g=await h.call("join",{code:r.code,displayName:"QA"},null);assert.ok(g.token);assert.equal(g.waiting,undefined);
  assert.deepEqual(jwt.verify(g.token,config.secret).video.canPublishSources,["camera","microphone"]);
  await h.call("settings",{roomId:r.room.id,settings:{allowGuests:false}});
  await assert.rejects(h.call("join",{code:r.code,displayName:"QA2"},null),{code:"GUESTS_DISABLED"});
  await assert.rejects(h.call("join",{roomId:r.room.id},null,"POST",{authorization:"Bearer "+g.guestSession.token}),{code:"GUESTS_DISABLED"});
});
test("guest session cannot read other rooms or exercise host/account controls",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA",settings:{guestApproval:false}}),other=await h.call("create",{title:"Other"});
  const g=await h.call("join",{code:r.code,displayName:"QA"},null),headers={authorization:"Bearer "+g.guestSession.token};
  for(const action of["timer","settings","close","kick","admit","rotate-invite"])await assert.rejects(h.call(action,{roomId:r.room.id,mode:"start",ownerId:g.guestSession.id},null,"POST",headers),{statusCode:403});
  await assert.rejects(h.call("rooms",{},null,"GET",headers),{statusCode:403});
  await assert.rejects(h.call("status",{roomId:other.room.id},null,"GET",headers),{code:"GUEST_ROOM_SCOPE"});
  await assert.rejects(h.call("join",{code:other.code},null,"POST",headers),{code:"GUEST_ROOM_SCOPE"});
});
test("invalid, expired and RTC-only tokens never downgrade to a new guest",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA",settings:{guestApproval:false}});
  const expired=jwt.sign({guest:true,roomId:r.room.id,name:"QA",exp:Math.floor(Date.now()/1000)-60},guestSecret(config),{issuer:"hh-study-guest",audience:"hh-study-together-api",subject:"g_"+"1".repeat(32)});
  for(const token of["invalid",expired,r.token])await assert.rejects(h.call("join",{code:r.code,displayName:"QA"},null,"POST",{authorization:"Bearer "+token}),{code:"GUEST_SESSION_INVALID"});
});
test("host can kick a guest and its same signed session cannot rejoin; closed invites cannot mint sessions",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA",settings:{guestApproval:false}}),g=await h.call("join",{code:r.code,displayName:"QA"},null);
  await h.call("kick",{roomId:r.room.id,identity:g.guestSession.id});
  await assert.rejects(h.call("join",{code:r.code},null,"POST",{authorization:"Bearer "+g.guestSession.token}),{code:"ROOM_BLOCKED"});
  await h.call("close",{roomId:r.room.id});await assert.rejects(h.call("join",{code:r.code,displayName:"New"},null),{statusCode:404});
});
test("old room formats receive safe guest defaults without mutating their stored format",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});
  await h.db.collection("studyTogetherRooms").updateOne({_id:r.room.id},{$set:{settings:{waitingRoom:false,allowMicrophone:true,allowScreenShare:true,chatEnabled:true}}});
  const g=await h.call("join",{code:r.code,displayName:"QA"},null);assert.equal(g.waiting,true);assert.equal(g.room.settings.guestApproval,true);
  const stored=await h.db.collection("studyTogetherRooms").findOne({_id:r.room.id});assert.equal(stored.settings.allowGuests,undefined);
});
test("guest bootstrap cannot keep expanding an already full waiting queue",async()=>{
  const h=setup(),r=await h.call("create",{title:"QA"});
  for(let i=0;i<50;i++)await h.db.collection("studyTogetherMembers").insertOne({_id:r.room.id+":queued-"+i,roomId:r.room.id,state:"waiting"});
  await assert.rejects(h.call("join",{code:r.code,displayName:"QA"},null),{statusCode:409,code:"WAITING_ROOM_FULL"});
});
test("guest session identity is not locally persisted across accounts and invitation codes stay in the fragment",()=>{
  const client=fs.readFileSync(path.join(__dirname,"../study-together.js"),"utf8");
  assert.match(client,/sessionStorage\.setItem\(guestKey/);assert.doesNotMatch(client,/localStorage\.setItem\(guestKey/);
  assert.match(client,/#\/learn\/study-together\?invite=/);assert.match(client,/user\?\.id&&!user\.guest/);
  const auth=fs.readFileSync(path.join(__dirname,"../auth-platform.js"),"utf8"),source=auth.match(/  const studyInviteRoute = \(\) => \{[\s\S]*?\n  \};/)[0];
  const vm=require("node:vm");for(const[hash,expected]of[["#/platform",""],["#/admin?invite=0123456789abcdef",""],["#/learn/study-together?invite=invalid",""],["#/learn/study-together?invite=0123456789abcdef","#/learn/study-together?invite=0123456789ABCDEF"]]){const ctx={location:{hash},URLSearchParams};vm.runInNewContext(source+";result=studyInviteRoute();",ctx);assert.equal(ctx.result,expected);}
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
  for(const asset of["study-together.js?v=2","study-together.css?v=2","vendor/livekit-client-2.22.3.umd.js?v=1","vendor/qrcode.js?v=1"]){assert.ok(loader.includes(asset));assert.ok(worker.includes(asset));}
  assert.match(read("vercel.json"),/"source": "\/api\/study-together"/);
  assert.match(read("api/modules/[moduleId]/actions.js"),/return handleStudyTogether\(req, res\)/);
  const client=read("study-together.js");assert.doesNotMatch(client,/LIVEKIT_API_KEY|LIVEKIT_API_SECRET/);assert.match(client,/hh\.studyTogether\.notes\.v1/);assert.match(client,/pub\.track\?\.stop\(\)/);
  assert.match(read("study-together.css"),/prefers-reduced-motion/);assert.match(read("study-together.css"),/forced-colors/);
});
