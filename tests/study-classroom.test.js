"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),jwt=require("jsonwebtoken");
const {handle,configuration}=require("../utils/study-together").__test,{MemoryDb}=require("./helpers/study-room-db"),core=require("../study-room-core");
const owner={_id:"650000000000000000000001",name:"Teacher"},member={_id:"650000000000000000000002",name:"Student"},stranger={_id:"650000000000000000000003",name:"Other"};
const config=configuration({LIVEKIT_URL:"wss://test.livekit.example",LIVEKIT_API_KEY:"qa",LIVEKIT_API_SECRET:"qa-not-production"});
function harness(){const db=new MemoryDb(),responses=[],calls=[],client={createRoom:async()=>{},updateRoomMetadata:async(...a)=>calls.push(a),listParticipants:async()=>[owner,member].map(u=>({identity:"u_"+u._id,name:u.name,tracks:[]})),updateParticipant:async(...a)=>calls.push(a),removeParticipant:async()=>{},deleteRoom:async()=>{}};
  const call=(action,body={},user=owner,method="POST")=>handle({method,headers:{},query:{action,...body}},{status(){return this;},json(d){responses.push(d);return d;}},{db,client,config,user,body:{action,...body},rateLimit:async()=>{}});return {db,client,call,responses,calls};}
test("classes are account-only, invitation-only, private, durable and stale updates conflict",async()=>{
  const h=harness();await assert.rejects(h.call("class-create",{title:"A"},null),{statusCode:401});const c=await h.call("class-create",{title:"A",description:"Math",schedule:"Thứ 3 20:00",retentionDays:90});
  assert.ok(new Date(c.class.expiresAt)-Date.now()>89*86400000);assert.equal(JSON.stringify(c.class).includes("codeHash"),false);
  assert.equal((await h.call("class-list",{},stranger)).classes.length,0);await assert.rejects(h.call("class-get",{classId:c.class.id},stranger),{statusCode:403});
  await h.call("class-join",{code:c.code},member);assert.equal((await h.call("class-list",{},member)).classes.length,1);
  await assert.rejects(h.call("class-update",{classId:c.class.id,title:"B",retentionDays:30,revision:0}),{code:"CLASS_CONFLICT"});
  await assert.rejects(h.call("class-plan",{classId:c.class.id,goal:"G",items:["T"]},member),{statusCode:403});
});
test("class sessions use real room hooks once, class plan, persistent board pages and archived summaries",async()=>{
  const h=harness(),c=await h.call("class-create",{title:"Class"}),classId=c.class.id;
  await h.call("class-plan",{classId,revision:0,goal:"Learn",items:["Task"]});const before=h.responses.length,r=await h.call("class-session",{classId});
  assert.equal(h.responses.length-before,1);assert.ok(r.token);assert.equal(r.room.classId,classId);assert.equal(r.room.agenda.goal,"Learn");
  await h.call("class-join",{code:c.code},member);const joined=await h.call("class-session",{classId,roomId:r.room.id},member);assert.ok(joined.token);assert.equal(joined.room.host,false);
  const object={id:"object_0001",kind:"note",x:10,y:10,w:200,h:100,text:"Hi",color:"#ffe3a7",size:4};
  await h.call("board",{roomId:r.room.id,batchId:"batch_0001",operations:[{type:"add",id:object.id,object}]},member);
  const board=await h.db.collection("studyTogetherBoards").findOne({_id:classId+":main"});assert.equal(board.classId,classId);assert.ok(new Date(board.expiresAt)>new Date(r.room.expiresAt));
  await h.call("board-pages",{roomId:r.room.id,title:"Second"});await h.call("close",{roomId:r.room.id});
  const history=await h.call("class-get",{classId});assert.equal(history.sessions[0].status,"closed");assert.equal(history.sessions[0].agenda.goal,"Learn");
  const next=await h.call("class-session",{classId});assert.equal((await h.call("board",{roomId:next.room.id},owner,"GET")).board.objects.length,1);assert.equal((await h.call("board-pages",{roomId:next.room.id},owner,"GET")).pages.length,2);
});
test("roles are class-scoped, server verified, update RTC grants and blocked members cannot renew access",async()=>{
  const h=harness(),c=await h.call("class-create",{title:"Class"}),classId=c.class.id;await h.call("class-join",{code:c.code},member);await assert.rejects(h.call("class-role",{classId,userId:owner._id,role:"assistant"},member),{statusCode:403});
  await h.call("class-role",{classId,userId:member._id,role:"assistant",revision:1});const r=await h.call("class-session",{classId},member);assert.ok(r.room.host);
  await h.call("class-role",{classId,userId:member._id,role:"presenter",revision:2});const j=await h.call("class-session",{classId,roomId:r.room.id},member);assert.equal(j.room.host,false);assert.equal(j.room.role,"presenter");const decoded=jwt.decode(j.token);assert.ok(decoded.video.canPublishSources.includes("screen_share"));
  await assert.rejects(h.call("timer",{roomId:r.room.id,mode:"start"},member),{statusCode:403});await h.call("class-role",{classId,userId:member._id,role:"blocked",revision:3});
  await assert.rejects(h.call("join",{roomId:r.room.id},member),{code:"CLASS_ACCESS"});await assert.rejects(h.call("class-join",{code:c.code},member),{statusCode:403});
  assert.deepEqual((await h.call("class-list",{},member)).classes,[]);assert.deepEqual((await h.call("rooms",{},member,"GET")).rooms,[]);
});
test("private documents enforce signatures, quotas, class membership, annotations and optimistic revisions",async()=>{
  const h=harness(),c=await h.call("class-create",{title:"Class"}),classId=c.class.id;
  await assert.rejects(h.call("class-upload",{classId,name:"x.svg",mimeType:"image/svg+xml",data:"PHN2Zz4="}),{statusCode:415});
  await assert.rejects(h.call("class-upload",{classId,name:"x.pdf",mimeType:"application/pdf",data:Buffer.from("bad").toString("base64")}),{code:"FILE_SIGNATURE_MISMATCH"});
  const data=Buffer.from("%PDF-1.7\nQA").toString("base64"),u=await h.call("class-upload",{classId,name:"test.pdf",mimeType:"application/pdf",data,revision:0}),documentId=u.class.documents[0].id;
  await assert.rejects(h.call("class-document",{classId,documentId},stranger),{statusCode:403});await h.call("class-join",{code:c.code},member);
  const file=await h.call("class-document",{classId,documentId},member);assert.equal(file.document.data,data);
  await h.call("class-annotate",{classId,documentId,page:1,text:"<script>literal</script>",revision:0},member);await assert.rejects(h.call("class-annotate",{classId,documentId,page:1,text:"old",revision:0},member),{code:"CLASS_CONFLICT"});
  const exported=await h.call("class-export",{classId});assert.equal(exported.export.includesFileData,false);assert.equal(exported.export.documents[0].id,documentId);assert.equal((await h.call("class-document",{classId,documentId})).document.notes[0].userId,member._id);assert.equal(JSON.stringify(exported).includes("codeHash"),false);
  await assert.rejects(h.call("class-delete",{classId,confirmTitle:"wrong"}),{statusCode:400});await h.call("class-delete",{classId,confirmTitle:"Class"});assert.equal(await h.db.collection("studyTogetherDocuments").countDocuments({classId}),0);await assert.rejects(h.call("class-get",{classId}),{statusCode:403});
});
test("breakout IDs are never enough for access; approved HH members can move only inside the same root",async()=>{
  const h=harness(),r=await h.call("create",{title:"Root"});await h.call("join",{code:r.code},member);const group=await h.call("create",{title:"Group",parentRoomId:r.room.id,settings:{allowGuests:false}});
  await assert.rejects(h.call("group-join",{roomId:r.room.id,targetId:group.room.id},stranger),{statusCode:403});
  const moved=await h.call("group-join",{roomId:r.room.id,targetId:group.room.id},member);assert.ok(moved.token);
  const other=await h.call("create",{title:"Other"});await assert.rejects(h.call("group-join",{roomId:group.room.id,targetId:other.room.id},member),{statusCode:403});assert.ok((await h.call("group-join",{roomId:group.room.id,targetId:r.room.id},member)).token);
});
test("whiteboard notes, page membership and current viewer data are bounded without changing old main boards",async()=>{
  assert.equal(core.boardObject({id:"note_0001",kind:"note",text:"N",x:0,y:0,w:200,h:100,color:"#ffffff",size:4},"u",1).kind,"note");
  const h=harness(),r=await h.call("create",{title:"Room"});await assert.rejects(h.call("board",{roomId:r.room.id,pageId:"missing"},owner,"GET"),{statusCode:404});assert.deepEqual((await h.call("board-pages",{roomId:r.room.id},owner,"GET")).pages,[{id:"main",title:"Trang 1"}]);
});
test("closed classroom sessions freeze the server clock rather than counting after everyone leaves",async()=>{
  const h=harness(),c=await h.call("class-create",{title:"Class"}),r=await h.call("class-session",{classId:c.class.id});
  await h.call("timer",{roomId:r.room.id,mode:"start",duration:60});await h.call("close",{roomId:r.room.id});
  const history=await h.call("class-get",{classId:c.class.id}),timer=history.sessions[0].timer;assert.equal(timer.running,false);assert.deepEqual(core.timerSummary(timer,Date.now()+3600000),core.timerSummary(timer,Date.now()));
});
test("role changes and class deletion report transport failures without faking SFU moderation",async()=>{
  const h=harness(),c=await h.call("class-create",{title:"Class"});await h.call("class-join",{code:c.code},member);await h.call("class-session",{classId:c.class.id});
  h.client.updateParticipant=async()=>{throw Error("network");};const changed=await h.call("class-role",{classId:c.class.id,userId:member._id,role:"presenter",revision:1});assert.equal(changed.syncPending,true);
  h.client.deleteRoom=async()=>{throw Error("network");};const deleted=await h.call("class-delete",{classId:c.class.id,confirmTitle:"Class",revision:2});assert.equal(deleted.syncPending,true);assert.equal((await h.call("class-list")).classes.length,0);
});
test("Classroom and health use local lazy PDF assets, no autodevice permissions or raw HTML from documents",()=>{
  const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
  assert.match(read("study-classroom.js"),/isEvalSupported:false/);assert.match(read("study-classroom.js"),/p\.textContent=note\.name/);assert.match(read("study-call-health.js"),/setPublishingQuality/);assert.match(read("study-call-health.js"),/stopMedia\(room\)/);assert.doesNotMatch(read("study-call-health.js"),/setMicrophoneEnabled\(true/);
  const follow=read("study-classroom.js").split("\n").find(line=>line.includes("function follow()"));assert.doesNotMatch(follow,/current=data\.class/);
});
