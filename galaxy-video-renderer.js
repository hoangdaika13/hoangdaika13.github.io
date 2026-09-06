(function(root,factory){"use strict";const api=factory(root);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.HHGalaxyVideoRenderer=api;})(typeof globalThis!=="undefined"?globalThis:this,function(global){
  "use strict";
  function chooseMime(Recorder){return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>Recorder?.isTypeSupported?.(type))||'';}
  function validate(options){
    const files=options.files||[];
    if(!Array.isArray(files)||!files.length||files.length>4||files.some(file=>!(file instanceof Blob)||!/^video\//.test(file.type)||file.size<=0||file.size>128*1024*1024))throw Error('Chọn 1–4 video cục bộ không rỗng, mỗi tệp tối đa 128 MB.');
    if(!/^#[0-9a-f]{6}$/i.test(options.color||'#ffffff'))throw Error('Màu chữ cần mã HEX sáu chữ số.');
    return {files,text:String(options.text||'').slice(0,180),color:options.color||'#ffffff',start:Number(options.start||0),end:options.end==null||options.end===''?null:Number(options.end)};
  }
  async function render(options={}){
    const config=validate(options),mime=chooseMime(global.MediaRecorder);
    if(options.signal?.aborted)throw new DOMException('Đã hủy xuất video.','AbortError');
    if(!mime||!global.document)throw Error('Trình duyệt chưa hỗ trợ xuất WebM bằng MediaRecorder.');
    const canvas=global.document.createElement('canvas');canvas.width=1280;canvas.height=720;
    if(typeof canvas.captureStream!=='function')throw Error('Canvas captureStream không được hỗ trợ.');
    const context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('Canvas 2D không khả dụng.');
    const output=canvas.captureStream(30),urls=[],videos=[],chunks=[];
    let audioContext=null,destination=null,recorder=null,frame=0,watchdog=0,bytes=0,total=0,completed=0,finished=false;
    const abort=()=>{if(options.signal?.aborted)throw new DOMException('Đã hủy xuất video.','AbortError');};
    const waitEvent=(target,event)=>new Promise((resolve,reject)=>{
      let timeout;const clear=()=>{clearTimeout(timeout);target.removeEventListener(event,ok);target.removeEventListener('error',error);options.signal?.removeEventListener('abort',cancel);};
      const ok=()=>{clear();resolve();},error=()=>{clear();reject(Error('Không giải mã được video.'));},cancel=()=>{clear();reject(new DOMException('Đã hủy.','AbortError'));};
      target.addEventListener(event,ok,{once:true});target.addEventListener('error',error,{once:true});options.signal?.addEventListener('abort',cancel,{once:true});timeout=setTimeout(()=>{clear();reject(Error('Video không phản hồi trong 20 giây.'));},20000);if(options.signal?.aborted)cancel();
    });
    try{
      const Audio=global.AudioContext||global.webkitAudioContext;
      if(Audio){audioContext=new Audio();await audioContext.resume();destination=audioContext.createMediaStreamDestination();destination.stream.getAudioTracks().forEach(track=>output.addTrack(track));}
      for(const file of config.files){
        abort();const video=global.document.createElement('video');video.preload='auto';video.playsInline=true;video.autoplay=false;video.muted=!audioContext;
        const url=URL.createObjectURL(file);urls.push(url);videos.push(video);const ready=waitEvent(video,'loadeddata');video.src=url;await ready;
        if(!Number.isFinite(video.duration)||video.duration<=0)throw Error('Thời lượng video không hợp lệ.');
        const start=config.files.length===1?config.start:0,end=config.files.length===1&&config.end!==null?config.end:video.duration;
        if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>video.duration+.02)throw Error('Khoảng cắt nằm ngoài video.');
        video.gwbRange={start,end};total+=end-start;
        if(total>120)throw Error('Bản xuất realtime tối đa 120 giây. Hãy cắt thành đoạn ngắn hơn.');
        if(audioContext)audioContext.createMediaElementSource(video).connect(destination);
      }
      recorder=new global.MediaRecorder(output,{mimeType:mime,videoBitsPerSecond:4000000});
      const stopped=new Promise((resolve,reject)=>{recorder.addEventListener('stop',resolve,{once:true});recorder.addEventListener('error',event=>reject(Error(event.error?.message||'Không thể mã hóa video.')),{once:true});});
      // Observe rejections immediately even while a clip is playing.
      stopped.catch(()=>{});
      recorder.addEventListener('dataavailable',event=>{if(event.data?.size){bytes+=event.data.size;if(bytes>96*1024*1024){finished=true;return;}chunks.push(event.data);}});
      context.fillStyle='#050918';context.fillRect(0,0,1280,720);recorder.start(500);
      for(const video of videos){
        abort();const {start,end}=video.gwbRange;
        if(start>0){const seek=waitEvent(video,'seeked');video.currentTime=start;await seek;}
        await video.play();abort();
        await new Promise((resolve,reject)=>{
          let lastTime=video.currentTime,lastProgress=Date.now();
          const cleanup=()=>{cancelAnimationFrame(frame);clearInterval(watchdog);video.pause();options.signal?.removeEventListener('abort',cancel);};
          const cancel=()=>{cleanup();reject(new DOMException('Đã hủy.','AbortError'));};
          const draw=()=>{
            try {
            if(finished){cleanup();reject(Error('Video vượt giới hạn 96 MB.'));return;}
            if(video.currentTime>=end||video.ended){cleanup();resolve();return;}
            context.fillStyle='#050918';context.fillRect(0,0,1280,720);
            const ratio=Math.min(1280/video.videoWidth,720/video.videoHeight),w=video.videoWidth*ratio,h=video.videoHeight*ratio;
            context.drawImage(video,(1280-w)/2,(720-h)/2,w,h);
            if(config.text){context.font='bold 52px sans-serif';context.textAlign='center';context.textBaseline='middle';context.lineWidth=5;context.strokeStyle='#08101d';context.fillStyle=config.color;context.strokeText(config.text,640,590,1120);context.fillText(config.text,640,590,1120);}
            options.onProgress?.(Math.min(1,(completed+Math.max(0,video.currentTime-start))/total));
            frame=requestAnimationFrame(draw);
            } catch(error) { cleanup(); reject(error); }
          };
          watchdog=setInterval(()=>{if(video.currentTime!==lastTime){lastTime=video.currentTime;lastProgress=Date.now();}else if(Date.now()-lastProgress>20000){cleanup();reject(Error('Xuất bị dừng vì video/tab không tiến triển.'));}},1000);
          options.signal?.addEventListener('abort',cancel,{once:true});draw();
        });
        completed+=end-start;
      }
      abort();recorder.stop();await stopped;finished=true;
      const blob=new Blob(chunks,{type:mime.split(';')[0]});if(!blob.size)throw Error('Bộ mã hóa không trả dữ liệu.');options.onProgress?.(1);
      return {blob,width:1280,height:720,duration:total,mime:blob.type,audio:!!audioContext};
    }finally{
      finished=true;cancelAnimationFrame(frame);clearInterval(watchdog);
      if(recorder&&recorder.state!=='inactive')try{recorder.stop();}catch{}
      videos.forEach(video=>{video.pause();video.removeAttribute('src');video.load();});urls.forEach(url=>URL.revokeObjectURL(url));output.getTracks().forEach(track=>track.stop());await audioContext?.close?.();
    }
  }
  return Object.freeze({chooseMime,validate,render});
});
