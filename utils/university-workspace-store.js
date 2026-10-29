'use strict';
const P=require('./platform'),T=require('../hh-university-tools'),E=require('../hh-university-experience-core');
const reject=(status,message)=>{throw Object.assign(Error(message),{status,code:'UNIVERSITY_SNAPSHOT_INVALID'});};
function canonical(payload){
  if(!payload||payload.schemaVersion!==1||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))reject(400,'Bản sao chưa đúng cấu trúc.');
  const allowed=['compare','compareNotes','wishes','events','tasks','planner','experience'];
  if(Object.keys(payload.data).some(k=>!allowed.includes(k)))reject(400,'Bản sao chỉ nhận các nhóm đã được chọn.');
  try{return E.cloudPack(T.state({...T.defaults(),...payload.data}),payload.scopes,T);}catch(e){reject(400,e.message);}
}
async function serve(req,res,user,{getDb,rate}){
  const db=await getDb(),collection=db.collection('university_workspaces'),ownerId=String(user._id),_id='university:'+ownerId;
  if(req.method==='GET'){
    await rate(db,'university-snapshot-read:'+ownerId,120,3600000);
    const row=await collection.findOne({_id,ownerId});
    return res.status(200).json(row?{ok:true,revision:row.revision,updatedAt:row.updatedAt,payload:row.payload?canonical(row.payload):null}:{ok:true,revision:0,payload:null});
  }
  if(!['PUT','DELETE'].includes(req.method))reject(405,'Phương thức bản sao chưa được hỗ trợ.');
  const body=P.bodyOf(req,{maxBodyBytes:500000});
  if(!Number.isInteger(body.revision)||body.revision<0||body.revision>10000000)reject(400,'Revision chưa hợp lệ.');
  await rate(db,'university-snapshot-write:'+ownerId,30,3600000);
  const now=new Date().toISOString();
  if(req.method==='DELETE'){
    const result=await collection.updateOne({_id,ownerId,revision:body.revision},{$set:{payload:null,updatedAt:now},$inc:{revision:1}});
    if(!result.matchedCount)reject(409,'Bản máy chủ đã đổi hoặc đã xóa. Hãy xem lại trước khi thao tác.');
    return res.status(200).json({ok:true,deleted:true,revision:body.revision+1});
  }
  const payload=canonical(body.payload),revision=body.revision+1;
  if(body.revision===0){
    try{await collection.insertOne({_id,ownerId,revision,payload,updatedAt:now});}
    catch(e){if(e.code===11000)reject(409,'Thiết bị khác đã tạo bản sao. Hãy xem bản máy chủ trước khi tải lên.');throw e;}
  }else{
    const result=await collection.updateOne({_id,ownerId,revision:body.revision},{$set:{payload,updatedAt:now},$inc:{revision:1}});
    if(!result.matchedCount)reject(409,'Thiết bị khác đã thay đổi bản sao. Dữ liệu trên thiết bị này được giữ; hãy xem lại bản máy chủ.');
  }
  return res.status(200).json({ok:true,revision,updatedAt:now});
}
module.exports={serve,canonical};
