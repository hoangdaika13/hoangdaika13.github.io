"use strict";
const { withApi,currentUser,enforceRateLimit }=require('./platform');
const service=require('./galaxy-community-service');
module.exports=async function(req,res){
  return withApi(req,res,async({db,body})=>{
    const user=await currentUser(req);if(!user)return res.status(401).json({error:'Bạn cần đăng nhập để mở cộng đồng Lớp 1.',code:'AUTH_REQUIRED'});
    if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
    const action=req.method==='GET'?String(req.query.action||'list'):String(body.action||'');
    if(req.method==='GET'&&!['list','comments'].includes(action))return res.status(405).json({error:'Thao tác này cần POST.'});
    await enforceRateLimit(db,'galaxy-community:'+String(user._id)+':'+req.method,req.method==='GET'?120:30,60000);
    const result=await service.execute(db,user,action,req.method==='GET'?req.query:body);
    res.setHeader('Cache-Control','no-store');return res.status(200).json({ok:true,layer:'galaxy',...result});
  },{maxBodyBytes:40000});
};
