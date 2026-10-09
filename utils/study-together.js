"use strict";
const { randomBytes, randomUUID, createHash, createHmac } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { AccessToken, RoomServiceClient, TrackSource } = require("livekit-server-sdk");
const { withApi, currentUser, enforceRateLimit, setCors } = require("./platform");
const core = require("../study-room-core");
const classroom = require("./study-classroom");
const teaches=(room,user)=>room.classId?["owner","assistant"].includes(room._role??room.roles?.[identity(user)]):room.ownerId===String(user._id);
const clean = (v, max = 120) => typeof v === "string" ? v.trim().slice(0, max) : "";
const fail = (message, statusCode = 400, code = "STUDY_INVALID") => { throw Object.assign(new Error(message), { statusCode, code }); };
const hash = v => createHash("sha256").update(v).digest("hex");
const identity = user => user._guest ? String(user._id) : "u_" + String(user._id);
const guestSecret = config => createHmac("sha256", config.secret).update("hh-study-guest-session.v1").digest("hex");
function readGuestSession(token, config) {
  try {
    const d=jwt.verify(token,guestSecret(config),{algorithms:["HS256"],issuer:"hh-study-guest",audience:"hh-study-together-api",clockTolerance:2});
    if(d.guest!==true||!/^g_[a-f0-9]{32}$/.test(d.sub)||typeof d.roomId!=="string"||!d.roomId.startsWith("hh-study-")||!clean(d.name,40))throw Error();
    return {_id:d.sub,name:clean(d.name,40),_guest:true,_roomId:d.roomId};
  } catch { fail("Phiên khách không hợp lệ hoặc đã hết hạn. Vào lại bằng mã mời.",401,"GUEST_SESSION_INVALID"); }
}
function guestSession(user,room,config) {
  const expiresAt=Math.min(new Date(room.expiresAt).getTime(),Date.now()+86400000);
  return {id:user._id,name:user.name,roomId:room._id,expiresAt,token:jwt.sign({guest:true,roomId:room._id,name:user.name},guestSecret(config),{algorithm:"HS256",issuer:"hh-study-guest",audience:"hh-study-together-api",subject:user._id,expiresIn:Math.max(1,Math.floor((expiresAt-Date.now())/1000))})};
}
const safeSettings = (input = {}, previous = {}) => {
  input = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  previous = previous && typeof previous === "object" ? previous : {};
  return Object.fromEntries(["waitingRoom", "allowScreenShare", "allowMicrophone", "chatEnabled", "allowGuests", "guestApproval", "allowWhiteboard"].map(k => [k, typeof input[k] === "boolean" ? input[k] : previous[k] ?? (k !== "waitingRoom")]));
};
const safeAgenda = input => ({
  revision: Number.isSafeInteger(input?.revision) && input.revision >= 0 ? input.revision : 0,
  goal: clean(input?.goal, 240),
  items: Array.isArray(input?.items) ? input.items.slice(0, 6).filter(item => clean(item?.text, 120)).map(item => ({ text: clean(item.text, 120), done: item.done === true, ...(typeof item.assignee === "string" && /^(u_[a-f0-9]{24}|g_[a-f0-9]{32})$/i.test(item.assignee) ? {assignee:item.assignee} : {}) })) : []
});
const init = new WeakMap();
function configuration(env = process.env) {
  try {
    const url = new URL(env.LIVEKIT_URL || "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!["wss:", "https:"].includes(url.protocol) && !(env.NODE_ENV !== "production" && local && ["ws:", "http:"].includes(url.protocol))) return null;
    if (url.username || url.password || url.search || url.hash || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return null;
    return { wsUrl: url.href.replace(/^http/, "ws").replace(/\/$/, ""), httpUrl: url.href.replace(/^ws/, "http").replace(/\/$/, ""), key: env.LIVEKIT_API_KEY, secret: env.LIVEKIT_API_SECRET };
  } catch { return null; }
}
async function indexes(db) {
  if (!init.has(db)) init.set(db, Promise.all([
    db.collection("studyTogetherRooms").createIndex({ codeHash: 1 }, { unique: true }),
    db.collection("studyTogetherRooms").createIndex({ ownerId: 1, createdAt: -1 }),
    db.collection("studyTogetherRooms").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("studyTogetherMembers").createIndex({ roomId: 1, state: 1 }),
    db.collection("studyTogetherMembers").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("studyTogetherMembers").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("studyTogetherBoards").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('studyTogetherBoardSnapshots').createIndex({expiresAt:1},{expireAfterSeconds:0})
  ]).catch(e => { init.delete(db); throw e; }));
  await init.get(db);
}
function publicRoom(room, user) {
  return { id: room._id, classId:room.classId||null,classExpiresAt:room.classExpiresAt||null,parentRoomId:room.parentRoomId||null,roles:room.roles||{},role:room._role??room.roles?.[identity(user)]??(room.ownerId===String(user._id)?"owner":"member"),title: room.title, capacity: room.capacity, settings: safeSettings(room.settings), settingsRevision:room.settingsRevision||0, locked:room.locked===true, inviteActive:room.inviteActive!==false, controlRevision:room.controlRevision||0, timer: room.timer || null, agenda: safeAgenda(room.agenda), poll:core.publicPoll(room.poll,identity(user)), hands:room.handState?.items||[], handRevision:room.handState?.revision||0,floor:room.floor||null,spotlight:room.spotlight||null,groupInfo:room.groupInfo||null, boardRevision:room.boardRevision||0, host: !user._guest && teaches(room,user), hostIdentity: "u_" + room.ownerId, expiresAt: room.expiresAt, status: room.status };
}
function permissions(room, isHost = false, isPresenter = false) {
  const s = safeSettings(room.settings);
  return { canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false, canPublishSources: [TrackSource.CAMERA, ...(isHost || isPresenter || s.allowMicrophone ? [TrackSource.MICROPHONE] : []), ...(isHost || isPresenter || s.allowScreenShare ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [])] };
}
const metadata = room => JSON.stringify({ kind: "hh-study-together", hostIdentity: "u_" + room.ownerId, classId:room.classId||null,roles:room.roles||{}, settings: safeSettings(room.settings), settingsRevision:room.settingsRevision||0, locked:room.locked===true, inviteActive:room.inviteActive!==false, controlRevision:room.controlRevision||0, timer: room.timer || null, agenda: safeAgenda(room.agenda), poll:core.publicPoll(room.poll), hands:room.handState?.items||[], handRevision:room.handState?.revision||0,floor:room.floor||null,spotlight:room.spotlight||null,groupInfo:room.groupInfo||null, boardRevision:room.boardRevision||0 });
async function publishState(client, room) {
  try { await client.updateRoomMetadata(room._id, metadata(room)); return false; } catch { return true; }
}
async function mutateFeature(rooms, roomId, field, change) {
  for(let attempt=0;attempt<4;attempt++) {
    const current=await rooms.findOne({_id:roomId,status:"active",expiresAt:{$gt:new Date()}});
    if(!current)fail("Phòng đã kết thúc hoặc hết hạn.",404,"ROOM_NOT_FOUND");
    const next=await change(current[field],current);
    if(next.duplicate)return current;
    const result=await rooms.updateOne({_id:roomId,status:"active",[field+".revision"]:current[field]?.revision===undefined?{$exists:false}:current[field].revision},{$set:{[field]:next,updatedAt:new Date()}});
    if(result.matchedCount)return await rooms.findOne({_id:roomId});
  }
  fail("Dữ liệu đang được cập nhật. Làm mới và thử lại.",409,"STUDY_CONFLICT");
}
async function remote(work) {
  try { return await work(); } catch { fail("Không kết nối được LiveKit. Kiểm tra máy chủ và thử lại.", 503, "LIVEKIT_UNAVAILABLE"); }
}
async function ensureRoom(client, room) {
  return remote(() => client.createRoom({ name: room._id, maxParticipants: room.capacity, emptyTimeout: 600, departureTimeout: 120, metadata: metadata(room) }));
}
async function joinToken(config, room, user) {
  const token = new AccessToken(config.key, config.secret, { identity: identity(user), name: clean(user.name || "Người học", 80), ttl: 90, metadata: JSON.stringify({ role: user._guest ? "guest" : room.ownerId === String(user._id) ? "host" : "learner" }) });
  token.addGrant({ room: room._id, roomJoin: true, ...permissions(room,teaches(room,user),(room._role??room.roles?.[identity(user)])==="presenter") });
  return token.toJwt();
}
async function handle(req, res, { db, body = {}, user, config, client, rateLimit = enforceRateLimit }) {
  const action = req.method === "GET" ? clean(req.query.action) : clean(body.action);
  const bearer=String(req.headers?.authorization||"").replace(/^Bearer\s+/i,"");
  if (!user?._id && !bearer && !(["join","preview"].includes(action)&&req.method==="POST")) fail("Đăng nhập để tạo hoặc quản lý phòng; khách có thể tham gia bằng mã mời.",401,"AUTH_REQUIRED");
  if (Array.isArray(user?.restrictedFeatures) && user.restrictedFeatures.some(id => ["learn", "study-together"].includes(id))) fail("Tài khoản chưa được phép dùng phòng học chung.", 403);
  if (!config) fail("Chưa cấu hình LiveKit.", 503, "LIVEKIT_NOT_CONFIGURED");
  if(!user?._id&&bearer)user=readGuestSession(bearer,config);
  const bootstrap=!user?._id;
  if(bootstrap){
    const ip=String(req.headers?.["x-vercel-forwarded-for"]||req.headers?.["x-forwarded-for"]||req.socket?.remoteAddress||"unknown").split(",")[0].trim();
    await rateLimit(db,"study:guest-bootstrap:"+createHmac("sha256",guestSecret(config)).update(ip).digest("hex"),60,600000);
  }
  await indexes(db);
  const rooms = db.collection("studyTogetherRooms"), members = db.collection("studyTogetherMembers");
  let uid=user?String(user._id):"",issuedGuest=null;
  if (req.method !== "GET" && req.method !== "POST") fail("Phương thức không được hỗ trợ.", 405);
  if(uid)await rateLimit(db, "study:" + uid + ":" + (req.method === "GET" ? "read" : action), req.method === "GET" || action==="board" ? 120 : 25, 60000);
  if(user?._guest&&!["join","status","leave","preview","board","vote","hand"].includes(action))fail("Khách chỉ được tham gia phòng đã mời, không được quản lý phòng.",403,"HOST_ONLY");
  if(action.startsWith("campus-"))return res.status(200).json(await require("./study-campus").handle({action,body:req.method==="GET"?req.query:body,user,db,rateLimit}));
  if(action.startsWith("class-")){
    const payload=req.method==="GET"?req.query:body;
    const result=await classroom.handle({action,body:payload,user,db,client,create:async options=>({_responded:true,response:await handle({...req,method:"POST"},res,{db,user,config,client,rateLimit,body:{action:"create",...options}})}),join:async roomId=>({_responded:true,response:await handle({...req,method:"POST"},res,{db,user,config,client,rateLimit,body:{action:"join",roomId}})}),publish:async()=>{},moderate:async(c,target,role)=>{
      const rows=await rooms.find({classId:c._id,status:"active",expiresAt:{$gt:new Date()}}).limit(100).toArray(),roles=Object.fromEntries(c.members.map(m=>["u_"+m.userId,m.role]));
      let syncPending=false;for(const room of rows){await rooms.updateOne({_id:room._id},{$set:{roles}});const missed=e=>{if(e.code!=="not_found")syncPending=true;};if(role==="blocked"){await members.updateOne({_id:room._id+":"+target},{$set:{state:"blocked"}});await client.removeParticipant(room._id,"u_"+target,{revokeTokenTs:BigInt(Math.floor(Date.now()/1000)+1)}).catch(missed);}else await client.updateParticipant(room._id,"u_"+target,{permission:permissions(room,["owner","assistant"].includes(role),role==="presenter")}).catch(missed);syncPending=await publishState(client,{...room,roles})||syncPending;}return syncPending;
    }});
    // Room create/join hooks already wrote their response.
    return result?._responded?result.response:result?.ok?res.status(200).json(result):result;
  }
  if (action === "rooms" && req.method === "GET") {
    const owned = await rooms.find({ ownerId: uid, status: "active", expiresAt: { $gt: new Date() } }, { maxTimeMS: 5000 }).sort({ createdAt: -1 }).limit(20).toArray();
    const memberships=await members.find({userId:uid,state:"admitted",expiresAt:{$gt:new Date()}},{maxTimeMS:5000}).sort({updatedAt:-1}).limit(20).toArray();
    const joined=await rooms.find({_id:{$in:memberships.map(m=>m.roomId)},status:"active",expiresAt:{$gt:new Date()}},{maxTimeMS:5000}).sort({updatedAt:-1}).limit(20).toArray();
    const allowed=new Set(),cache=new Map();for(const row of [...owned,...joined]){if(row.classId){if(!cache.has(row.classId))try{cache.set(row.classId,await classroom.access(db,row.classId,user));}catch{cache.set(row.classId,null);}const c=cache.get(row.classId);if(!c)continue;row._role=classroom.role(c,user);}allowed.add(row._id);}
    return res.status(200).json({ ok: true, rooms: owned.filter(r=>allowed.has(r._id)).map(r => publicRoom(r, user)),joinedRooms:joined.filter(r=>r.ownerId!==uid&&allowed.has(r._id)).map(r=>publicRoom(r,user)) });
  }
  if (action === "create" && req.method === "POST") {
    const cls=body.classId?await classroom.access(db,body.classId,user):null;
    if(cls&&!classroom.manager(classroom.role(cls,user)))fail("Chỉ chủ lớp/trợ giảng được mở phiên.",403);
    if(cls&&await rooms.countDocuments({classId:cls._id,status:"active",expiresAt:{$gt:new Date()}})>=8)fail("Lớp đạt 8 phiên/nhóm đang mở. Đóng phiên cũ trước.",409);
    if(body.parentRoomId&&await rooms.countDocuments({parentRoomId:body.parentRoomId,status:"active",expiresAt:{$gt:new Date()}})>=4)fail("Tối đa 4 nhóm nhỏ trong phiên.",409);
    if(body.parentRoomId){const parent=await rooms.findOne({_id:clean(body.parentRoomId,100),status:"active",expiresAt:{$gt:new Date()}});if(!parent||parent.classId!==(cls?._id)||!teaches({...parent,_role:cls?classroom.role(cls,user):undefined},user))fail("Không có quyền tạo nhóm trong phòng này.",403);}
    const title = clean(body.title, 100);
    if (!title) fail("Nhập tên phòng học.");
    if (await rooms.countDocuments({ ownerId: uid, status: "active", expiresAt: { $gt: new Date() } }) >= 5) fail("Bạn đang có 5 phòng. Kết thúc phòng cũ trước khi tạo thêm.", 409);
    const code = randomBytes(8).toString("hex").toUpperCase(), now = new Date();
    const room = { _id: "hh-study-" + randomUUID(), codeHash: hash(code), ownerId: uid, title, capacity: Math.max(2, Math.min(32, Math.floor(Number(body.capacity) || 12))), settings: safeSettings(body.settings), status: "active", createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 86400000),...(cls?{classId:cls._id,classExpiresAt:cls.expiresAt,roles:Object.fromEntries(cls.members.map(m=>["u_"+m.userId,m.role])),agenda:safeAgenda(cls.plan)}:{}),...(body.parentRoomId?{parentRoomId:body.parentRoomId}:{}) };
    await ensureRoom(client, room);
    try { await rooms.insertOne(room); } catch (e) { await client.deleteRoom(room._id).catch(() => {}); throw e; }
    await members.updateOne({ _id: room._id + ":" + uid }, { $set: { roomId: room._id, userId: uid, name: clean(user.name, 80), state: "admitted", updatedAt: now, expiresAt: room.expiresAt } }, { upsert: true });
    if(cls)await db.collection("studyTogetherClassSessions").insertOne({_id:room._id,classId:cls._id,title,status:"active",startedAt:now,expiresAt:cls.expiresAt,...(body.parentRoomId?{parentRoomId:body.parentRoomId}:{})});
    return res.status(201).json({ ok: true, code, room: publicRoom(room, user), token: await joinToken(config, room, user), wsUrl: config.wsUrl });
  }
  const roomId = clean(req.method === "GET" ? req.query.roomId : body.roomId, 100);
  const code = clean(body.code, 32).replace(/[\s-]/g, "").toUpperCase();
  if(bootstrap&&!/^[A-F0-9]{16}$/.test(code))fail("Nhập mã mời 16 ký tự hợp lệ để tham gia.",400,"INVITE_REQUIRED");
  let room = await rooms.findOne(["join","preview"].includes(action) && code ? { codeHash: hash(code) } : { _id: roomId });
  if (!room || (room.status !== "active" && !(action === "close" && (room.ownerId === uid||room.classId) && room.status === "closed")) || new Date(room.expiresAt) <= new Date()) fail("Phòng không tồn tại, đã hết hạn hoặc đã kết thúc.", 404, "ROOM_NOT_FOUND");
  const policy=safeSettings(room.settings);
  const cls=room.classId&&user&&!user._guest?await classroom.access(db,room.classId,user):null;
  if(room.classId&&action!=="preview"&&!cls)fail("Đăng nhập và tham gia lớp trước khi vào phiên.",403,"CLASS_ACCESS");
  if(cls)room._role=classroom.role(cls,user);
  if(action==="preview"&&req.method==="POST") {
    if(!/^[A-F0-9]{16}$/.test(code)||room.inviteActive===false)fail("Lời mời không hợp lệ.",404,"INVITE_INVALID");
    return res.status(200).json({ok:true,invitation:{title:room.title,capacity:room.capacity,settings:policy,locked:room.locked===true,expiresAt:room.expiresAt}});
  }
  if(bootstrap){
    if(!policy.allowGuests)fail("Chủ phòng đang tắt nhận khách. Đăng nhập HH hoặc dùng phòng khác.",403,"GUESTS_DISABLED");
    const name=clean(body.displayName,80).replace(/[\x00-\x1f\x7f]/g,"").slice(0,40).trim();
    if(!name)fail("Nhập tên hiển thị để vào phòng với tư cách khách.",400,"GUEST_NAME_REQUIRED");
    uid="g_"+randomBytes(16).toString("hex");user={_id:uid,name,_guest:true,_roomId:room._id};
    issuedGuest=guestSession(user,room,config);
  }
  if(user._guest&&user._roomId!==room._id)fail("Phiên khách chỉ dùng được cho phòng đã mời.",403,"GUEST_ROOM_SCOPE");
  if(user._guest&&action==="join"&&!policy.allowGuests)fail("Chủ phòng đã tắt nhận khách.",403,"GUESTS_DISABLED");
  const isHost = teaches(room,user), memberKey = room._id + ":" + uid;
  let member = await members.findOne({ _id: memberKey });
  if (action === "join" && req.method === "POST") {
    // A room ID is not an invitation. Returning hosts/admitted members may rejoin by ID.
    if (!code && !isHost && member?.state !== "admitted") fail("Nhập mã mời hợp lệ để tham gia.", 403);
    if (member?.state === "blocked") fail("Bạn không còn được phép tham gia phòng này.", 403, "ROOM_BLOCKED");
    if(room.locked===true&&!isHost&&member?.state!=="admitted")fail("Phòng đang khóa nhận người mới. Chủ phòng cần mở lại.",403,"ROOM_LOCKED");
    const needsApproval=policy.waitingRoom||(user._guest&&policy.guestApproval);
    const state = isHost || !needsApproval || member?.state === "admitted" ? "admitted" : "waiting";
    if(state==="waiting"&&!member&&await members.countDocuments({roomId:room._id,state:"waiting"})>=50)fail("Phòng chờ đang đầy. Chủ phòng cần xử lý yêu cầu trước.",409,"WAITING_ROOM_FULL");
    try { await members.updateOne({ _id: memberKey, state: { $ne: "blocked" } }, { $set: { roomId: room._id, userId: uid, name: clean(user.name || "Người học", 80), guest:Boolean(user._guest), state, updatedAt: new Date(), expiresAt: room.expiresAt } }, { upsert: true }); }
    catch (e) { if (e.code === 11000) fail("Bạn không còn được phép tham gia phòng này.", 403, "ROOM_BLOCKED"); throw e; }
    if (state === "waiting") return res.status(200).json({ ok: true, waiting: true, room: publicRoom(room, user),...(issuedGuest?{guestSession:issuedGuest}:{}) });
    await ensureRoom(client, room);
    // Remote setup can yield; re-check closure, blocking and current publish policy before minting.
    const latest = await rooms.findOne({ _id: room._id, status: "active", expiresAt: { $gt: new Date() } });
    member = await members.findOne({ _id: memberKey, state: "admitted" });
    if (!latest || !member) fail("Quyền tham gia đã thay đổi. Kiểm tra lại phòng.", 403, "ROOM_ACCESS_CHANGED");
    if(latest.classId){const currentClass=await classroom.access(db,latest.classId,user);latest._role=classroom.role(currentClass,user);}
    if(user._guest&&!safeSettings(latest.settings).allowGuests)fail("Chủ phòng đã tắt nhận khách.",403,"GUESTS_DISABLED");
    return res.status(200).json({ ok: true, room: publicRoom(latest, user), token: await joinToken(config, latest, user), wsUrl: config.wsUrl,...(issuedGuest?{guestSession:issuedGuest}:{}) });
  }
  if (!isHost && !["waiting", "admitted"].includes(member?.state)) fail("Bạn không có quyền xem phòng này.", 403);
  if (action === "status" && req.method === "GET") {
    if (!isHost && member.state === "waiting") return res.status(200).json({ ok: true, waiting: true, room: publicRoom(room, user) });
    const participants = await remote(() => client.listParticipants(room._id));
    const waiting = isHost ? await members.find({ roomId: room._id, state: "waiting" }, { projection: { userId: 1, name: 1, guest:1, updatedAt: 1 }, maxTimeMS: 5000 }).sort({ updatedAt: 1 }).limit(50).toArray() : [];
    return res.status(200).json({ ok: true, room: publicRoom(room, user), waiting: false, requests: waiting.map(m => ({ userId: m.userId, name: m.name, guest:Boolean(m.guest), at: m.updatedAt })), participants: participants.map(p => ({ identity: p.identity, name: p.name, tracks: (p.tracks || []).map(t => ({ sid: t.sid, source: t.source, muted: t.muted })) })) });
  }
  if(action==="groups"&&req.method==="GET"){const rootId=room.parentRoomId||room._id,rows=await rooms.find({parentRoomId:rootId,status:"active",expiresAt:{$gt:new Date()}}).limit(4).toArray(),parent=await rooms.findOne({_id:rootId,status:"active"});return res.status(200).json({ok:true,groups:[...(parent?[parent]:[]),...rows].map(r=>({id:r._id,title:r.title,info:r.groupInfo||null}))});}
  if(action==="group-join"&&req.method==="POST"){
    const rootId=room.parentRoomId||room._id,target=await rooms.findOne({_id:clean(body.targetId,100),status:"active",expiresAt:{$gt:new Date()}});
    if(user._guest||member?.state!=="admitted"&&!isHost||!target||(target.parentRoomId||target._id)!==rootId)fail("Cần là thành viên HH đã duyệt của nhóm.",403);
    const rootMember=await members.findOne({_id:rootId+":"+uid});if(rootMember?.state==="blocked")fail("Bạn đã bị chặn khỏi phiên chính.",403);
    await members.updateOne({_id:target._id+":"+uid,state:{$ne:"blocked"}},{$set:{roomId:target._id,userId:uid,name:clean(user.name,80),state:"admitted",expiresAt:target.expiresAt,updatedAt:new Date()}},{upsert:true});
    return handle({...req,method:"POST"},res,{db,user,config,client,rateLimit,body:{action:"join",roomId:target._id}});
  }
  if(action==="board-pages"){
    if(!isHost&&member?.state!=="admitted")fail("Cần được duyệt trước khi xem trang.",403);
    let pages=cls?.pages||room.pageState?.items||[{id:"main",title:"Trang 1"}];
    if(req.method==="POST"){if(!isHost)fail("Chỉ người điều phối được thêm trang.",403);if(pages.length>=8||!clean(body.title,60))fail("Tối đa 8 trang; cần tên trang.");const item={id:"p_"+randomUUID().replaceAll("-",""),title:clean(body.title,60)};
      if(cls){await classroom.handle({action:"class-page",body:{classId:cls._id,revision:cls.revision,title:item.title},user,db,client,publish:async()=>{}});pages=(await classroom.access(db,cls._id,user)).pages;}else{room=await mutateFeature(rooms,room._id,"pageState",state=>({revision:(state?.revision||0)+1,items:[...(state?.items||pages),item]}));pages=room.pageState.items;}
    }
    return res.status(200).json({ok:true,pages});
  }
  if(action==="board-snapshot"){
    if(!isHost&&member?.state!=="admitted")fail("Cần được duyệt vào phòng.",403);
    const pageId=clean(req.method==="GET"?req.query.pageId:body.pageId,64)||"main",pages=cls?.pages||room.pageState?.items||[{id:"main"}];if(!pages.some(p=>p.id===pageId))fail("Trang không tồn tại.",404);
    const boardId=cls?cls._id+":"+pageId:pageId==="main"?room._id:room._id+":"+pageId,boards=db.collection("studyTogetherBoards"),snapshots=db.collection("studyTogetherBoardSnapshots");
    if(req.method==="GET"){const rows=await snapshots.find({boardId,expiresAt:{$gt:new Date()}}).sort({at:-1}).limit(3).toArray();return res.status(200).json({ok:true,snapshots:rows.map(({_id,title,at,revision})=>({id:_id,title,at,revision}))});}
    if(req.method!=="POST"||!isHost)fail("Chỉ người điều phối được tạo/phục hồi snapshot.",403);
    const board=await boards.findOne({_id:boardId});if(!board)fail("Chưa có bảng đã lưu.",404);
    if(body.mode==="save"){const title=clean(body.title,80);if(!title)fail("Nhập tên snapshot.");if(await snapshots.countDocuments({boardId})>=3)fail("Tối đa 3 snapshot/trang. Xóa bản cũ trước.",409);let stored=false;for(let slot=0;slot<3;slot++){try{await snapshots.insertOne({_id:boardId+"@snapshot"+slot,boardId,...(cls?{classId:cls._id}:{roomId:room._id}),title,at:new Date(),revision:board.revision,objects:board.objects,expiresAt:cls?.expiresAt||room.expiresAt});stored=true;break;}catch(e){if(e.code!==11000)throw e;}}if(!stored)fail("Tối đa 3 snapshot/trang.",409);return res.status(200).json({ok:true});}
    const snap=await snapshots.findOne({_id:body.snapshotId,boardId,expiresAt:{$gt:new Date()}});if(!snap)fail("Snapshot không tồn tại.",404);
    if(body.mode==="delete"){await snapshots.deleteOne({_id:snap._id,boardId});return res.status(200).json({ok:true});}
    if(body.mode!=="restore"||body.confirm!==true||body.revision!==board.revision)fail("Xác nhận phục hồi và tải bản mới nếu bảng đã đổi.",409,"BOARD_CONFLICT");
    const objects=snap.objects.map(o=>core.boardObject(o,o.owner,(board.objects.find(x=>x.id===o.id)?.version||board.tombstones.find(x=>x.id===o.id)?.version||0)+1)),keep=new Set(objects.map(o=>o.id)),removed=board.objects.filter(o=>!keep.has(o.id)).map(o=>({id:o.id,owner:o.owner,version:o.version+1})),tombstones=[...board.tombstones.filter(o=>!keep.has(o.id)&&!removed.some(x=>x.id===o.id)),...removed].slice(-256),next={objects,tombstones,revision:board.revision+1,batches:[]};
    const result=await boards.updateOne({_id:boardId,revision:body.revision},{$set:next});if(!result.matchedCount)fail("Bảng vừa thay đổi. Không phục hồi đè bản mới.",409,"BOARD_CONFLICT");
    await rooms.updateOne({_id:room._id},{$inc:{boardRevision:1}});room=await rooms.findOne({_id:room._id});return res.status(200).json({ok:true,room:publicRoom(room,user),syncPending:await publishState(client,room)});
  }
  if(["board","vote","hand"].includes(action)) {
    if(!isHost&&member?.state!=="admitted")fail("Cần được duyệt vào phòng trước khi dùng công cụ học nhóm.",403,"ADMISSION_REQUIRED");
    const actor=identity(user);
    if(action==="board") {
      const pageId=clean(req.method==="GET"?req.query.pageId:body.pageId,64)||"main",pages=cls?.pages||room.pageState?.items||[{id:"main"}];
      if(!pages.some(page=>page.id===pageId))fail("Trang bảng trắng không tồn tại.",404);
      const boardId=cls?cls._id+":"+pageId:pageId==="main"?room._id:room._id+":"+pageId;
      const boards=db.collection("studyTogetherBoards"),empty={revision:0,objects:[],tombstones:[],batches:[]};
      if(req.method==="GET"){const board=await boards.findOne({_id:boardId})||empty;return res.status(200).json({ok:true,board:{revision:board.revision,objects:board.objects,tombstones:board.tombstones}});}
      if(req.method!=="POST")fail("Phương thức không được hỗ trợ.",405);
      if(!isHost&&!policy.allowWhiteboard)fail("Chủ phòng đã tắt quyền vẽ của thành viên.",403,"BOARD_DISABLED");
      let board=await boards.findOne({_id:boardId});
      if(!board){try{await boards.insertOne({_id:boardId,...empty,pageId,...(cls?{classId:cls._id}:{}),expiresAt:cls?.expiresAt||room.expiresAt});}catch(e){if(e.code!==11000)throw e;}board=await boards.findOne({_id:boardId});}
      let next;
      for(let attempt=0;attempt<4;attempt++) {
        const currentRoom=await rooms.findOne({_id:room._id,status:"active",expiresAt:{$gt:new Date()}});
        const currentMember=isHost?member:await members.findOne({_id:memberKey,state:"admitted"});
        if(!currentRoom||!isHost&&(!currentMember||!safeSettings(currentRoom.settings).allowWhiteboard))fail("Quyền vẽ hoặc trạng thái phòng đã thay đổi.",403,"BOARD_DISABLED");
        next=core.applyBoard(board,body.operations,actor,isHost,body.batchId);
        if(next.duplicate)break;
        const result=await boards.updateOne({_id:boardId,revision:board.revision},{$set:{...next,updatedAt:new Date()}});
        if(result.matchedCount)break;
        if(attempt===3)fail("Bảng đang được cập nhật. Tải bản mới và thử lại.",409,"BOARD_CONFLICT");
        board=await boards.findOne({_id:boardId});
      }
      await rooms.updateOne({_id:room._id,status:"active"},{$inc:{boardRevision:next.duplicate?0:1}});
      room=await rooms.findOne({_id:room._id});
      const syncPending=await publishState(client,room);
      return res.status(200).json({ok:true,board:{revision:next.revision,objects:next.objects,tombstones:next.tombstones},room:publicRoom(room,user),syncPending});
    }
    if(req.method!=="POST")fail("Phương thức không được hỗ trợ.",405);
    if(action==="vote")room=await mutateFeature(rooms,room._id,"poll",poll=>core.votePoll(poll,actor,body.choice,body.pollId));
    if(action==="hand") {
      if(typeof body.raised!=="boolean")fail("Trạng thái giơ tay không hợp lệ.");
      room=await mutateFeature(rooms,room._id,"handState",state=>{const items=state?.items||[],exists=items.some(item=>item.identity===actor);if(exists===body.raised)return {...state,duplicate:true};return {revision:(state?.revision||0)+1,items:body.raised?[...items,{identity:actor,name:clean(user.name,80),at:Date.now()}].sort((a,b)=>a.at-b.at).slice(0,32):items.filter(item=>item.identity!==actor)};});
    }
    return res.status(200).json({ok:true,room:publicRoom(room,user),syncPending:await publishState(client,room)});
  }
  if (req.method !== "POST") fail("Phương thức không được hỗ trợ.", 405);
  if (action === "leave") return res.status(200).json({ ok: true });
  if (!isHost) fail("Chỉ chủ phòng được dùng thao tác này.", 403, "HOST_ONLY");
  if(action==="spotlight"||action==="floor"){
    const target=clean(body.identity,100),participants=await remote(()=>client.listParticipants(room._id));if(target&&!participants.some(p=>p.identity===target))fail("Người này không còn kết nối.",404);
    if(action==="spotlight"){room=await mutateFeature(rooms,room._id,"spotlight",state=>({revision:(state?.revision||0)+1,identity:target||null}));}
    else{if(!["speaking","handled","clear"].includes(body.mode)||body.mode!=="clear"&&!room.handState?.items.some(p=>p.identity===target))fail("Chọn người trong hàng đợi thật.");room=await mutateFeature(rooms,room._id,"floor",state=>({revision:(state?.revision||0)+1,identity:body.mode==="speaking"?target:null}));if(body.mode==="handled")room=await mutateFeature(rooms,room._id,"handState",state=>({revision:(state?.revision||0)+1,items:(state?.items||[]).filter(p=>p.identity!==target)}));}
    return res.status(200).json({ok:true,room:publicRoom(room,user),syncPending:await publishState(client,room)});
  }
  if(action==="group-info"||action==="group-broadcast"){
    const rootId=room.parentRoomId||room._id,rootRoom=await rooms.findOne({_id:rootId,status:"active",expiresAt:{$gt:new Date()}});if(!rootRoom)fail("Phiên chính đã đóng.",404);
    const rows=await rooms.find({parentRoomId:rootId,status:"active",expiresAt:{$gt:new Date()}}).limit(4).toArray(),targets=action==="group-broadcast"?rows:rows.filter(r=>r._id===body.targetId);if(!targets.length)fail("Chưa có nhóm phù hợp.",404);
    const topic=clean(body.topic,160),notice=clean(body.notice,500),leaderId=clean(body.leader,100),minutes=Number(body.minutes||0);
    if(!Number.isInteger(minutes)||minutes<0||minutes>120)fail("Hẹn giờ nhóm 0–120 phút.");
    if(leaderId&&!await members.findOne({_id:rootId+":"+leaderId.replace(/^u_/,""),state:"admitted"}))fail("Người phụ trách phải được duyệt trong phiên chính.");
    if(body.assignIdentity){const target=targets[0],targetId=clean(body.assignIdentity,100);if(!/^u_[a-f0-9]{24}$/.test(targetId)||!await members.findOne({_id:rootId+":"+targetId.slice(2),state:"admitted"}))fail("Chỉ phân công thành viên HH đã duyệt.",403);target._assigned=targetId;}
    let syncPending=false;for(const target of targets){const next=await mutateFeature(rooms,target._id,"groupInfo",previous=>({revision:(previous?.revision||0)+1,topic:action==="group-broadcast"?previous?.topic||"":topic,leader:action==="group-broadcast"?previous?.leader||"":leaderId,notice,deadline:minutes?Date.now()+minutes*60000:null,assignment:target._assigned||previous?.assignment||null,at:Date.now()}));syncPending=await publishState(client,next)||syncPending;}return res.status(200).json({ok:true,syncPending});
  }
  if(action==="room-lock"||action==="revoke-invite") {
    if(action==="room-lock"&&typeof body.locked!=="boolean")fail("Trạng thái khóa phòng không hợp lệ.");
    await rooms.updateOne({_id:room._id,status:"active"},{$set:action==="room-lock"?{locked:body.locked,updatedAt:new Date()}:{codeHash:hash(randomBytes(32).toString("hex")),inviteActive:false,updatedAt:new Date()},$inc:{controlRevision:1}});
    room=await rooms.findOne({_id:room._id});
    return res.status(200).json({ok:true,room:publicRoom(room,user),syncPending:await publishState(client,room)});
  }
  if(action==="poll-create"||action==="poll-close") {
    room=await mutateFeature(rooms,room._id,"poll",poll=>{
      if(action==="poll-create") {if(poll&&!poll.closed)fail("Đóng bình chọn hiện tại trước khi tạo câu hỏi mới.",409,"POLL_ACTIVE");return core.newPoll(body.question,body.options,randomUUID(),(poll?.revision||0)+1);}
      if(!poll||poll.id!==body.pollId)fail("Bình chọn không còn tồn tại.",404,"POLL_NOT_FOUND");
      return {...poll,closed:true,revision:poll.revision+1};
    });
    return res.status(200).json({ok:true,room:publicRoom(room,user),syncPending:await publishState(client,room)});
  }
  if (action === "rotate-invite") {
    const nextCode = randomBytes(8).toString("hex").toUpperCase();
    await rooms.updateOne({ _id: room._id, status: "active" }, { $set: { codeHash: hash(nextCode), inviteActive:true, updatedAt: new Date() }, $inc:{controlRevision:1} });
    room=await rooms.findOne({_id:room._id});
    return res.status(200).json({ ok: true, code: nextCode,room:publicRoom(room,user),syncPending:await publishState(client,room) });
  }
  if (action === "admit" || action === "reject") {
    const target = clean(body.userId, 80);
    const result = await members.updateOne({ _id: room._id + ":" + target, roomId: room._id, state: "waiting" }, { $set: { state: action === "admit" ? "admitted" : "blocked", updatedAt: new Date() } });
    if (!result.matchedCount) fail("Yêu cầu tham gia không còn tồn tại.", 409);
    return res.status(200).json({ ok: true });
  }
  if (action === "kick" || action === "mute") {
    const targetIdentity = clean(body.identity, 100);
    if (!/^(u_[a-f0-9]{24}|g_[a-f0-9]{32})$/i.test(targetIdentity) || targetIdentity === "u_" + room.ownerId) fail("Không thể thao tác trên chủ phòng hoặc người tham gia không hợp lệ.");
    const targetId=targetIdentity.startsWith("u_")?targetIdentity.slice(2):targetIdentity;
    const target = await members.findOne({ _id: room._id + ":" + targetId, state: "admitted" });
    if (!target) fail("Người tham gia không thuộc phòng này.", 404);
    if (action === "kick") {
      await members.updateOne({ _id: target._id }, { $set: { state: "blocked", updatedAt: new Date() } });
      await remote(() => client.removeParticipant(room._id, targetIdentity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) }));
    } else {
      const participant = await remote(() => client.getParticipant(room._id, targetIdentity));
      for (const track of participant.tracks || []) if (track.source === TrackSource.MICROPHONE && !track.muted) await remote(() => client.mutePublishedTrack(room._id, targetIdentity, track.sid, true));
    }
    return res.status(200).json({ ok: true });
  }
  if (action === "settings") {
    const revision=room.settingsRevision||0;
    if(body.revision!==undefined&&(!Number.isSafeInteger(body.revision)||body.revision!==revision))fail("Quyền phòng đã thay đổi. Bỏ bản sửa và lấy quyền mới trước khi áp dụng.",409,"SETTINGS_CONFLICT");
    const settings=safeSettings(body.settings,room.settings),result=await rooms.updateOne({_id:room._id,status:"active",settingsRevision:room.settingsRevision===undefined?{$exists:false}:revision},{$set:{settings,settingsRevision:revision+1,updatedAt:new Date()}});
    if(!result.matchedCount)fail("Quyền phòng đã thay đổi hoặc phòng đã đóng. Lấy trạng thái mới trước khi áp dụng.",409,"SETTINGS_CONFLICT");
    let syncPending=false;
    try{const participants=await client.listParticipants(room._id);for(const p of participants){const latest=await rooms.findOne({_id:room._id,status:"active"});if(!latest)fail("Phòng đã đóng.",404,"ROOM_NOT_FOUND");await client.updateParticipant(room._id,p.identity,{permission:permissions(latest,latest.classId?["owner","assistant"].includes(latest.roles?.[p.identity]):p.identity==="u_"+room.ownerId,latest.roles?.[p.identity]==="presenter")});}}catch{syncPending=true;}
    room=await rooms.findOne({_id:room._id});
    syncPending=await publishState(client,room)||syncPending;
    return res.status(200).json({ok:true,room:publicRoom(room,user),syncPending});
  }
  if (action === "agenda") {
    const previous = safeAgenda(room.agenda);
    if (!Number.isSafeInteger(body.revision) || body.revision !== previous.revision) fail("Kế hoạch đã thay đổi. Làm mới trạng thái phòng trước khi sửa tiếp.", 409, "AGENDA_CONFLICT");
    let next;
    if (body.index !== undefined) {
      if (!Number.isInteger(body.index) || !previous.items[body.index] || body.assignee===undefined&&typeof body.done !== "boolean") fail("Công việc hoặc trạng thái hoàn thành không hợp lệ.");
      if(body.assignee!==undefined&&body.assignee!=="") {const participants=await remote(()=>client.listParticipants(room._id));if(typeof body.assignee!=="string"||!participants.some(p=>p.identity===body.assignee))fail("Chọn một thành viên đang kết nối để phân công.");}
      next = { ...previous, items: previous.items.map((item, i) => i === body.index ? { ...item,...(body.assignee!==undefined?{assignee:body.assignee}:{done:body.done}) } : item) };
    } else {
      if (typeof body.goal !== "string" || body.goal.length > 240 || !Array.isArray(body.items) || body.items.length > 6 || body.items.some(text => typeof text !== "string" || !text.trim() || text.length > 120)) fail("Mục tiêu tối đa 240 ký tự; thêm tối đa 6 việc, mỗi việc tối đa 120 ký tự.");
      const goal=body.goal.trim(),items=body.items.map(text=>text.trim());
      if (new Set(items).size !== items.length) fail("Các công việc không được trùng nhau.");
      next = { goal, items: items.map(text => ({ text, done: previous.items.find(item => item.text === text)?.done === true,...(previous.items.find(item=>item.text===text)?.assignee?{assignee:previous.items.find(item=>item.text===text).assignee}:{}) })) };
    }
    next.revision = previous.revision + 1;
    const revisionFilter=room.agenda?.revision===undefined?{ $exists:false }:room.agenda.revision;
    const result=await rooms.updateOne({ _id:room._id,...(room.classId?{}:{ownerId:uid}), status:"active", "agenda.revision":revisionFilter },{ $set:{ agenda:next, updatedAt:new Date() } });
    if (!result.matchedCount) fail("Kế hoạch đã thay đổi hoặc phòng đã đóng. Làm mới trạng thái phòng.",409,"AGENDA_CONFLICT");
    const latest=await rooms.findOne({ _id:room._id });
    if (!latest || latest.status!=="active") fail("Phòng đã kết thúc.",404,"ROOM_NOT_FOUND");
    let syncPending=false;
    try { await client.updateRoomMetadata(room._id, metadata(latest)); } catch { syncPending=true; }
    return res.status(200).json({ ok:true, room:publicRoom(latest,user), syncPending });
  }
  if (action === "timer") {
    const mode = clean(body.mode, 12), duration = Math.max(60, Math.min(10800, Math.floor(Number(body.duration) || 1500)));
    const timer=core.nextTimer(room.timer,mode,duration,body.phase,randomUUID());
    const result=await rooms.updateOne({_id:room._id,status:"active","timer.revision":room.timer?.revision===undefined?{$exists:false}:room.timer.revision},{$set:{timer,updatedAt:new Date()}});
    if(!result.matchedCount)fail("Phiên học vừa thay đổi. Làm mới trạng thái phòng.",409,"TIMER_CONFLICT");
    room=await rooms.findOne({_id:room._id});
    return res.status(200).json({ok:true,room:publicRoom(room,user),syncPending:await publishState(client,room)});
  }
  if (action === "close") {
    const closedAt=room.closedAt||new Date();
    await rooms.updateOne({ _id: room._id,...(room.classId?{}:{ownerId:uid}), status: "active" }, { $set: { status: "closed",closedAt, updatedAt: new Date() } });
    await classroom.archive(db,{...await rooms.findOne({_id:room._id}),status:"closed"});
    const children=await rooms.find({parentRoomId:room._id}).limit(4).toArray();
    for(const child of children){await rooms.updateOne({_id:child._id},{$set:{status:"closed",closedAt}});await classroom.archive(db,{...child,status:"closed",closedAt});await remote(()=>client.deleteRoom(child._id).catch(e=>{if(e.code!=="not_found")throw e;}));}
    await remote(() => client.deleteRoom(room._id).catch(e => { if (e.code !== "not_found") throw e; }));
    return res.status(200).json({ ok: true });
  }
  fail("Thao tác không được hỗ trợ.");
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.query.action === "config") {
    setCors(req, res);
    return res.status(200).json({ ok: true, configured: Boolean(configuration()), provider: "LiveKit", maxParticipants: 32, authenticationRequired: false, hostAuthenticationRequired:true, guestInvites:true });
  }
  return withApi(req, res, async ({ db, body }) => {
    const config = configuration();
    return handle(req, res, { db, body, user: await currentUser(req), config, client: config ? new RoomServiceClient(config.httpUrl, config.key, config.secret, { requestTimeout: 8 }) : null });
  });
}
handler.__test = { handle, configuration, permissions, joinToken, publicRoom, safeSettings, readGuestSession, guestSecret };
module.exports = handler;
