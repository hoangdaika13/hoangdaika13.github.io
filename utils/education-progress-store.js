'use strict';
// Immutable chunks are published by one compare-and-set on the learner root.
// No acknowledged history is deleted by this transport.
const {createHash}=require('node:crypto');
const MAX_BYTES=32*1024*1024,MAX_PARTS=1024;
const sha=text=>createHash('sha256').update(text).digest('hex');
const fail=(status,message,code)=>Object.assign(Error(message),{statusCode:status,code});
const key=(owner,profile,transfer,index='meta')=>sha(JSON.stringify([String(owner),profile,transfer,index]));
const manifest=meta=>({id:meta.transferId,parts:meta.parts,bytes:meta.bytes,version:1});
function summary(state){return{attempts:(state.attempts||[]).length,mistakes:(state.mistakes||[]).length,due:(state.reviews||[]).filter(r=>Date.parse(r.dueAt)<=Date.now()).length,completedLessons:Object.values(state.progress||{}).filter(p=>p.status==='completed').length,skills:Object.keys(state.mastery||{}).length};}
function conflict(item,profile){return{ownerId:String(item?.ownerId||""),learnerProfileId:profile,serverState:item?.state||null,serverTransfer:item?.stateTransfer||null,serverRevision:Number(item?.revision||0),serverUpdatedAt:item?.updatedAt||null};}
function safeSnapshot(state){
  const pending=[{value:state,depth:0}];let nodes=0;
  while(pending.length){const {value,depth}=pending.pop();if(++nodes>1000000||depth>40)throw fail(413,'Cấu trúc lịch sử vượt giới hạn hỗ trợ; dữ liệu gốc được giữ.','PROGRESS_COMPLEXITY');if(value&&typeof value==='object')for(const [name,child]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(name.toLowerCase()))throw fail(400,'Lịch sử chứa trường không an toàn.','PROGRESS_FIELD_INVALID');pending.push({value:child,depth:depth+1});}}
}
function latestResponse(res,latest,profile,transferId){if(latest?.stateTransfer?.id===transferId)return res.status(200).json({ok:true,committed:true,revision:latest.revision,updatedAt:latest.updatedAt,learnerProfileId:profile});return res.status(409).json({error:'Hồ sơ đã đổi trong lúc công bố.',code:'PROGRESS_CONFLICT',conflict:conflict(latest,profile)});}
async function readPart(req,res,db,user,profile){
  if(req.query.scope==='linked')return res.status(403).json({error:'Báo cáo liên kết không cung cấp bài làm riêng.'});
  const transferId=String(req.query.snapshotId||''),index=Number(req.query.part);if(!/^[a-f0-9]{64}$/.test(transferId)||!Number.isInteger(index)||index<0||index>=MAX_PARTS)return res.status(400).json({error:'Phần lịch sử không hợp lệ.'});
  const meta=await db.collection('education_progress_transfers').findOne({_id:key(user._id,profile,transferId),ownerId:user._id,learnerProfileId:profile});
  const root=await db.collection('education_progress').findOne({ownerId:user._id,learnerProfileId:profile});
  if(!meta||index>=meta.parts||(!['committed','publishing'].includes(meta.status)&&root?.stateTransfer?.id!==transferId))return res.status(404).json({error:'Không có phiên bản lịch sử đã công bố cho hồ sơ này.'});
  const part=await db.collection('education_progress_parts').findOne({_id:key(user._id,profile,transferId,index),ownerId:user._id,learnerProfileId:profile});
  if(!part)return res.status(503).json({error:'Chưa đọc đủ phần lịch sử; giữ bản trên thiết bị.'});return res.status(200).json({index:part.index,text:part.text,digest:part.digest});
}
async function transfer(req,res,db,user,body,options){
  if(String(body.ownerId||'')!==String(user._id))return res.status(403).json({error:'Phiên đăng nhập đã đổi tài khoản; dữ liệu được giữ tại hồ sơ cũ.',code:'PROGRESS_OWNER_CHANGED'});
  const profile=String(body.learnerProfileId||''),transferId=String(body.transferId||''),baseRevision=Number(body.baseRevision);
  if(!/^[a-zA-Z0-9._-]{1,100}$/.test(profile)||!/^[a-f0-9]{64}$/.test(transferId)||!Number.isSafeInteger(baseRevision)||baseRevision<0)return res.status(400).json({error:'Cấu hình đồng bộ lịch sử không hợp lệ.'});
  const rootCollection=db.collection('education_progress'),metas=db.collection('education_progress_transfers'),parts=db.collection('education_progress_parts'),scope={ownerId:user._id,learnerProfileId:profile};
  const current=await rootCollection.findOne(scope),metaId=key(user._id,profile,transferId);let meta=await metas.findOne({_id:metaId,...scope});
  if(current?.stateTransfer?.id===transferId)return res.status(200).json({ok:true,committed:true,revision:current.revision,updatedAt:current.updatedAt,learnerProfileId:profile});
  if(body.action==='abort-transfer'&&meta){const locked=await metas.updateOne({_id:metaId,...scope,status:'staging'},{$set:{status:'aborting'}});if(!locked.matchedCount)return res.status(409).json({error:'Phiên đang công bố hoặc đã được lưu; hãy gửi lại để hoàn tất.'});await parts.deleteMany({...scope,transferId});await metas.deleteMany({_id:metaId,...scope,status:'aborting'});return res.status(200).json({ok:true});}
  if(Number(current?.revision||0)!==baseRevision)return res.status(409).json({error:'Tiến độ máy chủ đã thay đổi; hãy hợp nhất trước khi gửi tiếp.',code:'PROGRESS_CONFLICT',conflict:conflict(current,profile)});
  if(body.action==='begin-transfer'){
    if(!Number.isInteger(body.parts)||body.parts<1||body.parts>MAX_PARTS||!Number.isInteger(body.bytes)||body.bytes<1||body.bytes>MAX_BYTES)return res.status(413).json({error:'Lịch sử hỗ trợ tối đa 32 MB và 1024 phần.'});
    if(meta&&(meta.parts!==body.parts||meta.bytes!==body.bytes||meta.baseRevision!==baseRevision))return res.status(409).json({error:'Phiên tải đã có cấu hình khác.'});
    if(!meta){
      const active=await metas.countDocuments({...scope,status:'staging'});if(active>=3)return res.status(429).json({error:'Đã có 3 phiên đồng bộ chưa xong. Hãy tiếp tục phiên cũ hoặc hủy phiên không dùng.',code:'PROGRESS_TRANSFERS_PENDING'});
      meta={_id:metaId,...scope,transferId,parts:body.parts,bytes:body.bytes,baseRevision,status:'staging',createdAt:new Date()};try{await metas.insertOne(meta);}catch(error){if(error.code!==11000)throw error;meta=await metas.findOne({_id:metaId,...scope});}
    }
    const uploaded=await parts.find({...scope,transferId},{projection:{index:1}}).toArray();return res.status(200).json({ok:true,uploaded:uploaded.map(p=>p.index)});
  }
  if(!meta||!['staging','publishing'].includes(meta.status))return res.status(404).json({error:'Cần bắt đầu hoặc khôi phục phiên đồng bộ.'});
  if(body.action==='transfer-part'){
    if(meta.status!=='staging')return res.status(409).json({error:'Phiên đang công bố, không thay đổi phần lịch sử.'});
    if(!Number.isInteger(body.index)||body.index<0||body.index>=meta.parts||typeof body.text!=='string'||Buffer.byteLength(body.text,'utf8')>180000||sha(body.text)!==body.digest)return res.status(400).json({error:'Phần lịch sử không đúng kích thước hoặc checksum.'});
    const doc={_id:key(user._id,profile,transferId,body.index),...scope,transferId,index:body.index,text:body.text,digest:body.digest,bytes:Buffer.byteLength(body.text,'utf8'),createdAt:new Date()};
    await parts.updateOne({_id:doc._id,...scope},{$setOnInsert:doc},{upsert:true});const stored=await parts.findOne({_id:doc._id,...scope});if(stored.digest!==doc.digest)return res.status(409).json({error:'Phần lịch sử đã có nội dung khác.'});return res.status(200).json({ok:true,index:body.index});
  }
  if(body.action!=='commit-transfer')return res.status(400).json({error:'Thao tác đồng bộ chưa hỗ trợ.'});
  const sizes=await parts.find({...scope,transferId},{projection:{index:1,bytes:1}}).toArray();if(sizes.length!==meta.parts||sizes.reduce((n,p)=>n+Number(p.bytes||0),0)!==meta.bytes)return res.status(422).json({error:'Chưa đủ các phần hoặc dung lượng không khớp; bản máy chủ cũ được giữ.'});
  const saved=await parts.find({...scope,transferId}).sort({index:1}).toArray();if(saved.length!==meta.parts||saved.some((p,i)=>p.index!==i||sha(p.text)!==p.digest))return res.status(422).json({error:'Lịch sử chưa đủ phần; bản máy chủ cũ được giữ.'});
  const text=saved.map(p=>p.text).join('');if(Buffer.byteLength(text,'utf8')!==meta.bytes||sha(text)!==transferId)return res.status(422).json({error:'Checksum lịch sử chưa khớp; chưa công bố.'});
  let parsed;try{parsed=JSON.parse(text);}catch{return res.status(400).json({error:'Lịch sử không phải JSON hợp lệ.'});}safeSnapshot(parsed);if(parsed.role&&parsed.role!==options.roleOf(user))return res.status(403).json({error:'Vai trò trong phiên học đã thay đổi; tải lại phiên đăng nhập trước khi đồng bộ.'});const state=options.sanitizeState(parsed,user,profile,{chunked:true}),revision=baseRevision+1,now=new Date(),changes={state:null,stateTransfer:manifest(meta),report:summary(state),revision,updatedAt:now,schemaVersion:3};
  if(meta.status==='staging'){const locked=await metas.updateOne({_id:metaId,...scope,status:'staging'},{$set:{status:'publishing'}});if(!locked.matchedCount){const latestMeta=await metas.findOne({_id:metaId,...scope});if(!latestMeta||!['publishing','committed'].includes(latestMeta.status))return res.status(409).json({error:'Phiên gửi đã bị hủy trước khi công bố.'});}}
  const changedRoot=async()=>{const latest=await rootCollection.findOne(scope);if(latest?.stateTransfer?.id!==transferId)await metas.updateOne({_id:metaId,...scope,status:'publishing'},{$set:{status:'staging'}});return latestResponse(res,latest,profile,transferId);};
  if(current){const changed=await rootCollection.updateOne({...scope,revision:baseRevision},{$set:changes});if(!changed.matchedCount){return changedRoot();}}
  else{try{await rootCollection.insertOne({...scope,...changes,createdAt:now});}catch(error){if(error.code!==11000)throw error;return changedRoot();}}
  await metas.updateOne({_id:metaId,...scope},{$set:{status:'committed',revision,committedAt:now}});
  await options.audit(db,user,'education:progress:chunked-sync',{learnerProfileId:profile,revision,parts:meta.parts,bytes:meta.bytes});
  return res.status(200).json({ok:true,learnerProfileId:profile,revision,updatedAt:now.toISOString()});
}
module.exports={MAX_BYTES,MAX_PARTS,summary,conflict,readPart,transfer};
