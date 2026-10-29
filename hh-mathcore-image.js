/* Crop/rotate a user's temporary image locally. No URLs are fetched. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HHMathCoreImage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  function cropPixels(width,height,rect){const {x,y,w,h}=rect||{};if(![width,height,x,y,w,h].every(Number.isFinite)||width<16||height<16||x<0||y<0||w<=0||h<=0||x+w>100.000001||y+h>100.000001)throw Error('Vùng cắt phải nằm bên trong ảnh.');const left=Math.round(width*x/100),top=Math.round(height*y/100),right=Math.min(width,Math.round(width*(x+w)/100)),bottom=Math.min(height,Math.round(height*(y+h)/100));if(right-left<16||bottom-top<16)throw Error('Vùng chọn quá nhỏ. Hãy chọn ít nhất 16 điểm ảnh mỗi chiều.');return {x:left,y:top,w:right-left,h:bottom-top};}
  async function edit(source,operation,selection){
    if(!source||typeof source.data!=='string'||!['rotate','crop'].includes(operation))throw Error('Thao tác ảnh chưa hợp lệ.');
    const bytes=Uint8Array.from(root.atob(source.data),c=>c.charCodeAt(0)),bitmap=await root.createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));
    try{const canvas=root.document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('Trình duyệt chưa hỗ trợ chỉnh vùng ảnh.');
      if(operation==='rotate'){canvas.width=bitmap.height;canvas.height=bitmap.width;ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(bitmap,0,0);}
      else{const box=cropPixels(bitmap.width,bitmap.height,selection);canvas.width=box.w;canvas.height=box.h;ctx.drawImage(bitmap,box.x,box.y,box.w,box.h,0,0,box.w,box.h);}
      let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));if(blob?.size>1500000)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.65));if(!blob||blob.size>1600000)throw Error('Ảnh sau khi chỉnh vẫn quá lớn. Hãy chọn vùng nhỏ hơn.');const data=await new Promise((resolve,reject)=>{const reader=new root.FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Chưa đọc được ảnh đã chỉnh.'));reader.readAsDataURL(blob);});return {data,width:canvas.width,height:canvas.height,bytes:blob.size,blob};
    }finally{bitmap.close();}
  }
  return Object.freeze({cropPixels,edit});
});
