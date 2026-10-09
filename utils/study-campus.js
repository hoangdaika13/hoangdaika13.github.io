"use strict";
const {randomUUID,createHash}=require("node:crypto"),classroom=require("./study-classroom"),core=require("../study-campus-core");
const fail=(message,statusCode=400,code="CAMPUS_INVALID")=>{throw Object.assign(Error(message),{statusCode,code});};
const id=user=>String(user._id),text=core.text,initialized=new WeakMap();
async function indexes(db){if(!initialized.has(db))initialized.set(db,Promise.all(["studyTogetherCampus","studyTogetherQuizzes","studyTogetherQuizAnswers","studyTogetherClassChat"].map(name=>db.collection(name).createIndex({expiresAt:1},{expireAfterSeconds:0}))).catch(e=>{initialized.delete(db);throw e;}));return initialized.get(db);}
const empty=()=>({calendar:{revision:0,events:[]},tasks:{revision:0,items:[]},notes:{revision:0,text:""},bank:{revision:0,questions:[]},cards:{revision:0,cards:[]},announcements:{revision:0,posts:[]},policy:{revision:0,chatEnabled:false,chatDays:7},liveCards:{revision:0,cardId:null,revealed:false}});
async function state(db,c){const collection=db.collection("studyTogetherCampus");let s=await collection.findOne({_id:c._id});if(!s){try{await collection.insertOne({_id:c._id,classId:c._id,...empty(),expiresAt:c.expiresAt});}catch(e){if(e.code!==11000)throw e;}s=await collection.findOne({_id:c._id});}return s;}
async function change(db,c,field,next,revision){
  const s=await state(db,c),current=s[field]||empty()[field];if(!Number.isSafeInteger(revision)||revision!==current.revision)fail("Mục này vừa thay đổi. Giữ bản nháp và tải bản mới trước khi lưu.",409,"CAMPUS_CONFLICT");
  const result=await db.collection("studyTogetherCampus").updateOne({_id:c._id,[field+".revision"]:revision},{$set:{[field]:{...next,revision:revision+1}}});
  if(!result.matchedCount)fail("Có phiên khác vừa cập nhật. Tải bản mới.",409,"CAMPUS_CONFLICT");return {...next,revision:revision+1};
}
const safe=s=>({calendar:s.calendar,tasks:s.tasks,notes:s.notes,cards:s.cards,announcements:s.announcements,policy:s.policy,liveCards:s.liveCards});
async function cleanup(db,c,remove=false){for(const name of ["studyTogetherCampus","studyTogetherQuizzes","studyTogetherQuizAnswers","studyTogetherClassChat"]){if(remove)await db.collection(name).deleteMany({classId:c._id});else if(name!=="studyTogetherClassChat")await db.collection(name).updateMany({classId:c._id},{$set:{expiresAt:c.expiresAt}});else{const rows=await db.collection(name).find({classId:c._id}).limit(500).toArray();for(const row of rows)if(new Date(row.expiresAt)>new Date(c.expiresAt))await db.collection(name).updateOne({_id:row._id},{$set:{expiresAt:c.expiresAt}});}}}
async function exportData(db,c,user){const s=await state(db,c),manager=classroom.manager(classroom.role(c,user)),quizzes=await db.collection("studyTogetherQuizzes").find({classId:c._id}).limit(30).toArray(),messages=await db.collection("studyTogetherClassChat").find({classId:c._id,expiresAt:{$gt:new Date()}}).limit(500).toArray();return {...safe(s),...(manager?{bank:s.bank}:{}),quizzes:quizzes.filter(q=>manager||q.state!=="draft").map(q=>core.publicQuiz(q,manager)),chat:messages.map(({_id,text,name,at,replyTo,reactions,pinned,resourceId})=>({id:_id,text,name,at,replyTo,reactions,pinned,resourceId}))};}
async function handle({action,body,user,db,rateLimit}){
  const c=await classroom.access(db,body.classId,user),role=classroom.role(c,user),manager=classroom.manager(role),leader=manager||role==="presenter";await indexes(db);
  const s=await state(db,c),quizzes=db.collection("studyTogetherQuizzes"),papers=db.collection("studyTogetherQuizAnswers"),chat=db.collection("studyTogetherClassChat");
  const readOnly=["campus-get","campus-bank","campus-quiz","campus-chat"].includes(action);
  if(!readOnly)await rateLimit(db,"campus:"+id(user)+":"+action,action==="campus-chat-send"?20:30,60000);
  if(action==="campus-get"){const rows=await quizzes.find({classId:c._id}).sort({createdAt:-1}).limit(30).toArray();return {ok:true,campus:safe(s),quizzes:rows.filter(q=>manager||q.state!=="draft").map(q=>core.publicQuiz(q,false)),reminders:{configured:false,message:"Chưa có máy chủ gửi nhắc lịch. Xuất .ics để dùng nhắc lịch của ứng dụng lịch."}};}
  if(action==="campus-bank"){if(!manager)fail("Chỉ người quản lý được xem đáp án ngân hàng.",403);return {ok:true,bank:s.bank};}
  if(action==="campus-quiz"){
    const q=await quizzes.findOne({_id:body.quizId,classId:c._id});if(!q||q.state==="draft"&&!manager)fail("Không có bài được phép xem.",404);
    const closed=q.state==="closed"||q.state==="open"&&Date.now()>=q.deadline,own=await papers.findOne({_id:q._id+":"+id(user)}),all=manager&&closed?await papers.find({quizId:q._id}).limit(100).toArray():[];
    return {ok:true,quiz:core.publicQuiz(q,manager),submitted:Boolean(own),receipt:own?{at:own.at}:null,...(own&&closed&&q.reveal?{result:core.score(q,own)}:{}),...(manager&&closed?{submissions:all.map(p=>({userId:p.userId,name:p.name,revision:p.revision,answers:p.answers,...core.score(q,p)}))}:{})};
  }
  if(action==="campus-submit"){
    const q=await quizzes.findOne({_id:body.quizId,classId:c._id});if(!q||q.state!=="open"||Date.now()>=q.deadline)fail("Bài đã đóng hoặc hết giờ.",409);
    if(!Array.isArray(body.answers)||body.answers.length!==q.questions.length)fail("Cần trả lời đủ các câu.");
    const answers=q.questions.map(question=>{const a=body.answers.filter(a=>a.id===question.id);if(a.length!==1)fail("Câu trả lời bị thiếu hoặc gửi trùng.");const value=question.type==="short"?text(a[0].value,1000):a[0].value;if(question.type!=="short"&&(!Number.isInteger(value)||value<0||value>=question.options.length))fail("Đáp án không hợp lệ.");return {id:question.id,value};});
    const key=q._id+":"+id(user),digest=createHash("sha256").update(JSON.stringify(answers)).digest("hex"),old=await papers.findOne({_id:key});
    if(old){if(old.digest!==digest)fail("Bạn đã nộp bài; không được thay phiếu bằng lần gửi khác.",409,"QUIZ_SUBMITTED");return {ok:true,submitted:true,duplicate:true};}
    try{await papers.insertOne({_id:key,classId:c._id,quizId:q._id,userId:id(user),name:String(user.name||"Người học").slice(0,80),answers,digest,grades:{},revision:0,at:new Date(),expiresAt:c.expiresAt});}catch(e){if(e.code===11000){const existing=await papers.findOne({_id:key});if(existing?.digest===digest)return {ok:true,submitted:true,duplicate:true};fail("Bài đã được nộp bởi tab khác.",409,"QUIZ_SUBMITTED");}throw e;}
    return {ok:true,submitted:true};
  }
  if(action==="campus-live-card"){if(!leader)fail("Chỉ người điều phối/trình bày được dẫn flashcard.",403);if(body.cardId!==null&&!s.cards.cards.some(card=>card.id===body.cardId)||typeof body.revealed!=="boolean")fail("Thẻ hoặc trạng thái không hợp lệ.");return {ok:true,field:await change(db,c,"liveCards",{cardId:body.cardId,revealed:body.revealed},body.revision)};}
  if(action==="campus-chat"){
    const rows=await chat.find({classId:c._id,expiresAt:{$gt:new Date()}}).sort({at:-1}).limit(100).toArray();return {ok:true,enabled:s.policy.chatEnabled,days:s.policy.chatDays,messages:rows.reverse().map(({_id,userId,name,text,at,replyTo,reactions,pinned,resourceId})=>({id:_id,userId,name,text,at,replyTo,reactions,pinned,resourceId}))};
  }
  if(action==="campus-chat-send"){
    if(!s.policy.chatEnabled)fail("Lớp chưa bật lưu chat dài hạn.",403);const message=text(body.text,1000);if(!message)fail("Nhập tin nhắn.");
    if(body.replyTo&&!await chat.findOne({_id:body.replyTo,classId:c._id,expiresAt:{$gt:new Date()}}))fail("Tin trả lời không còn hiệu lực.");
    if(body.resourceId&&!c.documents.some(doc=>doc.id===body.resourceId)&&!s.tasks.items.some(task=>task.id===body.resourceId))fail("Tài nguyên không thuộc lớp.");
    if(await chat.countDocuments({classId:c._id})>=500)fail("Lớp đạt 500 tin đang lưu. Người quản lý cần xóa/xuất trước.",409);
    const messageId="msg_"+randomUUID();await chat.insertOne({_id:messageId,classId:c._id,userId:id(user),name:String(user.name||"Người học").slice(0,80),text:message,replyTo:body.replyTo||null,resourceId:body.resourceId||null,reactions:{},pinned:false,revision:0,at:new Date(),expiresAt:new Date(Math.min(new Date(c.expiresAt).getTime(),Date.now()+s.policy.chatDays*86400000))});return {ok:true,id:messageId};
  }
  if(action==="campus-chat-moderate"){
    const message=await chat.findOne({_id:body.messageId,classId:c._id,expiresAt:{$gt:new Date()}});if(!message)fail("Không tìm thấy tin.",404);
    if(body.mode==="delete"){if(!manager&&message.userId!==id(user))fail("Chỉ xóa tin của mình.",403);await chat.deleteOne({_id:message._id,classId:c._id});return {ok:true};}
    if(body.mode==="pin"){if(!manager)fail("Chỉ người quản lý được ghim.",403);await chat.updateOne({_id:message._id},{$set:{pinned:body.pinned===true}});return {ok:true};}
    if(body.mode==="reaction"){if(!["👍","💡","❤️","👏"].includes(body.emoji))fail("Reaction không hợp lệ.");const reactions={...message.reactions},list=new Set(reactions[body.emoji]||[]);if(list.has(id(user)))list.delete(id(user));else list.add(id(user));reactions[body.emoji]=[...list];const result=await chat.updateOne({_id:message._id,revision:message.revision},{$set:{reactions,revision:message.revision+1}});if(!result.matchedCount)fail("Reaction vừa đổi. Tải lại tin.",409);return {ok:true};}
    fail("Thao tác tin chưa hỗ trợ.");
  }
  if(action==="campus-notes")return {ok:true,field:await change(db,c,"notes",{text:text(body.text,12000),by:id(user),at:new Date()},body.revision)};
  if(action==="campus-task-status"){
    const items=s.tasks.items.map(t=>({...t})),task=items.find(t=>t.id===body.taskId);if(!task)fail("Không tìm thấy nhiệm vụ.",404);
    if(!manager&&task.assignee!==id(user))fail("Chỉ đổi trạng thái nhiệm vụ được giao cho mình.",403);
    if(!["todo","doing","done"].includes(body.status))fail("Trạng thái không hợp lệ.");task.status=body.status;task.updatedAt=new Date();task.updatedBy=id(user);return {ok:true,field:await change(db,c,"tasks",{items},body.revision)};
  }
  if(!manager)fail("Chỉ chủ lớp/trợ giảng được dùng thao tác này.",403,"CAMPUS_MANAGER");
  if(action==="campus-calendar"){
    const events=[...s.calendar.events];if(body.mode==="delete"){const i=events.findIndex(e=>e.id===body.eventId);if(i<0)fail("Buổi học không tồn tại.",404);events.splice(i,1);}else{if(body.eventId&&!events.some(e=>e.id===body.eventId))fail("Buổi học không tồn tại.",404);const item=core.event(body.event,body.eventId||"ev_"+randomUUID());if(item.leader&&!c.members.some(m=>m.userId===item.leader&&m.role!=="blocked"))fail("Người phụ trách không thuộc lớp.");const i=events.findIndex(e=>e.id===item.id);if(i>=0)events[i]=item;else{if(events.length>=30)fail("Tối đa 30 chuỗi lịch.",409);events.push(item);}}
    return {ok:true,field:await change(db,c,"calendar",{events},body.revision)};
  }
  if(action==="campus-task"){
    const items=[...s.tasks.items];if(body.mode==="delete"){const i=items.findIndex(task=>task.id===body.taskId);if(i<0)fail("Không tìm thấy nhiệm vụ.",404);items.splice(i,1);}else{
      const old=items.find(task=>task.id===body.taskId),input=body.task||{},title=text(input.title,160),description=text(input.description||"",1000),assignee=text(input.assignee||"",64),documentId=text(input.documentId||"",100),due=input.due||null;
      if(body.taskId&&!old)fail("Không tìm thấy nhiệm vụ.",404);
      if(!title||!["todo","doing","done"].includes(input.status)||!["low","normal","high"].includes(input.priority)||assignee&&!c.members.some(m=>m.userId===assignee&&m.role!=="blocked")||documentId&&!c.documents.some(doc=>doc.id===documentId)||due&&(typeof due!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(due)||!Number.isFinite(Date.parse(due))))fail("Nhiệm vụ, người nhận, hạn hoặc tài liệu không hợp lệ.");
      const item={id:old?.id||"task_"+randomUUID(),title,description,assignee,documentId,due,status:input.status,priority:input.priority,updatedAt:new Date(),updatedBy:id(user)};const i=items.findIndex(task=>task.id===item.id);if(i>=0)items[i]=item;else{if(items.length>=60)fail("Tối đa 60 nhiệm vụ.",409);items.push(item);}
    }return {ok:true,field:await change(db,c,"tasks",{items},body.revision)};
  }
  if(action==="campus-bank-save"){
    const questions=[...s.bank.questions];if(body.mode==="delete"){const i=questions.findIndex(q=>q.id===body.questionId);if(i<0)fail("Không tìm thấy câu hỏi.");questions.splice(i,1);}else{if(body.questionId&&!questions.some(q=>q.id===body.questionId))fail("Câu hỏi không tồn tại.",404);const q=core.question(body.question,body.questionId||"q_"+randomUUID()),i=questions.findIndex(item=>item.id===q.id);if(i>=0)questions[i]=q;else{if(questions.length>=50)fail("Ngân hàng tối đa 50 câu.");questions.push(q);}}return {ok:true,field:await change(db,c,"bank",{questions},body.revision)};
  }
  if(action==="campus-quiz-create"){
    if(!Array.isArray(body.questionIds)||body.questionIds.length<1||body.questionIds.length>10||new Set(body.questionIds).size!==body.questionIds.length)fail("Chọn 1–10 câu không trùng.");
    const questions=body.questionIds.map(qid=>s.bank.questions.find(q=>q.id===qid));if(questions.some(q=>!q))fail("Có câu không nằm trong ngân hàng.");
    if(await quizzes.countDocuments({classId:c._id})>=30)fail("Tối đa 30 bài đang lưu.",409);
    const title=text(body.title,120),minutes=Number(body.minutes);if(!title||!Number.isInteger(minutes)||minutes<1||minutes>90)fail("Tên bài/thời gian 1–90 phút không hợp lệ.");
    const quiz={_id:"quiz_"+randomUUID(),classId:c._id,title,minutes,questions,state:"draft",revision:0,reveal:false,createdAt:new Date(),expiresAt:c.expiresAt};await quizzes.insertOne(quiz);return {ok:true,quiz:core.publicQuiz(quiz,true)};
  }
  if(["campus-quiz-state","campus-grade"].includes(action)){
    const q=await quizzes.findOne({_id:body.quizId,classId:c._id});if(!q)fail("Không tìm thấy bài.",404);
    if(action==="campus-grade"){if(q.state!=="closed"&&!(q.state==="open"&&Date.now()>=q.deadline))fail("Đóng bài trước khi chấm.",409);const question=q.questions.find(x=>x.id===body.questionId);if(question?.type!=="short"||![0,1].includes(body.points))fail("Chỉ chấm câu ngắn với 0 hoặc 1 điểm.");const p=await papers.findOne({_id:q._id+":"+body.userId});if(!p)fail("Người này chưa nộp.",404);const result=await papers.updateOne({_id:p._id,revision:body.revision},{$set:{grades:{...p.grades,[body.questionId]:body.points},revision:p.revision+1}});if(!result.matchedCount)fail("Bài chấm vừa đổi.",409);return {ok:true};}
    if(!["open","close","reveal","delete"].includes(body.mode))fail("Trạng thái bài không hợp lệ.");
    if(body.mode==="delete"){if(q.state==="open"&&Date.now()<q.deadline)fail("Đóng bài trước khi xóa.",409);if(body.revision!==q.revision)fail("Bài vừa thay đổi.",409);const deleted=await quizzes.deleteOne({_id:q._id,revision:q.revision});if(!deleted.deletedCount)fail("Bài vừa thay đổi.",409);await papers.deleteMany({quizId:q._id});return {ok:true};}
    if(body.mode==="open"&&q.state!=="draft")fail("Bài đã mở không được reset kết quả.",409);
    if(body.mode==="reveal"&&q.state!=="closed"&&!(q.state==="open"&&Date.now()>=q.deadline))fail("Đóng bài trước khi công bố.",409);
    const changes=body.mode==="open"?{state:"open",deadline:Date.now()+q.minutes*60000}:body.mode==="close"?{state:"closed"}:{state:"closed",reveal:true};
    const result=await quizzes.updateOne({_id:q._id,revision:body.revision},{$set:{...changes,revision:q.revision+1}});if(!result.matchedCount)fail("Bài vừa thay đổi.",409);return {ok:true};
  }
  if(action==="campus-card"){
    const cards=[...s.cards.cards];if(body.mode==="delete"){const i=cards.findIndex(card=>card.id===body.cardId);if(i<0)fail("Không tìm thấy thẻ.");cards.splice(i,1);}else{if(body.cardId&&!cards.some(card=>card.id===body.cardId))fail("Thẻ không tồn tại.",404);const front=text(body.front,500),back=text(body.back,1000);if(!front||!back)fail("Nhập đủ hai mặt thẻ.");const item={id:body.cardId||"card_"+randomUUID(),front,back},i=cards.findIndex(card=>card.id===item.id);if(i>=0)cards[i]=item;else{if(cards.length>=50)fail("Tối đa 50 flashcard.",409);cards.push(item);}}return {ok:true,field:await change(db,c,"cards",{cards},body.revision)};
  }
  if(action==="campus-announcement"){
    const posts=[...s.announcements.posts];if(body.mode==="delete"){const i=posts.findIndex(p=>p.id===body.postId);if(i<0)fail("Không tìm thấy thông báo.");posts.splice(i,1);}else{const title=text(body.title,160),message=text(body.text,2000);if(!title||!message)fail("Nhập tiêu đề và nội dung.");if(posts.length>=30)fail("Tối đa 30 thông báo.",409);posts.unshift({id:"post_"+randomUUID(),title,text:message,author:id(user),name:String(user.name||"Người quản lý").slice(0,80),at:new Date()});}return {ok:true,field:await change(db,c,"announcements",{posts},body.revision)};
  }
  if(action==="campus-chat-policy"){if(typeof body.enabled!=="boolean"||![1,7,30].includes(body.days))fail("Chọn lưu chat 1/7/30 ngày.");return {ok:true,field:await change(db,c,"policy",{chatEnabled:body.enabled,chatDays:body.days},body.revision)};}
  if(action==="campus-chat-clear"){if(body.confirm!==true)fail("Cần xác nhận xóa chat lớp.");await chat.deleteMany({classId:c._id});return {ok:true};}
  fail("Chức năng Campus chưa được hỗ trợ.");
}
module.exports={handle,cleanup,exportData};
