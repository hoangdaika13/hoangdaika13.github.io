/* Local-only runtime. No media downloads, network voices or auto-start. */
(function(global) {
  "use strict";
  function createLock(locks) {
    let releaseHold=null, cancelled=false;
    return {
      supported:Boolean(locks?.request),
      acquire(name) {
        if (!locks?.request || cancelled) return Promise.resolve(false);
        return new Promise(resolve => {
          locks.request(name,{ifAvailable:true,mode:"exclusive"},lock=>{
            if (!lock || cancelled) {resolve(false);return;}
            return new Promise(release=>{releaseHold=release;resolve(true);});
          }).catch(()=>resolve(false));
        });
      },
      release() {cancelled=true;releaseHold?.();releaseHold=null;}
    };
  }
  function createSpeech({synth=global.speechSynthesis,Utterance=global.SpeechSynthesisUtterance,onState=()=>{},onLine=()=>{},clock=global}={}) {
    let phase="idle", lines=[], index=0, rate=.88, repeat=false, token=0, pending=null, nextTimer=0, sleepTimer=0, startTimer=0;
    const voices = () => (synth?.getVoices?.()||[]).filter(v=>/^vi(?:[-_]|$)/i.test(v.lang)&&v.localService===true);
    function emit(next,message="") {phase=next;onState({phase,index,message});}
    function clear() {clock.clearTimeout(nextTimer);clock.clearTimeout(sleepTimer);clock.clearTimeout(startTimer);nextTimer=0;sleepTimer=0;startTimer=0;if(pending){pending.onend=null;pending.onerror=null;pending.onstart=null;}pending=null;}
    function stop(next="idle",message="") {token++;clear();synth?.cancel?.();emit(next,message);}
    function speak() {
      if (phase!=="playing") return;
      const voice=voices()[0];
      if (!voice) return stop("error","Chưa có giọng tiếng Việt chạy trên thiết bị. Bạn vẫn có thể tự đọc; HH không dùng giọng mạng.");
      const generation=token, utterance=new Utterance(lines[index]);pending=utterance;
      utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=rate;onLine(index);
      startTimer=clock.setTimeout(()=>{if(token===generation)stop("error","Giọng đọc chưa khởi chạy. Hãy thử lại hoặc đọc văn bản.");},15000);
      utterance.onstart=()=>{clock.clearTimeout(startTimer);startTimer=0;};
      utterance.onerror=event=>{if(token===generation)stop("error",`Không phát được giọng đọc (${String(event.error||"không rõ")}). Văn bản vẫn dùng được.`);};
      utterance.onend=()=>{
        if (token!==generation || phase!=="playing") return;
        clock.clearTimeout(startTimer);pending=null;
        if(index+1>=lines.length){if(!repeat)return stop("ended","Đã đọc hết bài.");index=0;}else index++;
        nextTimer=clock.setTimeout(speak,160);
      };
      try {synth.speak(utterance);} catch {stop("error","Thiết bị không khởi chạy được giọng đọc.");}
    }
    return {
      voices,
      status:()=>({phase,index}),
      start(options) {
        stop();
        if (!synth || !Utterance) {emit("error","Trình duyệt không hỗ trợ đọc văn bản. Bạn có thể tự đọc.");return false;}
        if (!voices().length) {emit("error","Chưa có giọng tiếng Việt chạy trên thiết bị. Bạn vẫn có thể tự đọc; HH không dùng giọng mạng.");return false;}
        lines=options.lines.map(String).filter(Boolean);if(!lines.length)return false;
        index=Math.max(0,Math.min(lines.length-1,Number(options.index)||0));rate=options.rate||.88;repeat=Boolean(options.repeat);
        emit("playing");speak();
        if(phase==="playing"&&options.sleepMinutes>0)sleepTimer=clock.setTimeout(()=>stop("paused","Đã dừng theo hẹn giờ; tiếp tục sẽ đọc lại câu hiện tại."),options.sleepMinutes*60000);
        return phase==="playing";
      },
      pause(){if(phase==="playing")stop("paused","Đã tạm dừng. Tiếp tục sẽ đọc lại câu hiện tại.");},
      stop:()=>stop(),
      dispose(){stop();}
    };
  }
  global.HHDharmaPracticeRuntime=Object.freeze({createLock,createSpeech});
})(typeof window!=="undefined"?window:globalThis);
