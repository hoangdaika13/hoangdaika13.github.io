(function(root,factory){"use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.HHGalaxyWorkbenchCore=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const MAX_SAMPLES=24_000_000;
  function fail(code,message){const error=new Error(message);error.code=code;throw error;}
  function bounded(value,min,max,label){const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)fail("INVALID_INPUT",label+" không hợp lệ.");return number;}
  function audioInput(buffer){
    if(!buffer||!Number.isInteger(buffer.sampleRate)||!Number.isInteger(buffer.length)||buffer.length<1||buffer.length>MAX_SAMPLES||!Number.isInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1||buffer.numberOfChannels>2)fail("AUDIO_LIMIT","Âm thanh cần 1–2 kênh và tối đa 24 triệu mẫu mỗi kênh.");
    bounded(buffer.sampleRate,8000,192000,"Sample rate");
    for(let c=0;c<buffer.numberOfChannels;c++){const samples=buffer.getChannelData(c);if(!(samples instanceof Float32Array)||samples.length!==buffer.length)fail("AUDIO_DATA","Dữ liệu PCM không hợp lệ.");}
    return buffer;
  }
  function trimAudio(buffer,options={}){
    audioInput(buffer);
    const duration=buffer.length/buffer.sampleRate;
    const start=bounded(options.start??0,0,duration,"Điểm bắt đầu"),end=bounded(options.end??duration,0,duration,"Điểm kết thúc");
    const from=Math.floor(start*buffer.sampleRate),to=Math.min(buffer.length,Math.ceil(end*buffer.sampleRate));
    if(to<=from)fail("TRIM_RANGE","Điểm kết thúc phải sau điểm bắt đầu.");
    const gain=bounded(options.gain??1,0,4,"Gain"),fadeIn=bounded(options.fadeIn??0,0,end-start,"Fade in"),fadeOut=bounded(options.fadeOut??0,0,end-start,"Fade out");
    const length=to-from,channels=[];
    for(let c=0;c<buffer.numberOfChannels;c++){
      const input=buffer.getChannelData(c),output=new Float32Array(length);
      for(let i=0;i<length;i++){
        const fade=Math.min(1,fadeIn?i/(fadeIn*buffer.sampleRate):1,fadeOut?(length-1-i)/(fadeOut*buffer.sampleRate):1);
        output[i]=Math.max(-1,Math.min(1,(Number.isFinite(input[from+i])?input[from+i]:0)*gain*Math.max(0,fade)));
      }
      channels.push(output);
    }
    return {sampleRate:buffer.sampleRate,length,numberOfChannels:channels.length,getChannelData:c=>channels[c]};
  }
  function mixAudio(buffers,options={}){
    if(!Array.isArray(buffers)||buffers.length<2||buffers.length>8)fail("MIX_TRACKS","Chọn từ 2 đến 8 track.");
    buffers.forEach(audioInput);
    const sampleRate=bounded(options.sampleRate??buffers[0].sampleRate,8000,96000,"Sample rate"),channels=Math.max(...buffers.map(b=>b.numberOfChannels));
    const length=Math.ceil(Math.max(...buffers.map(b=>b.length/b.sampleRate))*sampleRate);
    if(length>MAX_SAMPLES)fail("MIX_LIMIT","Bản mix vượt giới hạn bộ nhớ.");
    const output=Array.from({length:channels},()=>new Float32Array(length));
    buffers.forEach((buffer,index)=>{
      const gain=bounded(options.gains?.[index]??1/buffers.length,0,4,"Gain track");
      const ratio=buffer.sampleRate/sampleRate;
      for(let c=0;c<channels;c++){
        const input=buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1));
        for(let i=0;i<length&&i*ratio<input.length;i++){
          const pos=i*ratio,lo=Math.floor(pos),f=pos-lo;
          const a=Number.isFinite(input[lo])?input[lo]:0,b=Number.isFinite(input[Math.min(lo+1,input.length-1)])?input[Math.min(lo+1,input.length-1)]:0;
          output[c][i]+=(a+(b-a)*f)*gain;
        }
      }
    });
    let peak=1;output.forEach(data=>{for(const value of data)peak=Math.max(peak,Math.abs(value));});
    output.forEach(data=>{for(let i=0;i<data.length;i++)data[i]/=peak;});
    return {sampleRate,length,numberOfChannels:channels,getChannelData:c=>output[c]};
  }
  function encodeWav(buffer){
    audioInput(buffer);
    const bytes=buffer.length*buffer.numberOfChannels*2,output=new ArrayBuffer(44+bytes),view=new DataView(output);
    const ascii=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
    ascii(0,"RIFF");view.setUint32(4,36+bytes,true);ascii(8,"WAVE");ascii(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,buffer.numberOfChannels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*buffer.numberOfChannels*2,true);view.setUint16(32,buffer.numberOfChannels*2,true);view.setUint16(34,16,true);ascii(36,"data");view.setUint32(40,bytes,true);
    let offset=44;for(let i=0;i<buffer.length;i++)for(let c=0;c<buffer.numberOfChannels;c++){let value=buffer.getChannelData(c)[i];value=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;view.setInt16(offset,Math.round(value*(value<0?32768:32767)),true);offset+=2;}
    return output;
  }
  function promptVariables(template,values={}){
    const names=[...new Set([...String(template).matchAll(/\{\{\s*([a-zA-Z][\w.-]{0,49})\s*\}\}/g)].map(m=>m[1]))];
    if(names.length>30)fail("PROMPT_VARIABLES","Tối đa 30 biến trong prompt.");
    const missing=names.filter(name=>!Object.hasOwn(values,name));
    const text=String(template).replace(/\{\{\s*([a-zA-Z][\w.-]{0,49})\s*\}\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
    if(text.length>20000)fail("PROMPT_TOO_LONG","Prompt sau thay biến vượt 20.000 ký tự.");
    return {names,missing,text};
  }
  function lineDiff(before,after){
    const a=String(before).split(/\r?\n/),b=String(after).split(/\r?\n/);
    if(a.length*b.length>300000)fail("DIFF_LIMIT","So sánh tối đa 300.000 cặp dòng; hãy chia nhỏ văn bản.");
    const table=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
    for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i][j]=a[i]===b[j]?1+table[i+1][j+1]:Math.max(table[i+1][j],table[i][j+1]);
    const result=[];let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){result.push({kind:"same",text:a[i++]});j++;}else if(j<b.length&&(i===a.length||table[i][j+1]>=table[i+1][j]))result.push({kind:"add",text:b[j++]});else result.push({kind:"remove",text:a[i++]});}return result;
  }
  function serializeSubtitles(cues,format="srt"){
    if(!Array.isArray(cues)||cues.length>5000)fail("SUBTITLE_LIMIT","Phụ đề vượt giới hạn cue.");
    const stamp=ms=>{bounded(ms,0,3599999999,"Mốc thời gian");const value=Math.round(ms),h=Math.floor(value/3600000),m=Math.floor(value/60000)%60,s=Math.floor(value/1000)%60;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}${format==="srt"?",":"."}${String(value%1000).padStart(3,"0")}`;};
    return (format==="vtt"?"WEBVTT\n\n":"")+cues.map((cue,i)=>{if(cue.endMs<=cue.startMs)fail("SUBTITLE_TIME","Cue phải có kết thúc sau bắt đầu.");const text=String(cue.text||"").replace(/\r/g,"").trim();if(!text||text.length>4000)fail("SUBTITLE_TEXT","Nội dung cue trống hoặc quá dài.");return `${i+1}\n${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${text}`;}).join("\n\n")+"\n";
  }
  function mistakeNotebook(state){
    const cards=new Map();for(const deck of state?.decks||[])for(const card of deck.cards||[])if(!deck.isSample&&!card.isSample)cards.set(deck.id+":"+card.id,{deck:deck.title,card});
    const mistakes=new Map();for(const log of state?.activities||[]){if(log.type!=="quiz-answer"||log.correct!==false)continue;const key=log.deckId+":"+log.cardId,entry=cards.get(key);if(!entry)continue;const existing=mistakes.get(key)||{...entry,wrong:0,lastAt:""};existing.wrong++;if(log.at>existing.lastAt)existing.lastAt=log.at;mistakes.set(key,existing);}return [...mistakes.values()].sort((a,b)=>b.lastAt.localeCompare(a.lastAt));
  }
  function highlightCode(value,language){
    const source=String(value||'');if(source.length>100000)fail('CODE_LIMIT','Mã nguồn vượt giới hạn.');
    const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const pattern=/(\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|for|while|class|new|true|false|null|async|await|import|export)\b|\b\d+(?:\.\d+)?\b)/g;
    return source.split('\n').map((line,i)=>{let end=0,html='';for(const match of line.matchAll(pattern)){html+=esc(line.slice(end,match.index));const text=match[0],kind=/^["']/.test(text)?'string':/^\d/.test(text)?'number':/^(\/\/|#)/.test(text)?'comment':'keyword';html+='<span class="gwb-token-'+kind+'">'+esc(text)+'</span>';end=match.index+text.length;}return '<span class="gwb-code-line"><i aria-hidden="true">'+(i+1)+'</i><code>'+html+esc(line.slice(end))+'</code></span>';}).join('');
  }
  function productionPackage(project){
    if(!project||project.isDemo)fail('PROJECT_REQUIRED','Chọn dự án của bạn, không phải bản mẫu.');
    const steps=['idea','script','image','voice','music','video','thumbnail','seo','publish'];
    const files={'project.json':JSON.stringify(project,null,2)};
    const manifest={schema:'hh-galaxy.production-package',version:1,projectId:project.id,title:project.title,includesBinaryMedia:false,steps:[]};
    steps.forEach((id,i)=>{const step=project.steps?.[id]||{},name=String(i+1).padStart(2,'0')+'-'+id+'.md';files[name]='# '+id+'\n\n'+String(step.content||'')+'\n\n## Ghi chú\n'+String(step.notes||'')+'\n\n## Checklist\n'+(step.checklist||[]).map(item=>'- ['+(item.done?'x':' ')+'] '+String(item.text||item.label||'')).join('\n');manifest.steps.push({id,status:step.status||'not-started',file:name});});
    files['manifest.json']=JSON.stringify(manifest,null,2);files['README.txt']='Gói sản xuất cục bộ HH Galaxy Lớp 1.\nChứa project JSON, nội dung/checklist 9 bước và manifest.\nKhông bao gồm media nhị phân; không có nội dung nào được đăng lên mạng.\n';return files;
  }
  return Object.freeze({MAX_SAMPLES,trimAudio,mixAudio,encodeWav,promptVariables,lineDiff,serializeSubtitles,mistakeNotebook,highlightCode,productionPackage});
});
