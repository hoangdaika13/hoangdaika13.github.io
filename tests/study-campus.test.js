"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const core=require("../study-campus-core"),{handle,configuration}=require("../utils/study-together").__test,{MemoryDb}=require("./helpers/study-room-db");
const owner={_id:"650000000000000000000001",name:"Owner"},member={_id:"650000000000000000000002",name:"Member"},stranger={_id:"650000000000000000000003",name:"Other"};
function harness(){const db=new MemoryDb(),client={createRoom:async()=>{},updateRoomMetadata:async()=>{},listParticipants:async()=>[owner,member].map(u=>({identity:"u_"+u._id,tracks:[]})),deleteRoom:async()=>{},updateParticipant:async()=>{},removeParticipant:async()=>{}},config=configuration({LIVEKIT_URL:"wss://test.livekit.example",LIVEKIT_API_KEY:"qa",LIVEKIT_API_SECRET:"not-production"});
 const call=(action,body={},user=owner,method="POST")=>handle({method,headers:{},query:{action,...body}},{status(){return this;},json:d=>d},{db,client,config,user,body:{action,...body},rateLimit:async()=>{}});return {db,call,client};}
async function setup(){const h=harness(),c=await h.call("class-create",{title:"Campus",retentionDays:90});await h.call("class-join",{code:c.code},member);return {...h,classId:c.class.id,code:c.code};}
const event={title:"Toán nhóm",localStart:"2026-10-09T20:00",zone:"Asia/Ho_Chi_Minh",minutes:60,repeat:"weekly",until:"2026-11-06",exceptions:[{date:"2026-10-16",cancelled:true},{date:"2026-10-23",localStart:"2026-10-23T21:00"}]};
test("structured calendars keep wall time across DST, validate exceptions, escape and fold ICS",()=>{
 assert.equal(new Date(core.zonedUTC("2026-10-09T20:00","Asia/Ho_Chi_Minh")).toISOString(),"2026-10-09T13:00:00.000Z");
 assert.throws(()=>core.zonedUTC("2026-03-08T02:30","America/New_York"),/không tồn tại/);
 const e=core.event({...event,zone:"America/New_York",title:"Câu hỏi;\nVật lý, toán ✨"},"ev_test"),rows=core.occurrences([e]);assert.equal(rows.length,5);assert.equal(rows[1].cancelled,true);assert.equal(new Date(rows[0].startsAt).getUTCHours(),0);assert.equal(new Date(rows[4].startsAt).getUTCHours(),1);
 const ics=core.ics([e],Date.UTC(2026,9,9));assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/STATUS:CANCELLED/);assert.match(ics,/Câu hỏi\\;\\nVật lý\\, toán/);assert.ok(ics.split("\r\n").every(l=>Buffer.byteLength(l)<=75));
 assert.throws(()=>core.event({...event,until:"2026-02-30"},"x"));assert.throws(()=>core.event({...event,exceptions:[{date:"2026-10-10"}]},"x"));assert.throws(()=>core.event({...event,exceptions:[{date:"2026-10-16"},{date:"2026-10-16"}]},"x"));assert.throws(()=>core.zonedUTC("2026-02-30T20:00","Asia/Bangkok"));
});
test("Campus is class-private; managers, presenters, members and guests have distinct scope",async()=>{
 const h=await setup();await assert.rejects(h.call("campus-get",{classId:h.classId},stranger),{statusCode:403});await assert.rejects(h.call("campus-bank",{classId:h.classId},member),{statusCode:403});
 await assert.rejects(h.call("campus-calendar",{classId:h.classId,event,revision:0},member),{statusCode:403});
 const data=await h.call("campus-get",{classId:h.classId},member);assert.equal(data.reminders.configured,false);assert.equal(data.campus.policy.chatEnabled,false);
 const r=await h.call("create",{title:"Guest",settings:{allowGuests:true,guestApproval:false}}),g=await h.call("join",{code:r.code,displayName:"G"},null),guest={_id:g.guestSession.id,_guest:true,_roomId:r.room.id,name:"G"};
 await assert.rejects(h.call("campus-get",{classId:h.classId},guest),{statusCode:403});
});
test("calendar and tasks have separate CAS revisions; status changes require manager or actual assignee",async()=>{
 const h=await setup(),classId=h.classId;
 const e=await h.call("campus-calendar",{classId,event,revision:0});assert.equal(e.field.events[0].title,event.title);await assert.rejects(h.call("campus-calendar",{classId,event,revision:0}),{code:"CAMPUS_CONFLICT"});
 const task={title:"Bài tập",description:"Thật",assignee:member._id,status:"todo",priority:"high",due:"2026-10-12T12:00:00.000Z"};
 const t=await h.call("campus-task",{classId,task,revision:0});assert.equal(t.field.revision,1);await h.call("campus-task-status",{classId,taskId:t.field.items[0].id,status:"done",revision:1},member);
 await assert.rejects(h.call("campus-task-status",{classId,taskId:t.field.items[0].id,status:"todo",revision:2},stranger),{statusCode:403});
 await assert.rejects(h.call("campus-task",{classId,task:{...task,assignee:"forged"},revision:2}),{statusCode:400});assert.equal((await h.call("campus-get",{classId})).campus.tasks.items[0].status,"done");
});
test("shared note concurrency rejects stale saves and preserves independent class plan revision",async()=>{
 const h=await setup(),classId=h.classId;
 const results=await Promise.allSettled([h.call("campus-notes",{classId,text:"A",revision:0}),h.call("campus-notes",{classId,text:"B",revision:0},member)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.find(r=>r.status==="rejected").reason.code,"CAMPUS_CONFLICT");
 assert.equal((await h.call("class-get",{classId})).class.revision,1);await h.call("class-plan",{classId,goal:"Original",items:[],revision:1});
 const again=await h.call("campus-get",{classId});assert.equal(again.campus.notes.revision,1);assert.ok(["A","B"].includes(again.campus.notes.text));
});
async function quizSetup(){const h=await setup(),classId=h.classId;
 const bank=await h.call("campus-bank-save",{classId,revision:0,question:{type:"mcq",prompt:"2 + 2?",options:["3","4"],answer:1}});
 const next=await h.call("campus-bank-save",{classId,revision:1,question:{type:"short",prompt:"Giải thích",answer:"Tham khảo"}});
 const q=await h.call("campus-quiz-create",{classId,title:"Kiểm tra",minutes:10,questionIds:next.field.questions.map(q=>q.id)});await h.call("campus-quiz-state",{classId,quizId:q.quiz.id,mode:"open",revision:0});return {...h,quizId:q.quiz.id,questions:next.field.questions};}
test("quiz answers stay server-side until closure/release; submissions are identity-bound and idempotent",async()=>{
 const h=await quizSetup(),classId=h.classId,quizId=h.quizId;
 const read=await h.call("campus-quiz",{classId,quizId},member);assert.equal(read.submitted,false);assert.ok(read.quiz.questions.every(q=>!Object.hasOwn(q,"answer")));
 assert.ok((await h.call("campus-get",{classId},member)).quizzes[0].questions.every(q=>!Object.hasOwn(q,"answer")));
 const answers=h.questions.map(q=>({id:q.id,value:q.type==="short"?"Lập luận":1}));await h.call("campus-submit",{classId,quizId,answers,userId:owner._id},member);
 assert.equal((await h.call("campus-submit",{classId,quizId,answers},member)).duplicate,true);await assert.rejects(h.call("campus-submit",{classId,quizId,answers:answers.map((a,i)=>({...a,value:i? a.value:0}))},member),{code:"QUIZ_SUBMITTED"});
 assert.equal((await h.db.collection("studyTogetherQuizAnswers").findOne({_id:quizId+":"+member._id})).userId,member._id);
 await h.call("campus-quiz-state",{classId,quizId,mode:"close",revision:1});assert.equal((await h.call("campus-quiz",{classId,quizId},member)).result,undefined);
 const host=await h.call("campus-quiz",{classId,quizId});assert.equal(host.submissions.length,1);assert.equal(host.submissions[0].pending,1);
 await h.call("campus-grade",{classId,quizId,userId:member._id,questionId:h.questions[1].id,points:1,revision:0});await assert.rejects(h.call("campus-grade",{classId,quizId,userId:member._id,questionId:h.questions[1].id,points:0,revision:0}),{statusCode:409});
 await h.call("campus-quiz-state",{classId,quizId,mode:"reveal",revision:2});const released=await h.call("campus-quiz",{classId,quizId},member);assert.deepEqual(released.result,{earned:2,max:2,pending:0});assert.ok(released.quiz.questions.every(q=>Object.hasOwn(q,"answer")));
 await assert.rejects(h.call("campus-submit",{classId,quizId,answers},member),{statusCode:409});
});
test("malformed questions, forged bank references and member-only editing are rejected",async()=>{
 const h=await setup(),classId=h.classId;
 assert.throws(()=>core.question({type:"mcq",prompt:"X",options:[" A","A"],answer:0},"x"));
 await assert.rejects(h.call("campus-quiz-create",{classId,title:"Fake",minutes:10,questionIds:["unknown"]}),{statusCode:400});
 await assert.rejects(h.call("campus-card",{classId,front:"X",back:"Y",revision:0},member),{statusCode:403});
});
test("simultaneous duplicate quiz submissions remain idempotent and snapshot capacity is atomic",async()=>{
 const h=await quizSetup(),classId=h.classId,quizId=h.quizId,answers=h.questions.map(q=>({id:q.id,value:q.type==="short"?"X":1}));const submissions=await Promise.all([h.call("campus-submit",{classId,quizId,answers},member),h.call("campus-submit",{classId,quizId,answers},member)]);assert.ok(submissions.every(r=>r.submitted));assert.equal(await h.db.collection("studyTogetherQuizAnswers").countDocuments({quizId}),1);
 const room=await h.call("class-session",{classId}),roomId=room.room.id,object={id:"object_0001",kind:"rect",x:0,y:0,w:100,h:50,color:"#ffffff",size:4};await h.call("board",{roomId,batchId:"batch_0001",operations:[{type:"add",id:object.id,object}]});
 const saves=await Promise.allSettled(Array.from({length:5},(_,i)=>h.call("board-snapshot",{roomId,mode:"save",title:"S"+i})));assert.equal(saves.filter(s=>s.status==="fulfilled").length,3);assert.equal(await h.db.collection("studyTogetherBoardSnapshots").countDocuments({boardId:classId+":main"}),3);
});
test("flashcard group leadership is role-scoped and cannot forge card IDs",async()=>{
 const h=await setup(),classId=h.classId,c=await h.call("campus-card",{classId,front:"Từ",back:"Nghĩa",revision:0}),cardId=c.field.cards[0].id;
 await assert.rejects(h.call("campus-live-card",{classId,cardId,revealed:false,revision:0},member),{statusCode:403});
 await h.call("class-role",{classId,userId:member._id,role:"presenter",revision:1});await h.call("campus-live-card",{classId,cardId,revealed:true,revision:0},member);
 await assert.rejects(h.call("campus-live-card",{classId,cardId:"fake",revealed:true,revision:1},member),{statusCode:400});assert.equal((await h.call("campus-get",{classId})).campus.liveCards.revealed,true);
});
test("persistent class chat is opt-in, escaped by clients, retention-bounded and never extends during class renewal",async()=>{
 const h=await setup(),classId=h.classId;await assert.rejects(h.call("campus-chat-send",{classId,text:"X"},member),{statusCode:403});
 await h.call("campus-chat-policy",{classId,enabled:true,days:1,revision:0});const msg=await h.call("campus-chat-send",{classId,text:"<script>literal</script>",userId:owner._id},member);
 const raw=await h.db.collection("studyTogetherClassChat").findOne({_id:msg.id});assert.equal(raw.userId,member._id);const expiry=raw.expiresAt;
 await h.call("class-update",{classId,title:"Campus",retentionDays:365,revision:1});assert.equal(String((await h.db.collection("studyTogetherClassChat").findOne({_id:msg.id})).expiresAt),String(expiry));
 await assert.rejects(h.call("campus-chat-moderate",{classId,messageId:msg.id,mode:"pin",pinned:true},member),{statusCode:403});
 await h.call("campus-chat-moderate",{classId,messageId:msg.id,mode:"reaction",emoji:"💡"},owner);await h.call("campus-chat-moderate",{classId,messageId:msg.id,mode:"reaction",emoji:"💡"},member);
 assert.equal((await h.call("campus-chat",{classId},member)).messages[0].reactions["💡"].length,2);
 await h.call("campus-chat-send",{classId,text:"Reply",replyTo:msg.id},owner);await h.call("campus-chat-policy",{classId,enabled:false,days:1,revision:1});assert.equal((await h.call("campus-chat",{classId},member)).enabled,false);
});
test("class export omits unreleased answers for learners and deletion cleans all Campus collections",async()=>{
 const h=await quizSetup(),classId=h.classId;const e=await h.call("class-export",{classId},member);assert.equal(e.export.campus.bank,undefined);assert.ok(e.export.campus.quizzes[0].questions.every(q=>!Object.hasOwn(q,"answer")));
 await h.call("class-delete",{classId,confirmTitle:"Campus",revision:1});for(const name of ["studyTogetherCampus","studyTogetherQuizzes","studyTogetherQuizAnswers","studyTogetherClassChat"])assert.equal(await h.db.collection(name).countDocuments({classId}),0);
});
test("lines/arrows enforce two endpoints, group movement stays vector based, snapshot restore uses CAS",async()=>{
 const h=await setup(),r=await h.call("class-session",{classId:h.classId}),roomId=r.room.id;
 const object={id:"arrow_0001",kind:"arrow",x:10,y:10,w:100,h:50,points:[[0,0],[100,50]],color:"#ffffff",size:4,group:"group_0001"};assert.throws(()=>require("../study-room-core").boardObject({...object,points:[[0,0]]},"u",1));
 await h.call("board",{roomId,batchId:"batch_0001",operations:[{type:"add",id:object.id,object}]});await h.call("board-snapshot",{roomId,mode:"save",title:"Before"});
 const snap=(await h.call("board-snapshot",{roomId},owner,"GET")).snapshots[0];await assert.rejects(h.call("board-snapshot",{roomId,mode:"restore",snapshotId:snap.id,confirm:true,revision:1},member),{statusCode:403});
 await h.call("board",{roomId,batchId:"batch_0002",operations:[{type:"update",id:object.id,baseVersion:1,object:{...object,x:50}}]});
 await assert.rejects(h.call("board-snapshot",{roomId,mode:"restore",snapshotId:snap.id,confirm:true,revision:1}),{code:"BOARD_CONFLICT"});
 await h.call("board-snapshot",{roomId,mode:"restore",snapshotId:snap.id,confirm:true,revision:2});const restored=(await h.call("board",{roomId},owner,"GET")).board;assert.equal(restored.objects[0].x,10);assert.equal(restored.objects[0].version,3);
});
test("speaking queue, spotlight and breakout notices are backend-managed and cannot activate devices",async()=>{
 const h=await setup(),r=await h.call("class-session",{classId:h.classId}),roomId=r.room.id;await h.call("class-session",{classId:h.classId,roomId},member);
 await h.call("hand",{roomId,raised:true},member);await assert.rejects(h.call("floor",{roomId,identity:"u_"+member._id,mode:"speaking"},member),{statusCode:403});
 const floor=await h.call("floor",{roomId,identity:"u_"+member._id,mode:"speaking"});assert.equal(floor.room.floor.identity,"u_"+member._id);
 assert.equal((await h.call("spotlight",{roomId,identity:"u_"+member._id})).room.spotlight.identity,"u_"+member._id);await h.call("floor",{roomId,identity:"u_"+member._id,mode:"handled"});assert.equal((await h.call("status",{roomId},owner,"GET")).room.hands.length,0);
 const g=await h.call("create",{title:"Group",classId:h.classId,parentRoomId:roomId});await h.call("group-info",{roomId,targetId:g.room.id,topic:"Luyện nói",leader:"u_"+member._id,assignIdentity:"u_"+member._id,minutes:15});
 await h.call("group-broadcast",{roomId,notice:"Còn 5 phút",minutes:5});const group=(await h.call("groups",{roomId},owner,"GET")).groups.find(g2=>g2.id===g.room.id);assert.equal(group.info.topic,"Luyện nói");assert.equal(group.info.notice,"Còn 5 phút");assert.ok(group.info.deadline>Date.now());
 assert.equal(group.info.assignment,"u_"+member._id);
});
test("Campus assets share release cache versions, avoid fake services and keep account-scoped draft keys",()=>{
 const loader=fs.readFileSync("performance-loader.js","utf8"),worker=fs.readFileSync("sw.js","utf8"),ui=fs.readFileSync("study-campus.js","utf8");
 for(const asset of ["study-campus.js?v=1","study-campus-core.js?v=1","study-campus.css?v=1","study-classroom.js?v=3","study-whiteboard.js?v=3"])assert.ok(loader.includes(asset)&&worker.includes(asset),asset);
 assert.match(ui,/hh\.studyTogether\.campusDraft\.v1/);assert.match(ui,/e\.stopPropagation/);assert.match(ui,/document\.hidden/);assert.doesNotMatch(ui,/\b(?:alert|confirm|prompt)\s*\(/);
});
test("ephemeral chat acknowledgement has bounded same-ID retries, explicit manual recovery and lifecycle cleanup",()=>{
 const source=fs.readFileSync("study-together.js","utf8");assert.match(source,/hh\.study\.chat-ack/);assert.match(source,/destinationIdentities:\[participant\.identity\]/);assert.match(source,/delivery\?\.expected\.has\(p\.identity\)/);assert.match(source,/delivery\.attempts>=3/);assert.match(source,/s\.messageNodes\.has\(d\.id\).*acknowledge\(d,p\)/);assert.match(source,/s\.chatDelivery\.clear\(\)/);assert.match(source,/data-hst-retry-chat/);assert.doesNotMatch(source,/localStorage\.setItem\([^)]*chatDelivery/);
});
test("room action busy states are visible, cancellation stays reachable, and old groups cannot leak into new rooms",()=>{
 const s=fs.readFileSync("study-together.js","utf8");assert.match(s,/b\.disabled=s\.busy&&b\.dataset\.hstAction!=='leave'/);assert.match(s,/data-hst-group-edit.*b\.disabled=!connected/);assert.match(s,/q\('\[data-hst-groups\]'\)\.replaceChildren\(\)/);assert.match(s,/if\(b\.dataset\.hstAction==='leave'\)\{leave\(\);return;/);assert.match(s,/function leave\(\)\{for\(const c of s\.pending\)c\.abort\(\)/);
});
