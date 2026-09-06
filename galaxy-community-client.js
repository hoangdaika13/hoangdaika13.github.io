(function(root){"use strict";
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(app,options={}){
    const host=app.querySelector('.hgl1-community-workspace');if(!host)return null;
    const node=document.createElement('section');node.className='gwb-panel';node.innerHTML='<header><span class="hgl1-kicker">API CỘNG ĐỒNG LỚP 1 · DỮ LIỆU RIÊNG</span><h3>Bảng tin có xác thực</h3></header><p>Chỉ kết nối khi bạn yêu cầu. Cập nhật bằng API, không giả lập realtime socket. Nội dung công khai được người dùng đã đăng nhập khác nhìn thấy.</p><div class="gwb-actions"><button type="button" data-gr-action="connect">Kết nối / tải bảng tin</button><button type="button" data-gr-action="publish">Đăng nội dung đang soạn</button><button type="button" data-gr-action="more" hidden>Tải bài cũ hơn</button></div><label><input type="checkbox" data-gr-auto> Tự làm mới mỗi 15 giây khi tab hiển thị</label><output role="status" data-gr-status>Chưa kết nối API.</output><div data-gr-feed></div>';
    host.appendChild(node);const controller=new AbortController(),signal=controller.signal;
    let posts=[],cursor=null,timer=0,busy=false,disposed=false,publishAttempt=null;
    const status=text=>{if(!disposed)node.querySelector('[data-gr-status]').textContent=text;};
    async function request(action,data={},method='GET'){
      const url='/api/community?galaxy=1'+(method==='GET'?'&'+new URLSearchParams({action,...data}).toString():'');
      const response=await fetch(url,{method,credentials:'same-origin',headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?JSON.stringify({action,...data}):undefined,signal});
      const result=await response.json().catch(()=>({}));if(!response.ok||result.ok!==true)throw Error(result.error||'API chưa cấu hình hoặc chưa đăng nhập (HTTP '+response.status+').');return result;
    }
    function render(){
      const feed=node.querySelector('[data-gr-feed]');feed.innerHTML=posts.map(post=>'<article class="gwb-remote-post" data-gr-id="'+esc(post.id)+'"><header><b>'+esc(post.title)+'</b><small>'+esc(post.author)+' · '+esc(post.privacy==='private'?'Riêng tư':'Công khai')+'</small></header><p>'+esc(post.body)+'</p><div class="gwb-actions"><button type="button" data-gr-action="react">'+(post.liked?'♥ Đã thích':'♡ Thích')+' · '+Number(post.likes||0)+'</button><button type="button" data-gr-action="comments">Bình luận</button>'+(post.own?'<button type="button" data-gr-action="edit">Sửa bài</button><button type="button" data-gr-action="delete">Xóa bài</button>':'')+'</div><div data-gr-comments></div></article>').join('')||'<p>Chưa có bài viết trong phạm vi bạn được phép xem.</p>';
      node.querySelector('[data-gr-action=more]').hidden=!cursor;
    }
    async function load(more=false){if(busy||disposed)return;busy=true;status('Đang tải dữ liệu thật…');try{const result=await request('list',more&&cursor?{cursor}:{});if(disposed)return;posts=more?[...new Map([...posts,...result.posts].map(post=>[post.id,post])).values()]:result.posts;cursor=result.nextCursor;render();status('Đã nhận '+result.posts.length+' bài từ API.');}catch(error){if(!disposed&&error.name!=='AbortError')status(error.message);}finally{busy=false;}}
    function confirmDialog(title,message,onConfirm,fields=''){
      const dialog=document.createElement('dialog');dialog.className='gwb-dialog';dialog.innerHTML='<form method="dialog"><h3>'+esc(title)+'</h3><p>'+esc(message)+'</p>'+fields+'<div class="gwb-actions"><button value="cancel">Hủy</button><button value="confirm">Xác nhận</button></div><output role="status"></output></form>';app.appendChild(dialog);
      dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.addEventListener('submit',async event=>{if(event.submitter?.value!=='confirm')return;event.preventDefault();event.submitter.disabled=true;try{await onConfirm(event.target);dialog.close();await load();}catch(error){dialog.querySelector('output').textContent=error.message;event.submitter.disabled=false;}});dialog.showModal();signal.addEventListener('abort',()=>dialog.remove(),{once:true});
    }
    node.addEventListener('click',async event=>{
      const button=event.target.closest('[data-gr-action]');if(!button)return;const action=button.dataset.grAction,article=button.closest('[data-gr-id]'),post=posts.find(item=>item.id===article?.dataset.grId);
      try{
        if(action==='connect'||action==='more'){await load(action==='more');return;}
        if(action==='publish'){
          const source=app.querySelector('[data-hgl1-community-form]'),data={title:source.elements.title.value,body:source.elements.body.value,privacy:source.elements.privacy.value};
          if(!data.title.trim()||!data.body.trim())throw Error('Nhập tiêu đề và nội dung trước.');
          const signature=JSON.stringify(data);if(!publishAttempt||publishAttempt.signature!==signature)publishAttempt={signature,id:crypto.randomUUID()};
          confirmDialog('Đăng bài lên máy chủ','Nội dung đang soạn sẽ được gửi tới API hoang8.com với quyền '+data.privacy+'. Bản nháp không bị xóa.',()=>request('create',{...data,requestId:publishAttempt.id},'POST'));return;
        }
        if(!post)return;
        if(action==='delete'){confirmDialog('Xóa bài của bạn','Bài sẽ được ẩn khỏi bảng tin trên máy chủ.',()=>request('delete',{id:post.id,version:post.version},'POST'));return;}
        if(action==='edit'){confirmDialog('Chỉnh bài đã đăng','Thay đổi sẽ được ghi vào bài trên máy chủ.',form=>request('update',{id:post.id,version:post.version,title:form.elements.title.value,body:form.elements.body.value},'POST'),'<label>Tiêu đề<input name="title" maxlength="160" required value="'+esc(post.title)+'"></label><label>Nội dung<textarea name="body" maxlength="8000" rows="8" required>'+esc(post.body)+'</textarea></label>');return;}
        if(action==='react'){await request('react',{id:post.id,liked:!post.liked},'POST');await load();return;}
        if(action==='comments'){
          const result=await request('comments',{id:post.id});if(disposed)return;const box=article.querySelector('[data-gr-comments]');box.innerHTML=result.comments.map(comment=>'<p><b>'+esc(comment.author)+'</b>: '+esc(comment.body)+'</p>').join('')+'<form data-gr-comment><label>Bình luận<textarea name="body" maxlength="2000" required></textarea></label><button type="submit">Gửi bình luận</button></form>';return;
        }
      }catch(error){if(!disposed&&error.name!=='AbortError')status(error.message);}
    },{signal});
    node.addEventListener('submit',async event=>{if(!event.target.matches('[data-gr-comment]'))return;event.preventDefault();const form=event.target,id=form.closest('[data-gr-id]').dataset.grId,body=form.elements.body.value;form.dataset.requestId ||= crypto.randomUUID();try{await request('comment',{id,body,requestId:form.dataset.requestId},'POST');form.elements.body.value='';delete form.dataset.requestId;status('Bình luận đã được máy chủ xác nhận.');await load();}catch(error){if(!disposed)status(error.message);}},{signal});
    const schedule=()=>{clearInterval(timer);timer=0;if(node.querySelector('[data-gr-auto]').checked&&!document.hidden)timer=setInterval(()=>load(),15000);};
    node.querySelector('[data-gr-auto]').addEventListener('change',schedule,{signal});document.addEventListener('visibilitychange',schedule,{signal});
    return {destroy(){disposed=true;controller.abort();clearInterval(timer);node.remove();}};
  }
  root.HHGalaxyCommunityClient=Object.freeze({mount});
})(typeof globalThis!=='undefined'?globalThis:this);
