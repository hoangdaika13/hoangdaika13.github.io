"use strict";
const { createHash } = require("node:crypto");
const COLLECTION = "hhGalaxyLayerOnePosts";
const COMMENTS = "hhGalaxyLayerOneComments";
function error(code,message,statusCode=400){throw Object.assign(new Error(message),{code,statusCode});}
function text(value,max,required=false){const result=String(value??"").trim();if(result.length>max||(required&&!result))error("INVALID_CONTENT","Nội dung trống hoặc vượt giới hạn.");return result;}
function id(value){const result=String(value||"");if(!/^[a-f0-9]{40}$/.test(result))error("INVALID_ID","ID không hợp lệ.");return result;}
function requestId(owner,key,kind){if(!/^[a-zA-Z0-9-]{8,100}$/.test(String(key||"")))error("REQUEST_ID_REQUIRED","Thiếu mã chống gửi trùng.");return createHash('sha256').update(owner+":"+kind+":"+key).digest('hex').slice(0,40);}
function visible(post,owner){return !!post&&!post.deletedAt&&(post.privacy==='public'||post.ownerId===owner);}
function present(post,owner){return {id:post._id,title:post.title,body:post.body,privacy:post.privacy,author:post.author,createdAt:post.createdAt,updatedAt:post.updatedAt,version:post.version,own:post.ownerId===owner,likes:(post.likes||[]).length,liked:(post.likes||[]).includes(owner)};}
async function execute(db,user,action,input={},now=new Date()){
  const owner=String(user?._id||user?.id||'');if(!owner)error("AUTH_REQUIRED","Bạn cần đăng nhập.",401);
  const posts=db.collection(COLLECTION),comments=db.collection(COMMENTS),author=text(user.name||user.displayName||'Thành viên HH',80);
  if(action==='list'){
    const query={deletedAt:{$exists:false},$or:[{privacy:'public'},{ownerId:owner}]};
    if(input.cursor){
      let parsed;try{parsed=JSON.parse(Buffer.from(String(input.cursor),'base64url').toString('utf8'));}catch{error('CURSOR_INVALID','Cursor không hợp lệ.');}
      const date=new Date(parsed?.at),lastId=id(parsed?.id);if(!Number.isFinite(date.getTime()))error('CURSOR_INVALID','Cursor không hợp lệ.');
      query.$and=[{$or:[{createdAt:{$lt:date}},{createdAt:date,_id:{$lt:lastId}}]}];
    }
    const rows=await posts.find(query).sort({createdAt:-1,_id:-1}).limit(21).toArray();
    return {posts:rows.slice(0,20).map(post=>present(post,owner)),nextCursor:rows.length>20?Buffer.from(JSON.stringify({at:rows[19].createdAt,id:rows[19]._id})).toString('base64url'):null};
  }
  if(action==='create'){
    const _id=requestId(owner,input.requestId,'post'),title=text(input.title,160,true),body=text(input.body,8000,true);
    if(!['private','public'].includes(input.privacy))error('PRIVACY_UNSUPPORTED','Nhóm cần cấu hình membership riêng; hiện hỗ trợ riêng tư/công khai.');
    const existing=await posts.findOne({_id});if(existing){if(existing.deletedAt||existing.title!==title||existing.body!==body||existing.privacy!==input.privacy)error('REQUEST_ID_CONFLICT','Mã yêu cầu đã dùng cho nội dung khác hoặc đã xóa.',409);return {post:present(existing,owner),replayed:true};}
    const post={_id,ownerId:owner,author,title,body,privacy:input.privacy,createdAt:now,updatedAt:now,version:1,likes:[]};
    try{await posts.insertOne(post);}catch(e){if(e.code!==11000)throw e;const saved=await posts.findOne({_id});if(!saved||saved.title!==title||saved.body!==body||saved.privacy!==input.privacy)error('REQUEST_ID_CONFLICT','Nội dung gửi trùng không nhất quán.',409);return {post:present(saved,owner),replayed:true};}
    return {post:present(post,owner)};
  }
  const post=await posts.findOne({_id:id(input.id)});
  if(!visible(post,owner))error('POST_NOT_FOUND','Không tìm thấy bài viết.',404);
  if(action==='update'||action==='delete'){
    if(post.ownerId!==owner)error('FORBIDDEN','Bạn không có quyền sửa bài này.',403);
    if(!Number.isInteger(input.version)||input.version!==post.version)error('VERSION_CONFLICT','Bài đã thay đổi; tải lại trước khi sửa.',409);
    const patch=action==='delete'?{deletedAt:now,updatedAt:now}:{title:text(input.title,160,true),body:text(input.body,8000,true),updatedAt:now};
    const result=await posts.updateOne({_id:post._id,ownerId:owner,version:input.version},{$set:patch,$inc:{version:1}});
    if(result.matchedCount!==1)error('VERSION_CONFLICT','Bài vừa được cập nhật ở phiên khác.',409);
    return action==='delete'?{deleted:true}:{post:present({...post,...patch,version:post.version+1},owner)};
  }
  if(action==='react'){
    if(typeof input.liked!=='boolean')error('REACTION_INVALID','Trạng thái thích không hợp lệ.');
    await posts.updateOne({_id:post._id,deletedAt:{$exists:false}},input.liked?{$addToSet:{likes:owner}}:{$pull:{likes:owner}});
    const updated=await posts.findOne({_id:post._id});if(!visible(updated,owner))error('POST_NOT_FOUND','Bài viết đã bị xóa.',404);return {post:present(updated,owner)};
  }
  if(action==='comments'){
    const rows=await comments.find({postId:post._id,deletedAt:{$exists:false}}).sort({createdAt:-1}).limit(50).toArray();
    return {comments:rows.map(row=>({id:row._id,body:row.body,author:row.author,own:row.ownerId===owner,createdAt:row.createdAt}))};
  }
  if(action==='comment'){
    const body=text(input.body,2000,true),_id=requestId(owner,input.requestId,'comment:'+post._id);
    const record={_id,postId:post._id,ownerId:owner,body,author,createdAt:now};
    try{await comments.insertOne(record);}catch(e){if(e.code!==11000)throw e;const old=await comments.findOne({_id});if(old?.body!==body)error('REQUEST_ID_CONFLICT','Mã bình luận trùng nội dung khác.',409);}
    return {comment:{id:_id,body,author,own:true,createdAt:now}};
  }
  error('ACTION_UNSUPPORTED','Thao tác chưa được hỗ trợ.');
}
module.exports={COLLECTION,COMMENTS,execute,visible,present,requestId};
