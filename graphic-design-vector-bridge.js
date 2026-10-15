(function (scope) {
  'use strict';
  // Explicit one-way, editable still-frame transfer; never an automatic schema migration.
  const VERSION = 1;
  const mounted = new WeakMap();
  const finite = value => Number.isFinite(Number(value));
  const clean = value => String(value ?? '').slice(0, 240);
  const r = value => Math.round(value * 1e6) / 1e6;
  const identity = [1, 0, 0, 1, 0, 0];
  function multiply(a, b) {
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  }
  function transformPoint(matrix, x, y) { return {x:r(matrix[0]*x+matrix[2]*y+matrix[4]), y:r(matrix[1]*x+matrix[3]*y+matrix[5])}; }
  function matrixFor(t, motion) {
    const angle = t.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), scale = t.scaleX;
    return [c*scale, s*scale, -s*scale, c*scale, t.x+motion.x+t.anchorX-c*scale*t.anchorX+s*scale*t.anchorY, t.y+motion.y+t.anchorY-s*scale*t.anchorX-c*scale*t.anchorY];
  }
  function sourcePoints(layer, evaluated) {
    const g=layer.geometry, at=(x,y,inX=x,inY=y,outX=x,outY=y)=>({x,y,inX,inY,outX,outY});
    if(layer.type==='path') return {points:evaluated.morphPoints?.length?evaluated.morphPoints:g.points, closed:g.closed};
    if(layer.type==='polygon'||layer.type==='star') {
      const count=g.sides*(layer.type==='star'?2:1), points=[];
      for(let i=0;i<count;i++){const angle=-Math.PI/2+i*Math.PI*2/count, radius=layer.type==='star'&&i%2?g.innerRadius:g.radius;points.push(at(g.cx+Math.cos(angle)*radius,g.cy+Math.sin(angle)*radius));}
      return {points,closed:true};
    }
    const k=4*(Math.sqrt(2)-1)/3;
    if(layer.type==='ellipse') {
      const {cx,cy}=g, rx=g.width/2,ry=g.height/2;
      return {closed:true,points:[at(cx+rx,cy,cx+rx,cy-k*ry,cx+rx,cy+k*ry),at(cx,cy+ry,cx+k*rx,cy+ry,cx-k*rx,cy+ry),at(cx-rx,cy,cx-rx,cy+k*ry,cx-rx,cy-k*ry),at(cx,cy-ry,cx-k*rx,cy-ry,cx+k*rx,cy-ry)]};
    }
    const {x,y,width:w,height:h}=g, radius=Math.min(g.rx,w/2,h/2);
    if(!radius)return {closed:true,points:[at(x,y),at(x+w,y),at(x+w,y+h),at(x,y+h)]};
    const z=radius, q=k*z;
    return {closed:true,points:[at(x+z,y,x+z-q,y),at(x+w-z,y, x+w-z,y,x+w-z+q,y),at(x+w,y+z,x+w,y+z-q),at(x+w,y+h-z,x+w,y+h-z,x+w,y+h-z+q),at(x+w-z,y+h,x+w-z+q,y+h),at(x+z,y+h,x+z,y+h,x+z-q,y+h),at(x,y+h-z,x,y+h-z+q),at(x,y+z,x,y+z,x,y+z-q)]};
  }
  function snapshot(raw, options={}) {
    const api=options.vectorApi||scope.HHGraphicVectorCore;
    if(!api?.normalizeProject||!api?.evaluateLayer)throw Error('Vector Core chưa sẵn sàng.');
    if(!raw||raw.format!=='hh-vector-motion-project'||!Array.isArray(raw.layers)||raw.layers.length>1000)throw Error('Dự án Vector không hợp lệ hoặc quá 1.000 layer.');
    if(!finite(options.time??0))throw Error('Thời điểm không hợp lệ.');
    const project=api.normalizeProject(raw), time=Math.max(0,Math.min(Number(options.time??0),project.timeline.duration));
    const layers=[],issues=[],warnings=[],byParent=new Map(),seen=new Set();
    if(!/^#[0-9a-f]{6}$/i.test(project.stage.background))issues.push('Nền khung cần mã HEX 6 chữ số để chuyển đúng màu; không tự đổi nền trong suốt hoặc màu rút gọn.');
    if(project.layers.some(layer=>layer.solo))issues.push('Tắt Solo trước khi chuyển để không bỏ sót layer.');
    for(const layer of project.layers){const key=layer.parentId||null;if(!byParent.has(key))byParent.set(key,[]);byParent.get(key).push(layer);}
    let hidden=0;
    function visit(layer, parent, chain) {
      if(chain.has(layer.id)){issues.push('Cấu trúc layer có vòng lặp.');return;}
      seen.add(layer.id);
      const nextChain=new Set(chain);nextChain.add(layer.id);
      if(!layer.visible){hidden++;for(const child of byParent.get(layer.id)||[]) markHidden(child,new Set(nextChain));return;}
      const evaluated=api.evaluateLayer(layer,time,project.timeline.duration), t=evaluated.transform;
      const reject=message=>issues.push(`${clean(layer.name)}: ${message}`);
      if(!Object.values(t).every(finite)||Math.abs(t.scaleX-t.scaleY)>1e-8||t.scaleX<=0){reject('chỉ hỗ trợ scale đều dương; không làm phẳng skew/lật.');return;}
      if(layer.maskId||layer.clip||layer.matte!=='none'){reject('mask/matte/clip chưa có adapter.');return;}
      if(layer.trim.enabled){reject('Trim Path cần tắt trước khi chuyển.');return;}
      const motion=layer.motionPath.length?api.motionPathPoint(layer.motionPath,time/project.timeline.duration):{x:0,y:0};
      const matrix=multiply(parent,matrixFor(t,motion)), scale=Math.hypot(matrix[0],matrix[1]);
      if(['group','composition'].includes(layer.type)) {
        if(t.opacity!==1||layer.blendMode!=='normal'){reject('opacity/blend của nhóm cần giữ trong engine gốc.');return;}
      } else if(['rect','ellipse','polygon','star','path','text'].includes(layer.type)) {
        const style=layer.style;
        if((byParent.get(layer.id)||[]).length){reject('layer hình có con cần chuyển thành nhóm riêng trước.');return;}
        if(![style.fill,style.stroke].every(value=>/^(?:#[0-9a-f]{6}|none)$/i.test(value))){reject('adapter màu hiện nhận HEX 6 chữ số hoặc none; không tự đổi màu.');return;}
        if(style.strokeWidth*scale>80){reject('stroke sau scale vượt giới hạn 80px của tài liệu chung.');return;}
        const result={name:layer.name,type:'path',opacity:t.opacity,visible:true,locked:layer.locked,fill:style.fill.toLowerCase(),stroke:style.stroke.toLowerCase(),strokeWidth:r(style.strokeWidth*scale),strokeCap:style.lineCap,strokeJoin:style.lineJoin,blendMode:layer.blendMode,cornerRadius:0,rotation:0,metadata:{vectorBridge:{version:VERSION,sourceId:layer.id,time}}};
        if(layer.type==='text') {
          const size=style.fontSize*scale;
          if(size<6||size>320||style.fontWeight>900){reject('font size/weight nằm ngoài khả năng tài liệu chung.');return;}
          const b=transformPoint(matrix,layer.geometry.x,layer.geometry.y+style.fontSize);
          Object.assign(result,{type:'text',text:layer.geometry.text,fontFamily:style.fontFamily,fontSize:r(size),fontWeight:style.fontWeight,x:b.x,y:r(b.y-size),width:r(layer.geometry.width*scale),height:r(size),anchorX:0,anchorY:1,rotation:r(Math.atan2(matrix[1],matrix[0])*180/Math.PI),strokeJoin:'miter',strokeCap:'butt'});
        } else {
          const shape=sourcePoints(layer,evaluated);
          if(shape.points.length<2){reject('path cần ít nhất hai điểm.');return;}
          const points=shape.points.map(p=>{const base=transformPoint(matrix,p.x,p.y),i=transformPoint(matrix,p.inX??p.x,p.inY??p.y),o=transformPoint(matrix,p.outX??p.x,p.outY??p.y);return {...base,inX:r(i.x-base.x),inY:r(i.y-base.y),outX:r(o.x-base.x),outY:r(o.y-base.y),smooth:!p.corner};});
          // Include the closing cubic explicitly: Universal's final Z is a straight edge.
          if(shape.closed)points.push({...points[0]});
          const xs=points.flatMap(p=>[p.x,p.x+p.inX,p.x+p.outX]),ys=points.flatMap(p=>[p.y,p.y+p.inY,p.y+p.outY]);
          Object.assign(result,{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(1,Math.max(...xs)-Math.min(...xs)),height:Math.max(1,Math.max(...ys)-Math.min(...ys)),pathPoints:points,pathClosed:shape.closed});
          if(layer.type==='ellipse'||(layer.type==='rect'&&layer.geometry.rx))warnings.push(`${clean(layer.name)}: cung tròn dùng 4 đoạn Bézier mỗi vòng (xấp xỉ hình học, không phải arc chính xác).`);
        }
        if([result.x,result.y,result.width,result.height].some(value=>!Number.isFinite(value)||Math.abs(value)>100000)){reject('tọa độ sau transform quá giới hạn.');return;}
        layers.push(result);
      } else {reject('loại layer chưa có adapter.');return;}
      for(const child of byParent.get(layer.id)||[])visit(child,matrix,nextChain);
    }
    function markHidden(layer,chain){if(chain.has(layer.id))return;seen.add(layer.id);hidden++;chain.add(layer.id);for(const child of byParent.get(layer.id)||[])markHidden(child,new Set(chain));}
    for(const layer of byParent.get(null)||[])visit(layer,identity,new Set());
    if(seen.size!==project.layers.length)issues.push('Có layer không truy cập được; kiểm tra parent và nhóm lỗi.');
    if(!layers.length)issues.push('Không có layer hiển thị để chuyển.');
    return {ok:issues.length===0,issues:[...new Set(issues)],warnings:[...new Set(warnings)],hidden,time,payload:{name:`${project.meta.name} · ${r(time)}s`,width:project.stage.width,height:project.stage.height,background:project.stage.background,layers}};
  }
  function mount(root, options={}) {
    if(!root?.ownerDocument||!options.vectorController||!options.designDocumentController)return null;
    unmount(root);
    const doc=root.ownerDocument, bar=doc.createElement('details');bar.className='gd-vector-bridge';
    bar.innerHTML='<summary>Chuyển vector sang tài liệu chung</summary><p>Tạo frame mới có thể chỉnh sửa để dùng Review, Export và Composer. Không thay dự án gốc; chỉ chụp hình tĩnh tại thời điểm đã chọn, không chuyển timeline. Mask, Trim Path và scale không đều cần xử lý trong Vector Core.</p><div class="gd-vector-bridge-actions"><label>Thời điểm (giây)<input type="number" data-gvb-time min="0" step="0.1" value="0"></label><button type="button" data-gvb-check>Kiểm tra khả năng chuyển</button><button type="button" data-gvb-copy disabled>Tạo frame từ vector</button></div><output data-gvb-status role="status" aria-live="polite">Đang chờ Vector Core khôi phục dữ liệu…</output>';
    root.prepend(bar);
    const native=options.vectorController, shared=options.designDocumentController, status=bar.querySelector('[data-gvb-status]'), copy=bar.querySelector('[data-gvb-copy]');
    let disposed=false,ready=false;
    const report=()=>snapshot(native.getProject(),{time:bar.querySelector('[data-gvb-time]').value});
    function show(result){status.textContent=result.ok?`${result.payload.layers.length} layer, bỏ qua ${result.hidden} layer ẩn. ${result.warnings.join(' ')||'Đã kiểm tra khả năng chuyển.'}`:result.issues.join('\n');copy.disabled=!result.ok;}
    const click=async event=>{
      if(!ready||disposed)return;
      if(!event.target.closest('[data-gvb-check],[data-gvb-copy]'))return;
      try {
        const result=report();show(result);
        if(!result.ok||!event.target.closest('[data-gvb-copy]'))return;
        native.pause?.();native.setTime?.(result.time);
        shared.dispatch('import-frame-layers',result.payload);
        copy.disabled=true;
        const saved=await shared.save();
        if(disposed)return;
        status.textContent=saved?.ok?`Đã tạo và lưu frame mới gồm ${result.payload.layers.length} layer. Có thể Undo trong tài liệu chung; bản Vector gốc không đổi.`:'Frame mới đang ở bộ nhớ nhưng chưa xác nhận lưu. Hãy xuất bản sao hoặc thử lưu lại; dự án gốc không đổi.';
      } catch(error){if(!disposed){status.textContent=clean(error.message)||'Chưa thể chuyển vector.';copy.disabled=true;}}
    };
    const input=()=>{copy.disabled=true;status.textContent='Thời điểm đã thay đổi. Kiểm tra lại trước khi tạo frame.';};
    bar.addEventListener('click',click);bar.addEventListener('input',input);
    Promise.resolve(native.ready).then(()=>{if(!disposed){ready=true;bar.querySelector('[data-gvb-time]').max=native.getProject().timeline.duration;status.textContent='Sẵn sàng kiểm tra. Chỉ những thuộc tính có adapter mới được chuyển.';}}).catch(()=>{if(!disposed)status.textContent='Không thể khôi phục Vector Core.';});
    const controller={destroy(){disposed=true;bar.removeEventListener('click',click);bar.removeEventListener('input',input);bar.remove();mounted.delete(root);}};
    mounted.set(root,controller);return controller;
  }
  function unmount(root){mounted.get(root)?.destroy();}
  const api=Object.freeze({VERSION,snapshot,mount,unmount,transformPoint,multiply});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  scope.HHGraphicVectorBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this);
