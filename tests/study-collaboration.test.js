"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const core=require("../study-room-core"),{handle,configuration}=require("../utils/study-together").__test,{MemoryDb}=require("./helpers/study-room-db");
const host={_id:"650000000000000000000001",name:"Host"},learner={_id:"650000000000000000000002",name:"Learner"},other={_id:"650000000000000000000003",name:"Other"};
const config=configuration({LIVEKIT_URL:"wss://qa.livekit.example",LIVEKIT_API_KEY:"qa-only",LIVEKIT_API_SECRET:"qa-only-not-production"});
function harness(){const db=new MemoryDb(),calls=[],client={createRoom:async()=>({}),updateRoomMetadata:async(...args)=>{calls.push(args);},listParticipants:async()=>[host,learner,other].map(user=>({identity:"u_"+user._id,name:user.name,tracks:[]})),deleteRoom:async()=>({}),updateParticipant:async()=>({}),removeParticipant:async()=>({})};const call=(action,body={},user=host,method="POST",headers={})=>handle({method,headers,query:{action,roomId:body.roomId}}, {status(){return this;},json:d=>d}, {db,client,config,user,body:{action,...body},rateLimit:async()=>{}});return {db,client,call,calls};}
const shape=(id="object_0001")=>({id,kind:"rect",x:10,y:20,w:100,h:60,color:"#2456ab",size:4});
const empty=()=>({revision:0,objects:[],tombstones:[],batches:[]});
test("whiteboard strips forged ownership and versions; object conflicts and member ownership are enforced",()=>{
  const board=core.applyBoard(empty(),[{type:"add",id:"object_0001",object:{...shape(),owner:"admin",version:999}}],"learner",false,"batch_0001");
  assert.equal(board.objects[0].owner,"learner");assert.equal(board.objects[0].version,1);
  assert.throws(()=>core.applyBoard(board,[{type:"update",id:"object_0001",baseVersion:1,object:shape()}],"other",false,"batch_0002"),{statusCode:403});
  assert.throws(()=>core.applyBoard(board,[{type:"update",id:"object_0001",baseVersion:0,object:shape()}],"learner",false,"batch_0002"),{statusCode:409});
  assert.equal(core.applyBoard(board,[{type:"delete",id:"object_0001",baseVersion:1}],"owner",true,"batch_0002").objects.length,0);
});
test("whiteboard idempotence, deletion tombstones and restore preserve object versions",()=>{
  let board=core.applyBoard(empty(),[{type:"add",id:"object_0001",object:shape()}],"a",false,"batch_0001");
  assert.equal(core.applyBoard(board,[{type:"add",id:"object_0001",object:shape()}],"a",false,"batch_0001").duplicate,true);
  board=core.applyBoard(board,[{type:"delete",id:"object_0001",baseVersion:1}],"a",false,"batch_0002");
  assert.equal(board.tombstones[0].version,2);
  assert.throws(()=>core.applyBoard(board,[{type:"add",id:"object_0001",baseVersion:1,object:shape()}],"a",false,"batch_0003"),{statusCode:409});
  const restored=core.applyBoard(board,[{type:"add",id:"object_0001",baseVersion:2,object:shape()}],"a",false,"batch_0003");assert.equal(restored.objects[0].version,3);assert.equal(restored.tombstones.length,0);
});
test("whiteboard bounds payloads, coordinates, colors, text, points and object count",()=>{
  for(const object of [{...shape(),color:"url(javascript:bad)"},{...shape(),x:NaN},{...shape(),w:5000},{...shape(),kind:"html"},{...shape(),kind:"text",text:"x".repeat(241)},{...shape(),kind:"stroke",points:Array.from({length:129},()=>[0,0])}])assert.throws(()=>core.boardObject(object,"a",1),{statusCode:400});
  assert.throws(()=>core.applyBoard(empty(),Array.from({length:13},()=>({})),"a",false,"batch_0001"),{statusCode:400});
  const board={...empty(),objects:Array.from({length:160},(_,i)=>core.boardObject(shape("object_"+String(i).padStart(4,"0")),"a",1))};
  assert.throws(()=>core.applyBoard(board,[{type:"add",id:"object_0160",object:shape("object_0160")}],"a",false,"batch_0001"),{code:"BOARD_FULL"});
  assert.equal(core.boardObject({...shape(),kind:"stroke",w:12.34,h:10,points:[[0,0],[12.34,10]]},"a",1).points[1][0],12.3);
});
test("conflicted local drafts can be previewed/exported without bypassing server versions or mutating snapshots",()=>{
  const board=core.applyBoard(empty(),[{type:"add",id:"object_0001",object:shape()}],"a",false,"batch_0001"),snapshot=JSON.stringify(board),draft=[{type:"update",id:"object_0001",baseVersion:0,object:{...shape(),x:200}}];
  assert.equal(core.previewBoard(board,draft,"a")[0].x,200);assert.equal(JSON.stringify(board),snapshot);assert.throws(()=>core.applyBoard(board,draft,"a",false,"batch_0002"),{code:"BOARD_CONFLICT"});assert.equal(core.previewBoard(board,draft,"other")[0].x,10);
});
test("polls accept one actual vote per identity, retry idempotently and never expose voter records",()=>{
  const poll=core.newPoll("Question",["A","B"],"poll-id"),voted=core.votePoll(poll,"a",0,"poll-id");
  assert.equal(core.publicPoll(voted,"a").myVote,0);assert.equal(core.publicPoll(voted).total,1);assert.equal(JSON.stringify(core.publicPoll(voted)).includes('"voter"'),false);
  assert.equal(core.votePoll(voted,"a",0,"poll-id").duplicate,true);assert.throws(()=>core.votePoll(voted,"a",1,"poll-id"),{code:"ALREADY_VOTED"});
  assert.throws(()=>core.votePoll({...voted,closed:true},"b",1,"poll-id"),{code:"POLL_CLOSED"});
  for(const options of[["A"],[" A ","A"],["x".repeat(101),"B"],[{},"B"]])assert.throws(()=>core.newPoll("Q",options,"id"),{statusCode:400});
});
test("session clock summaries count intervals once across pause, resume, phase change and expiry",()=>{
  let timer=core.nextTimer(null,"start",60,undefined,"one",1000);
  assert.equal(core.timerSummary(timer,11000).focusMs,10000);assert.equal(core.timerSummary(timer,11000).focusMs,10000);
  timer=core.nextTimer(timer,"pause",60,undefined,"none",11000);assert.equal(timer.totals.focusMs,10000);assert.equal(timer.segments.length,1);
  timer=core.nextTimer(timer,"start",60,undefined,"two",21000);assert.equal(timer.deadline,71000);
  timer=core.nextTimer(timer,"phase",300,"break","none",71000);assert.equal(timer.totals.focusMs,60000);assert.equal(timer.totals.completedFocusRounds,1);assert.equal(timer.phase,"break");assert.equal(timer.running,false);
  timer=core.nextTimer(timer,"start",300,undefined,"three",72000);timer=core.nextTimer(timer,"pause",300,undefined,"none",82000);assert.equal(timer.totals.breakMs,10000);assert.equal(timer.totals.focusMs,60000);
  assert.throws(()=>core.nextTimer(timer,"phase",60,undefined,"x",83000),{statusCode:400});
});
test("invitation preview is code-scoped, bounded and never creates an identity or returns private room data",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"});const before=await h.db.collection("studyTogetherMembers").countDocuments({});
  const preview=await h.call("preview",{code:room.code},null);assert.equal(preview.invitation.title,"Study");assert.equal(preview.invitation.capacity,12);
  for(const field of["id","ownerId","hostIdentity","codeHash","token","agenda","poll"])assert.equal(preview.invitation[field],undefined);
  assert.equal(await h.db.collection("studyTogetherMembers").countDocuments({}),before);await assert.rejects(h.call("preview",{code:"0".repeat(16)},null),{statusCode:404});
});
test("room locks reject newcomers while admitted members can return; revoke and rotate have real effect",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"});await h.call("join",{code:room.code},learner);
  await assert.rejects(h.call("room-lock",{roomId:room.room.id,locked:true},learner),{statusCode:403});
  await h.call("room-lock",{roomId:room.room.id,locked:true});await assert.rejects(h.call("join",{code:room.code},other),{code:"ROOM_LOCKED"});assert.ok((await h.call("join",{roomId:room.room.id},learner)).token);
  await h.call("room-lock",{roomId:room.room.id,locked:false});assert.ok((await h.call("join",{code:room.code},other)).token);
  await h.call("revoke-invite",{roomId:room.room.id});await assert.rejects(h.call("join",{code:room.code,displayName:"Guest"},null),{statusCode:404});
  assert.ok((await h.call("join",{roomId:room.room.id},learner)).token);const next=await h.call("rotate-invite",{roomId:room.room.id});assert.equal(next.room.inviteActive,true);assert.equal((await h.call("preview",{code:next.code},null)).invitation.title,"Study");
});
test("board snapshots survive rejoin; permissions, approval, token scope and host capabilities are checked on the server",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id;
  await assert.rejects(h.call("board",{roomId},learner,"GET"),{statusCode:403});await h.call("join",{code:room.code},learner);
  const updated=await h.call("board",{roomId,batchId:"batch_0001",operations:[{type:"add",id:"object_0001",object:shape()}]},learner);assert.equal(updated.board.objects[0].owner,"u_"+learner._id);assert.equal(updated.room.boardRevision,1);
  await h.call("join",{roomId},learner);assert.deepEqual((await h.call("board",{roomId},learner,"GET")).board,updated.board);
  await assert.rejects(h.call("board",{roomId,batchId:"batch_0002",operations:[{type:"update",id:"object_0001",baseVersion:1,object:shape()}]},other),{statusCode:403});
  await h.call("settings",{roomId,settings:{allowWhiteboard:false}});await assert.rejects(h.call("board",{roomId,batchId:"batch_0002",operations:[{type:"add",id:"object_0002",object:shape("object_0002")}]},learner),{code:"BOARD_DISABLED"});
  assert.equal((await h.call("board",{roomId},learner,"GET")).board.objects.length,1);assert.equal((await h.call("board",{roomId,batchId:"batch_0002",operations:[{type:"add",id:"object_0002",object:shape("object_0002")}]})).board.objects.length,2);
  const guest=await h.call("join",{code:room.code,displayName:"Guest"},null),headers={authorization:"Bearer "+guest.guestSession.token};await assert.rejects(h.call("board",{roomId},null,"GET",headers),{code:"ADMISSION_REQUIRED"});await h.call("admit",{roomId,userId:guest.guestSession.id});assert.equal((await h.call("board",{roomId},null,"GET",headers)).board.objects.length,2);
  const second=await h.call("create",{title:"Other"});await assert.rejects(h.call("board",{roomId:second.room.id},null,"GET",headers),{code:"GUEST_ROOM_SCOPE"});
  assert.ok(h.calls.some(([,metadata])=>JSON.parse(metadata).boardRevision===2));assert.ok(!(JSON.parse(h.calls.at(-1)[1])).objects);
});
test("joined room history is private to admitted members and supports returning after invite revocation",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study",settings:{waitingRoom:true}}),roomId=room.room.id;
  await h.call("join",{code:room.code},learner);assert.deepEqual((await h.call("rooms",{},learner,"GET")).joinedRooms,[]);
  await h.call("admit",{roomId,userId:learner._id});await h.call("revoke-invite",{roomId});
  const listed=await h.call("rooms",{},learner,"GET");assert.equal(listed.joinedRooms[0].id,roomId);assert.equal(listed.joinedRooms[0].inviteActive,false);assert.ok((await h.call("join",{roomId},learner)).token);
  assert.deepEqual((await h.call("rooms",{},other,"GET")).joinedRooms,[]);assert.equal(JSON.stringify(listed).includes("codeHash"),false);
  await h.call("kick",{roomId,identity:"u_"+learner._id});assert.deepEqual((await h.call("rooms",{},learner,"GET")).joinedRooms,[]);await assert.rejects(h.call("join",{roomId},learner),{statusCode:403});
});
test("board retries do not duplicate strokes and stale versions cannot overwrite current objects",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id,payload={roomId,batchId:"batch_0001",operations:[{type:"add",id:"object_0001",object:shape()}]};
  const first=await h.call("board",payload),retry=await h.call("board",payload);assert.equal(first.board.revision,retry.board.revision);assert.equal(retry.board.objects.length,1);
  await h.call("board",{roomId,batchId:"batch_0002",operations:[{type:"update",id:"object_0001",baseVersion:1,object:{...shape(),x:30}}]});await assert.rejects(h.call("board",{roomId,batchId:"batch_0003",operations:[{type:"delete",id:"object_0001",baseVersion:1}]}),{code:"BOARD_CONFLICT"});
  h.client.updateRoomMetadata=async()=>{throw Error("private token detail");};const saved=await h.call("board",{roomId,batchId:"batch_0004",operations:[{type:"add",id:"object_0002",object:shape("object_0002")}]});assert.equal(saved.syncPending,true);assert.equal(JSON.stringify(saved).includes("private token"),false);
});
test("poll API is host-created, admitted-member voted, durable and closed/replaced IDs reject old votes",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id;await h.call("join",{code:room.code},learner);
  await assert.rejects(h.call("poll-create",{roomId,question:"Q",options:["A","B"]},learner),{statusCode:403});const created=await h.call("poll-create",{roomId,question:"Q",options:["A","B"]}),pollId=created.room.poll.id;
  const voted=await h.call("vote",{roomId,pollId,choice:1},learner);assert.equal(voted.room.poll.myVote,1);assert.equal(voted.room.poll.total,1);assert.equal((await h.call("vote",{roomId,pollId,choice:1},learner)).room.poll.total,1);assert.equal((await h.call("join",{roomId},learner)).room.poll.myVote,1);
  await assert.rejects(h.call("poll-create",{roomId,question:"New",options:["A","B"]}),{code:"POLL_ACTIVE"});await h.call("poll-close",{roomId,pollId});await assert.rejects(h.call("vote",{roomId,pollId,choice:0}),{code:"POLL_CLOSED"});const next=await h.call("poll-create",{roomId,question:"New",options:["A","B"]});assert.notEqual(next.room.poll.id,pollId);assert.equal(next.room.poll.total,0);await assert.rejects(h.call("vote",{roomId,pollId,choice:0}),{code:"POLL_CLOSED"});
});
test("concurrent votes rebase atomically and do not drop another member's vote",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id;await h.call("join",{code:room.code},learner);await h.call("join",{code:room.code},other);const poll=(await h.call("poll-create",{roomId,question:"Q",options:["A","B"]})).room.poll;
  await Promise.all([h.call("vote",{roomId,pollId:poll.id,choice:0},learner),h.call("vote",{roomId,pollId:poll.id,choice:1},other)]);assert.deepEqual((await h.call("status",{roomId},host,"GET")).room.poll.counts,[1,1]);
});
test("hand queue uses server timestamps and order; repeated raises cannot move a member up or duplicate them",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id;await h.call("join",{code:room.code},learner);await h.call("join",{code:room.code},other);
  await h.call("hand",{roomId,raised:true,at:0,identity:"forged"},learner);await h.call("hand",{roomId,raised:true},other);const result=await h.call("hand",{roomId,raised:true},learner);assert.deepEqual(result.room.hands.map(item=>item.identity),["u_"+learner._id,"u_"+other._id]);assert.ok(result.room.hands[0].at>Date.now()-10000);
  assert.equal((await h.call("hand",{roomId,raised:false},learner)).room.hands.length,1);await assert.rejects(h.call("hand",{roomId,raised:"true"},learner),{statusCode:400});
});
test("task assignment requires the host and a currently connected participant",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id;await h.call("join",{code:room.code},learner);await h.call("agenda",{roomId,revision:0,goal:"Goal",items:["Task"]});
  await assert.rejects(h.call("agenda",{roomId,revision:1,index:0,assignee:"u_"+learner._id},learner),{statusCode:403});await assert.rejects(h.call("agenda",{roomId,revision:1,index:0,assignee:"unknown"}),{statusCode:400});const assigned=await h.call("agenda",{roomId,revision:1,index:0,assignee:"u_"+learner._id});assert.equal(assigned.room.agenda.items[0].assignee,"u_"+learner._id);
});
test("session phase and clock commands remain host-only and persist real interval summaries",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id;await h.call("join",{code:room.code},learner);
  await assert.rejects(h.call("timer",{roomId,mode:"phase",phase:"break",duration:300},learner),{statusCode:403});await assert.rejects(h.call("timer",{roomId,mode:"phase",phase:"made-up"}),{statusCode:400});
  const started=await h.call("timer",{roomId,mode:"start",duration:60});assert.equal(started.room.timer.phase,"focus");assert.ok(started.room.timer.openedAt<=Date.now());
  const now=Date.now();await h.db.collection("studyTogetherRooms").updateOne({_id:roomId},{$set:{timer:{...started.room.timer,openedAt:now-10000,deadline:now+50000}}});const paused=await h.call("timer",{roomId,mode:"pause"});assert.ok(paused.room.timer.totals.focusMs>=10000);const phase=await h.call("timer",{roomId,mode:"phase",phase:"break",duration:300});assert.equal(phase.room.timer.phase,"break");assert.equal(phase.room.timer.running,false);assert.ok(phase.room.timer.totals.focusMs>=10000);assert.equal(phase.room.timer.totals.completedFocusRounds,0);
});
test("settings revisions reject stale/concurrent host tabs and save honestly when live permission updates fail",async()=>{
  const h=harness(),room=await h.call("create",{title:"Study"}),roomId=room.room.id;
  const changed=await h.call("settings",{roomId,revision:0,settings:{allowWhiteboard:false}});assert.equal(changed.room.settingsRevision,1);
  await assert.rejects(h.call("settings",{roomId,revision:0,settings:{allowWhiteboard:true}}),{code:"SETTINGS_CONFLICT"});
  h.client.updateParticipant=async()=>{throw Error("QA remote permission failure");};
  const saved=await h.call("settings",{roomId,revision:1,settings:{allowWhiteboard:true}});assert.equal(saved.syncPending,true);assert.equal(saved.room.settings.allowWhiteboard,true);assert.equal(saved.room.settingsRevision,2);
  const outcomes=await Promise.allSettled([h.call("settings",{roomId,revision:2,settings:{allowGuests:false}}),h.call("settings",{roomId,revision:2,settings:{allowGuests:true}})]);assert.equal(outcomes.filter(result=>result.status==="fulfilled").length,1);assert.equal(outcomes.find(result=>result.status==="rejected").reason.code,"SETTINGS_CONFLICT");
});
