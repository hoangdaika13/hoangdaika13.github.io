"use strict";
const {randomUUID,randomBytes,createHash}=require("node:crypto");
const {validateUpload}=require("../api/storage/files").__test;
const core=require("../study-room-core");
const fail=(message,statusCode=400,code="CLASS_INVALID")=>{throw Object.assign(Error(message),{statusCode,code});};
const clean=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const hash=v=>createHash("sha256").update(v).digest("hex");
const uid=user=>String(user._id);
const manager=role=>["owner","assistant"].includes(role);
const role=(c,user)=>c.ownerId===uid(user)?"owner":c.members.find(m=>m.userId===uid(user))?.role;
const active=c=>c&&c.status==="active"&&new Date(c.expiresAt)>new Date();
function present(c,user){
  return {id:c._id,title:c.title,description:c.description,schedule:c.schedule,retentionDays:c.retentionDays,expiresAt:c.expiresAt,revision:c.revision,role:role(c,user),members:c.members.map(m=>({userId:m.userId,name:m.name,role:m.role})),pages:c.pages,plan:c.plan||null,documents:c.documents||[],reading:c.reading||null};
}
async function access(db,classId,user){
  if(!user||user._guest)fail("Đăng nhập HH để dùng thư viện lớp lâu dài.",401,"CLASS_AUTH");
  const c=await db.collection("studyTogetherClasses").findOne({_id:clean(classId,100)});
  if(!active(c)||!["owner","assistant","presenter","member"].includes(role(c,user)))fail("Lớp không tồn tại, hết hạn hoặc bạn không có quyền.",403,"CLASS_ACCESS");
  return c;
}
async function update(db,c,changes,revision){
  if(revision!==undefined&&revision!==c.revision)fail("Lớp đã thay đổi. Tải bản mới trước khi lưu.",409,"CLASS_CONFLICT");
  const result=await db.collection("studyTogetherClasses").updateOne({_id:c._id,status:"active",revision:c.revision},{$set:{...changes,revision:c.revision+1,updatedAt:new Date()}});
  if(!result.matchedCount)fail("Lớp vừa thay đổi. Tải bản mới và thử lại.",409,"CLASS_CONFLICT");
  return db.collection("studyTogetherClasses").findOne({_id:c._id});
}
const initialized=new WeakMap();
async function indexes(db){
  if(!initialized.has(db))initialized.set(db,Promise.all(["studyTogetherClasses","studyTogetherDocuments","studyTogetherClassSessions"].map(name=>db.collection(name).createIndex({expiresAt:1},{expireAfterSeconds:0}))).then(()=>db.collection("studyTogetherClasses").createIndex({memberIds:1,updatedAt:-1})).catch(e=>{initialized.delete(db);throw e;}));
  return initialized.get(db);
}
async function archive(db,room){
  if(!room.classId)return;
  const c=await db.collection("studyTogetherClasses").findOne({_id:room.classId});if(!active(c))return;
  const endedAt=room.closedAt||new Date(),timer=room.status==="closed"&&room.timer?.running?core.nextTimer(room.timer,"pause",room.timer.duration||1500,undefined,"closed",new Date(endedAt).getTime()):room.timer||null;
  await db.collection("studyTogetherClassSessions").updateOne({_id:room._id},{$set:{classId:c._id,title:room.title,status:room.status,agenda:room.agenda||null,timer,poll:core.publicPoll(room.poll),endedAt:room.status==="closed"?endedAt:null,expiresAt:c.expiresAt}},{upsert:true});
}
async function handle({action,body,user,db,client,create,join,publish,moderate}){
  if(!user||user._guest)fail("Đăng nhập HH để dùng lớp học lâu dài.",401,"CLASS_AUTH");
  await indexes(db);
  const classes=db.collection("studyTogetherClasses"),docs=db.collection("studyTogetherDocuments"),sessions=db.collection("studyTogetherClassSessions");
  if(action==="class-list"){
    const rows=await classes.find({memberIds:uid(user),status:"active",expiresAt:{$gt:new Date()}}).sort({updatedAt:-1}).limit(30).toArray();
    return {ok:true,classes:rows.filter(c=>["owner","assistant","presenter","member"].includes(role(c,user))).map(c=>present(c,user)),limits:{fileBytes:768000,classBytes:8*1024*1024,documents:20}};
  }
  if(action==="class-create"){
    const title=clean(body.title,100);if(!title)fail("Nhập tên lớp.");
    if(await classes.countDocuments({ownerId:uid(user),status:"active",expiresAt:{$gt:new Date()}})>=20)fail("Tối đa 20 lớp đang lưu cho mỗi chủ lớp.",409);
    const days=Number(body.retentionDays||90);if(![30,90,365].includes(days))fail("Chọn thời hạn 30, 90 hoặc 365 ngày.");
    const code=randomBytes(8).toString("hex").toUpperCase(),now=new Date();
    const c={_id:"hh-class-"+randomUUID(),ownerId:uid(user),title,description:clean(body.description,600),schedule:clean(body.schedule,120),retentionDays:days,expiresAt:new Date(Date.now()+days*86400000),status:"active",revision:0,members:[{userId:uid(user),name:clean(user.name,80),role:"owner"}],memberIds:[uid(user)],pages:[{id:"main",title:"Trang 1"}],documents:[],codeHash:hash(code),createdAt:now,updatedAt:now};
    await classes.insertOne(c);return {ok:true,class:present(c,user),code};
  }
  if(action==="class-join"){
    const code=clean(body.code,32).toUpperCase();if(!/^[A-F0-9]{16}$/.test(code))fail("Nhập mã lớp 16 ký tự.");
    let c=await classes.findOne({codeHash:hash(code)});if(!active(c))fail("Mã lớp không còn hiệu lực.",404);
    if(role(c,user)==="blocked")fail("Bạn không còn được phép vào lớp.",403);
    if(!role(c,user)){if(c.members.length>=100)fail("Lớp đạt 100 thành viên.",409);c=await update(db,c,{members:[...c.members,{userId:uid(user),name:clean(user.name,80),role:"member"}],memberIds:[...c.memberIds,uid(user)]});}
    return {ok:true,class:present(c,user)};
  }
  let c=await access(db,body.classId,user),r=role(c,user);
  if(action==="class-get"){
    const rows=await sessions.find({classId:c._id}).sort({startedAt:-1}).limit(30).toArray();
    return {ok:true,class:present(c,user),sessions:rows.map(({_id,title,status,startedAt,endedAt,agenda,timer,poll,parentRoomId})=>({id:_id,title,status,startedAt,endedAt,agenda,timer,poll,parentRoomId}))};
  }
  if(action==="class-session"){
    if(body.roomId){
      const room=await db.collection("studyTogetherRooms").findOne({_id:body.roomId,classId:c._id,status:"active",expiresAt:{$gt:new Date()}});
      if(!room)fail("Phiên học đã kết thúc hoặc hết hạn.",404);
      const members=db.collection("studyTogetherMembers"),id=room._id+":"+uid(user);
      if((await members.findOne({_id:id}))?.state==="blocked")fail("Bạn đã bị chặn khỏi phiên này.",403,"ROOM_BLOCKED");
      try{await members.updateOne({_id:id,state:{$ne:"blocked"}},{$set:{roomId:room._id,userId:uid(user),name:clean(user.name,80),state:"admitted",updatedAt:new Date(),expiresAt:room.expiresAt}},{upsert:true});}catch(e){if(e.code===11000)fail("Bạn đã bị chặn khỏi phiên này.",403,"ROOM_BLOCKED");throw e;}
      return join(room._id);
    }
    if(!manager(r))fail("Chỉ chủ lớp/trợ giảng được mở phiên học.",403);
    return create({classId:c._id,title:clean(body.title,100)||c.title,settings:{waitingRoom:true,allowGuests:false},capacity:32});
  }
  if(action==="class-document"){
    const doc=await docs.findOne({_id:clean(body.documentId,100),classId:c._id});
    if(!doc)fail("Không tìm thấy tài liệu trong lớp.",404);
    return {ok:true,document:{id:doc._id,name:doc.name,mimeType:doc.mimeType,size:doc.size,data:doc.data,notes:doc.notes||[],revision:doc.revision}};
  }
  if(action==="class-annotate"){
    const doc=await docs.findOne({_id:clean(body.documentId,100),classId:c._id}),text=clean(body.text,500),page=Number(body.page);
    if(!doc||!text||!Number.isInteger(page)||page<1||page>500)fail("Chú thích cần trang 1–500 và nội dung tối đa 500 ký tự.");
    if(doc.notes.length>=100)fail("Tài liệu đạt 100 chú thích.",409);
    const result=await docs.updateOne({_id:doc._id,classId:c._id,revision:body.revision},{$set:{notes:[...doc.notes,{id:randomUUID(),userId:uid(user),name:clean(user.name,80),text,page,at:new Date()}],revision:doc.revision+1}});
    if(!result.matchedCount)fail("Chú thích vừa thay đổi. Mở lại tài liệu trước khi lưu.",409,"CLASS_CONFLICT");
    return {ok:true};
  }
  if(action==="class-export"){
    const files=await docs.find({classId:c._id}).limit(20).toArray(),boards=await db.collection("studyTogetherBoards").find({classId:c._id}).limit(8).toArray(),history=await sessions.find({classId:c._id}).sort({startedAt:-1}).limit(100).toArray();
    // Binary data and notes are fetched per document by the client, avoiding serverless response limits.
    return {ok:true,export:{schema:"hh.classroom.v1",includesFileData:false,campus:await require("./study-campus").exportData(db,c,user),class:present(c,user),documents:files.map(({_id,name,mimeType,size})=>({id:_id,name,mimeType,size})),boards:boards.map(({pageId,objects,revision})=>({pageId,objects,revision})),sessions:history.map(({title,startedAt,endedAt,agenda,timer,poll})=>({title,startedAt,endedAt,agenda,timer,poll}))}};
  }
  if(action==="class-reading"){
    if(!manager(r)&&r!=="presenter")fail("Chỉ người điều phối/trình bày được dẫn trang đọc.",403);
    if(!c.documents.some(d=>d.id===body.documentId)||!Number.isInteger(body.page)||body.page<1||body.page>500)fail("Trang hoặc tài liệu không hợp lệ.");
    c=await update(db,c,{reading:{documentId:body.documentId,page:body.page,by:uid(user)}},body.revision);return {ok:true,class:present(c,user)};
  }
  if(!manager(r))fail("Chỉ chủ lớp/trợ giảng được dùng thao tác này.",403,"CLASS_MANAGER");
  if(action==="class-page"){
    if(c.pages.length>=8)fail("Lớp đạt 8 trang bảng trắng.",409);
    const title=clean(body.title,60);if(!title)fail("Nhập tên trang.");
    c=await update(db,c,{pages:[...c.pages,{id:"p_"+randomUUID().replaceAll("-",""),title}]},body.revision);
  }else if(action==="class-plan"){
    if(typeof body.goal!=="string"||body.goal.length>240||!Array.isArray(body.items)||body.items.length>6||body.items.some(text=>typeof text!=="string"||!text.trim()||text.length>120))fail("Kế hoạch tối đa 6 việc, 120 ký tự/việc.");
    c=await update(db,c,{plan:{revision:(c.plan?.revision||0)+1,goal:body.goal.trim(),items:body.items.map(text=>({text:text.trim(),done:false}))}},body.revision);
  }else if(action==="class-upload"){
    if(c.documents.length>=20)fail("Lớp đạt 20 tài liệu.",409);
    const name=clean(body.name,180),type=clean(body.mimeType,80),encoded=body.data;
    if(!["application/pdf","image/png","image/jpeg","image/webp"].includes(type)||typeof encoded!=="string"||encoded.length>1024000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))fail("Chỉ nhận PDF/PNG/JPEG/WebP, tối đa 750 KiB.",415);
    const bytes=Buffer.from(encoded,"base64");if(!bytes.length||bytes.length>768000)fail("Tài liệu vượt 750 KiB.",413);
    validateUpload(name,type,bytes);if(c.documents.reduce((n,d)=>n+d.size,0)+bytes.length>8*1024*1024)fail("Kho lớp đạt giới hạn 8 MiB.",413);
    const id="doc_"+randomUUID(),doc={_id:id,classId:c._id,name,mimeType:type,size:bytes.length,data:bytes.toString("base64"),notes:[],revision:0,expiresAt:c.expiresAt};
    await docs.insertOne(doc);
    try{c=await update(db,c,{documents:[...c.documents,{id,name,mimeType:type,size:bytes.length}]},body.revision);}catch(e){await docs.deleteOne({_id:id});throw e;}
  }else if(action==="class-document-delete"){
    if(!c.documents.some(d=>d.id===body.documentId))fail("Không tìm thấy tài liệu.",404);
    c=await update(db,c,{documents:c.documents.filter(d=>d.id!==body.documentId),reading:c.reading?.documentId===body.documentId?null:c.reading},body.revision);await docs.deleteOne({_id:body.documentId,classId:c._id});
  }else if(action==="class-role"){
    if(r!=="owner")fail("Chỉ chủ lớp được đổi vai trò.",403);
    if(body.userId===c.ownerId||!c.members.some(m=>m.userId===body.userId)||!["member","assistant","presenter","blocked"].includes(body.role))fail("Thành viên hoặc vai trò không hợp lệ.");
    c=await update(db,c,{members:c.members.map(m=>m.userId===body.userId?{...m,role:body.role}:m)},body.revision);
    const syncPending=await moderate(c,body.userId,body.role);
    return {ok:true,class:present(c,user),syncPending:Boolean(syncPending)};
  }else if(action==="class-invite"){
    if(r!=="owner")fail("Chỉ chủ lớp được đổi mã lớp.",403);
    const code=randomBytes(8).toString("hex").toUpperCase();c=await update(db,c,{codeHash:hash(code)},body.revision);return {ok:true,class:present(c,user),code};
  }else if(action==="class-update"){
    const days=Number(body.retentionDays);if(![30,90,365].includes(days)||!clean(body.title,100))fail("Tên lớp và thời hạn không hợp lệ.");
    c=await update(db,c,{title:clean(body.title,100),description:clean(body.description,600),schedule:clean(body.schedule,120),retentionDays:days,expiresAt:new Date(Date.now()+days*86400000)},body.revision);
    await require("./study-campus").cleanup(db,c);
    await db.collection('studyTogetherBoardSnapshots').updateMany({classId:c._id},{$set:{expiresAt:c.expiresAt}});
    await docs.updateMany({classId:c._id},{$set:{expiresAt:c.expiresAt}});await sessions.updateMany({classId:c._id},{$set:{expiresAt:c.expiresAt}});await db.collection("studyTogetherBoards").updateMany({classId:c._id},{$set:{expiresAt:c.expiresAt}});await db.collection("studyTogetherRooms").updateMany({classId:c._id},{$set:{classExpiresAt:c.expiresAt}});
  }else if(action==="class-delete"){
    if(r!=="owner")fail("Chỉ chủ lớp được xóa lớp.",403);
    if(body.confirmTitle!==c.title)fail("Nhập đúng tên lớp để xác nhận xóa.");
    c=await update(db,c,{status:"deleted",expiresAt:new Date(),title:"",description:"",schedule:"",members:[],memberIds:[],documents:[],pages:[],plan:null,reading:null,codeHash:randomBytes(32).toString("hex")},body.revision);
    await require("./study-campus").cleanup(db,c,true);
    await db.collection('studyTogetherBoardSnapshots').deleteMany({classId:c._id});
    await docs.deleteMany({classId:c._id});await sessions.deleteMany({classId:c._id});await db.collection("studyTogetherBoards").deleteMany({classId:c._id});
    const rooms=await db.collection("studyTogetherRooms").find({classId:c._id,status:"active"}).limit(100).toArray();await db.collection("studyTogetherRooms").updateMany({classId:c._id},{$set:{status:"closed"}});
    let syncPending=false;for(const room of rooms)try{await client.deleteRoom(room._id);}catch{syncPending=true;}
    return {ok:true,deleted:true,syncPending};
  }else fail("Thao tác lớp chưa được hỗ trợ.");
  await publish(c).catch(()=>{});return {ok:true,class:present(c,user)};
}
module.exports={handle,access,role,manager,archive,active};
