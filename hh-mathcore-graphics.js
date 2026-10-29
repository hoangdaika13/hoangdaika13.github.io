/* Software-projected 3D geometry and a safe expression plotter. No GPU or remote embed. */
(function(root){
  'use strict';
  const C=root.HHMathCore;
  const COLORS=['#4776ff','#25d9f8','#9361ff','#ffcf71','#ff8066','#54d6ba'];
  function surface(canvas){
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Trình duyệt chưa hỗ trợ Canvas 2D.');let width=1,height=1,disposed=false,frame=0;
    let render=()=>{};
    const draw=()=>{frame=0;if(disposed)return;const bounds=canvas.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);const dpr=Math.min(2,root.devicePixelRatio||1);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);render(ctx,width,height);};
    const schedule=()=>{if(!disposed&&!frame)frame=root.requestAnimationFrame(draw);};const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;observer?.observe(canvas);root.addEventListener('resize',schedule);
    return {set(fn){render=fn;schedule();},draw:schedule,destroy(){disposed=true;observer?.disconnect();root.removeEventListener('resize',schedule);if(frame)root.cancelAnimationFrame(frame);}};
  }
  const point=(x,y,z)=>[x,y,z];
  function mesh(shape,dim){
    const {w,d,h,r}=C.dimensions(dim),vertices=[],faces=[];const ring=(y,radius)=>{const start=vertices.length;for(let j=0;j<32;j++){const a=j*Math.PI/16;vertices.push(point(radius*Math.cos(a),y,radius*Math.sin(a)));}return Array.from({length:32},(_,j)=>start+j);};
    if(shape==='sphere'){
      for(let i=0;i<=14;i++)for(let j=0;j<28;j++){const a=i*Math.PI/14,b=j*Math.PI/14;vertices.push(point(r*Math.sin(a)*Math.cos(b),r*Math.cos(a),r*Math.sin(a)*Math.sin(b)));}
      for(let i=0;i<14;i++)for(let j=0;j<28;j++){const a=i*28+j,b=i*28+(j+1)%28;faces.push([a,b,b+28,a+28]);}
    }else if(shape==='cylinder'||shape==='cone'){
      const base=ring(-h/2,r);faces.push([...base].reverse());if(shape==='cone'){const top=vertices.push(point(0,h/2,0))-1;base.forEach((v,j)=>faces.push([v,base[(j+1)%32],top]));}else{const top=ring(h/2,r);faces.push(top);base.forEach((v,j)=>faces.push([v,base[(j+1)%32],top[(j+1)%32],top[j]]));}
    }else{
      vertices.push(point(-w/2,-h/2,-d/2),point(w/2,-h/2,-d/2),point(w/2,-h/2,d/2),point(-w/2,-h/2,d/2));
      if(shape==='pyramid'){vertices.push(point(0,h/2,0));faces.push([0,3,2,1],[0,1,4],[1,2,4],[2,3,4],[3,0,4]);}
      else{vertices.push(point(-w/2,h/2,-d/2),point(w/2,h/2,-d/2),point(w/2,h/2,d/2),point(-w/2,h/2,d/2));faces.push([0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]);}
    }
    return {vertices,faces};
  }
  function section(shape,dim,ratio){
    const {w,d,h,r}=C.dimensions(dim),y=shape==='sphere'?(ratio-.5)*2*r:(ratio-.5)*h;
    if(['sphere','cylinder','cone'].includes(shape)){const radius=shape==='sphere'?Math.sqrt(Math.max(0,r*r-y*y)):shape==='cone'?r*(1-ratio):r;return Array.from({length:64},(_,i)=>point(radius*Math.cos(i*Math.PI/32),y,radius*Math.sin(i*Math.PI/32)));}
    const k=shape==='pyramid'?1-ratio:1;return [point(-w*k/2,y,-d*k/2),point(w*k/2,y,-d*k/2),point(w*k/2,y,d*k/2),point(-w*k/2,y,d*k/2)];
  }
  function mountSolid(canvas,initial={}){
    let state={shape:'pyramid',w:4,d:3,h:5,r:2,cut:50,section:true,labels:true,yaw:.7,pitch:-.35,zoom:1,...initial},drag=null;const s=surface(canvas),listeners=[];
    const on=(name,fn,options)=>{canvas.addEventListener(name,fn,options);listeners.push(()=>canvas.removeEventListener(name,fn,options));};
    s.set((ctx,width,height)=>{
      const dim=C.dimensions(state),data=mesh(state.shape,dim),size=Math.max(dim.w,dim.d,dim.h,dim.r*2),scale=Math.min(width,height)*.62/size*state.zoom,cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
      const project=([x,y,z])=>{const xx=x*cy+z*sy,zz=-x*sy+z*cy,yy=y*cp-zz*sp,depth=y*sp+zz*cp,k=10/(10-depth/size);return {x:width/2+xx*scale*k,y:height*.47-yy*scale*k,z:depth};};
      ctx.fillStyle='#091629';ctx.fillRect(0,0,width,height);const glow=ctx.createRadialGradient(width*.5,height*.45,0,width*.5,height*.45,width*.65);glow.addColorStop(0,'#173453');glow.addColorStop(1,'#091629');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      ctx.lineWidth=1;ctx.strokeStyle='#a4c8e51a';for(let i=-5;i<=5;i++){const path=[project(point(-size*.6,-size*.57,i*size/8)),project(point(size*.6,-size*.57,i*size/8)),project(point(i*size/8,-size*.57,-size*.6)),project(point(i*size/8,-size*.57,size*.6))];ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);ctx.lineTo(path[1].x,path[1].y);ctx.moveTo(path[2].x,path[2].y);ctx.lineTo(path[3].x,path[3].y);ctx.stroke();}
      const vertices=data.vertices.map(project);const drawPolygon=(pts,fill,stroke,lineWidth=1)=>{ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();};
      data.faces.map((indices,i)=>({indices,i,z:indices.reduce((n,k)=>n+vertices[k].z,0)/indices.length})).sort((a,b)=>a.z-b.z).forEach(({indices,i})=>{const hue=COLORS[state.shape==='sphere'?Math.floor(i/28)%3:i%COLORS.length];drawPolygon(indices.map(k=>vertices[k]),hue+(state.shape==='sphere'?'90':'98'),state.shape==='sphere'?'#d6e4ff15':'#d6e4ff85',state.shape==='sphere'?.6:1.3);});
      if(state.section)drawPolygon(section(state.shape,dim,state.cut/100).map(project),'#ffd16665','#ffe9aa',2.2);
      if(state.labels&&['box','pyramid'].includes(state.shape)){ctx.font='600 12px system-ui';vertices.forEach((v,i)=>{ctx.beginPath();ctx.arc(v.x,v.y,3,0,Math.PI*2);ctx.fillStyle='#fff6d9';ctx.fill();ctx.fillStyle='#f3f7ff';ctx.fillText(['A','B','C','D','S','B′','C′','D′'][state.shape==='box'&&i===4?0:i]+(state.shape==='box'&&i===4?'′':''),v.x+7,v.y-7);});}
      ctx.fillStyle='#b6cce2';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('Kéo để xoay · Phím mũi tên khi chọn hình',width/2,height-18);ctx.textAlign='left';
    });
    on('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,id:event.pointerId};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});});
    on('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;state.yaw+=(event.clientX-drag.x)*.012;state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch+(event.clientY-drag.y)*.01));drag.x=event.clientX;drag.y=event.clientY;s.draw();});
    const release=()=>{if(drag&&canvas.hasPointerCapture?.(drag.id))canvas.releasePointerCapture(drag.id);drag=null;};on('pointerup',release);on('pointercancel',release);on('lostpointercapture',()=>{drag=null;});
    on('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-'].includes(event.key))return;event.preventDefault();if(event.key==='Home'){state.yaw=.7;state.pitch=-.35;state.zoom=1;}else if(event.key==='+'||event.key==='-')state.zoom=Math.max(.6,Math.min(1.8,state.zoom+(event.key==='+'?.1:-.1)));else{state.yaw+=event.key==='ArrowRight'?.12:event.key==='ArrowLeft'?-.12:0;state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch+(event.key==='ArrowUp'?-.1:event.key==='ArrowDown'?.1:0)));}s.draw();});
    return {update(next){state={...state,...next};s.draw();},reset(){state.yaw=.7;state.pitch=-.35;state.zoom=1;s.draw();},destroy(){release();listeners.forEach(fn=>fn());s.destroy();}};
  }
  function mountGraph(canvas,{expression='x^2-4',range=6,x=1,tangent=false,onTrace=()=>{}}={}){
    let ast=C.parse(expression),state={range,x,tangent},error='';const s=surface(canvas),listeners=[];
    s.set((ctx,w,h)=>{ctx.fillStyle='#091629';ctx.fillRect(0,0,w,h);const pad=28,ww=w-2*pad,hh=h-2*pad,R=state.range,yr=R*hh/ww,sx=v=>pad+(v+R)/(2*R)*ww,sy=v=>pad+(yr-v)/(2*yr)*hh;
      ctx.save();ctx.beginPath();ctx.rect(pad,pad,ww,hh);ctx.clip();const step=R<=3?.5:R<=8?1:2;ctx.strokeStyle='#b5d7f51c';ctx.lineWidth=1;for(let a=-Math.ceil(R);a<=R;a+=step){ctx.beginPath();ctx.moveTo(sx(a),pad);ctx.lineTo(sx(a),h-pad);ctx.stroke();}for(let a=-Math.ceil(yr);a<=yr;a+=step){ctx.beginPath();ctx.moveTo(pad,sy(a));ctx.lineTo(w-pad,sy(a));ctx.stroke();}ctx.strokeStyle='#b9d4ea8c';ctx.beginPath();ctx.moveTo(sx(0),pad);ctx.lineTo(sx(0),h-pad);ctx.moveTo(pad,sy(0));ctx.lineTo(w-pad,sy(0));ctx.stroke();
      const samples=Math.min(1200,Math.max(300,Math.ceil(ww*2))),points=[];for(let i=0;i<=samples;i++){const xx=-R+2*R*i/samples;points.push([xx,C.evaluate(ast,xx)]);}
      ctx.strokeStyle='#55e2f2';ctx.lineWidth=2.5;ctx.beginPath();let prior=null;
      points.forEach(([xx,yy])=>{const p={x:sx(xx),y:sy(yy)};if(!Number.isFinite(yy)||Math.abs(yy)>yr*4){prior=null;return;}if(!prior||Math.abs(p.y-prior.y)>hh*.55)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);prior=p;});ctx.stroke();
      const y=C.evaluate(ast,state.x),derivative=C.derivativeAt(ast,state.x);
      if(state.tangent&&Number.isFinite(y)&&Number.isFinite(derivative)){ctx.strokeStyle='#ffd166';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(sx(-R),sy(y+derivative*(-R-state.x)));ctx.lineTo(sx(R),sy(y+derivative*(R-state.x)));ctx.stroke();ctx.setLineDash([]);}
      if(Number.isFinite(y)){ctx.strokeStyle='#ffffff35';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(sx(state.x),pad);ctx.lineTo(sx(state.x),h-pad);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(sx(state.x),sy(y),5,0,Math.PI*2);ctx.fillStyle='#ffd166';ctx.fill();}ctx.restore();
      ctx.font='11px system-ui';ctx.fillStyle='#b6cce2';ctx.fillText('x',w-17,sy(0)-6);ctx.fillText('y',sx(0)+6,18);for(let a=-Math.floor(R);a<=R;a+=Math.max(1,Math.floor(R/4))){if(a)ctx.fillText(C.fmt(a),sx(a)-6,sy(0)+17);}ctx.fillText('0',sx(0)+5,sy(0)+15);
      onTrace({x:state.x,y,derivative,error});
    });
    const onMove=event=>{const box=canvas.getBoundingClientRect(),ratio=(event.clientX-box.left-28)/(box.width-56);state.x=Math.max(-state.range,Math.min(state.range,(ratio*2-1)*state.range));s.draw();};
    const onKey=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();state.x=Math.max(-state.range,Math.min(state.range,state.x+(event.key==='ArrowRight'?.1:-.1)));s.draw();};canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerdown',onMove);canvas.addEventListener('keydown',onKey);listeners.push(()=>{canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerdown',onMove);canvas.removeEventListener('keydown',onKey);});
    return {update(next){if(next.expression!==undefined){ast=C.parse(next.expression);error='';}state={...state,...next};s.draw();},destroy(){listeners.forEach(fn=>fn());s.destroy();}};
  }
  root.HHMathCoreGraphics=Object.freeze({mountSolid,mountGraph});
})(window);
