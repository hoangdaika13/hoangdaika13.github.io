(function(scope,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else scope.HHStudyCampusCore=api;})(globalThis,function(){
  "use strict";
  const fail=message=>{throw Object.assign(Error(message),{statusCode:400,code:"CAMPUS_INVALID"});};
  const text=(value,max)=>{if(typeof value!=="string"||value.length>max)fail("Nội dung vượt giới hạn hoặc sai kiểu.");return value.trim();};
  const pad=n=>String(n).padStart(2,"0");
  const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
  function parts(ms,zone){const fields={};for(const p of new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(ms))fields[p.type]=p.value;return fields.year+"-"+fields.month+"-"+fields.day+"T"+fields.hour+":"+fields.minute;}
  function zonedUTC(local,zone){
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))fail("Ngày giờ cần đúng định dạng.");
    let target=Date.parse(local+"Z");if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,16)!==local)fail("Ngày giờ không hợp lệ.");
    try{parts(target,zone);}catch{fail("Múi giờ IANA không hợp lệ.");}
    let guess=target;for(let i=0;i<4;i++){const delta=target-Date.parse(parts(guess,zone)+"Z");if(!delta)break;guess+=delta;}
    const candidates=[guess,guess-3600000,guess+3600000,guess-7200000,guess+7200000].filter(ms=>parts(ms,zone)===local);
    if(!candidates.length)fail("Giờ này không tồn tại do đổi giờ mùa hè. Chọn giờ khác.");
    return Math.min(...candidates);
  }
  function event(input,id){
    if(!input||typeof input!=="object")fail("Lịch không hợp lệ.");
    const title=text(input.title,120),zone=text(input.zone,80),localStart=text(input.localStart,16),minutes=Number(input.minutes);
    if(!title||!Number.isInteger(minutes)||minutes<5||minutes>240||!["none","weekly"].includes(input.repeat))fail("Cần chủ đề, thời lượng 5–240 phút và chu kỳ hợp lệ.");
    const startsAt=zonedUTC(localStart,zone);
    let until=input.repeat==="weekly"?text(input.until,10):localStart.slice(0,10);
    if(!validDate(until)||until<localStart.slice(0,10)||Date.parse(until+"T00:00:00Z")-Date.parse(localStart.slice(0,10)+"T00:00:00Z")>364*86400000)fail("Ngày kết thúc cần trong vòng 52 tuần.");
    const exceptions=input.exceptions||[];if(!Array.isArray(exceptions)||exceptions.length>20)fail("Tối đa 20 ngoại lệ.");
    const seen=new Set(),safe=exceptions.map(x=>{if(!x||!validDate(x.date)||x.date<localStart.slice(0,10)||x.date>until||seen.has(x.date)||(Date.parse(x.date+"T00:00:00Z")-Date.parse(localStart.slice(0,10)+"T00:00:00Z"))%(7*86400000))fail("Ngoại lệ phải thuộc lịch gốc, không trùng ngày.");seen.add(x.date);if(x.localStart)zonedUTC(x.localStart,zone);return {date:x.date,cancelled:x.cancelled===true,...(x.localStart?{localStart:x.localStart}: {})};});
    return {id,title,zone,localStart,startsAt,minutes,repeat:input.repeat,until,exceptions:safe,cancelled:input.cancelled===true,leader:text(input.leader||"",64)};
  }
  function occurrences(events,from=-Infinity,to=Infinity){
    const result=[];for(const e of events){let day=Date.parse(e.localStart.slice(0,10)+"T12:00:00Z");for(let i=0;i<=52;i++,day+=7*86400000){
      const date=new Date(day).toISOString().slice(0,10);if(date>e.until||i>0&&e.repeat!=="weekly")break;const exception=e.exceptions.find(x=>x.date===date);let start;try{start=zonedUTC(exception?.localStart||date+e.localStart.slice(10),e.zone);}catch{continue;}const end=start+e.minutes*60000;if(start>=from&&start<to)result.push({...e,date,occurrenceId:e.id+"@"+date,startsAt:start,endsAt:end,cancelled:e.cancelled||exception?.cancelled===true});
    }}return result.sort((a,b)=>a.startsAt-b.startsAt);
  }
  const icsText=v=>String(v).replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
  const utc=ms=>new Date(ms).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  function ics(events,now=Date.now()){
    const rows=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//HH//Cosmic Study Campus//VI","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
    for(const e of occurrences(events)){rows.push("BEGIN:VEVENT","UID:"+e.occurrenceId+"@hoang8.com","DTSTAMP:"+utc(now),"DTSTART:"+utc(e.startsAt),"DTEND:"+utc(e.endsAt),"SUMMARY:"+icsText(e.title),"DESCRIPTION:"+icsText("Múi giờ lớp: "+e.zone),...(e.cancelled?["STATUS:CANCELLED"]:[]),"END:VEVENT");}rows.push("END:VCALENDAR");
    const encoder=new TextEncoder(),fold=line=>{let result="",size=0;for(const char of line){const bytes=encoder.encode(char).length;if(size+bytes>73){result+="\r\n ";size=1;}result+=char;size+=bytes;}return result;};return rows.map(fold).join("\r\n")+"\r\n";
  }
  function question(input,id){
    if(!input||!["mcq","truefalse","short"].includes(input.type))fail("Loại câu hỏi chưa được hỗ trợ.");
    const prompt=text(input.prompt,500);if(!prompt)fail("Nhập câu hỏi.");
    const options=input.type==="truefalse"?["Đúng","Sai"]:input.type==="mcq"?input.options:[];
    if(input.type!=="short"&&(!Array.isArray(options)||options.length<2||options.length>6||options.some(x=>typeof x!=="string"||!x.trim()||x.length>150)||new Set(options.map(x=>x.trim())).size!==options.length))fail("Cần 2–6 đáp án khác nhau.");
    if(input.type!=="short"&&(!Number.isInteger(input.answer)||input.answer<0||input.answer>=options.length))fail("Chọn chỉ số đáp án đúng.");
    return {id,type:input.type,prompt,options:options.map(s=>s.trim()),answer:input.type==="short"?text(input.answer||"",500):input.answer};
  }
  function publicQuiz(quiz,manager,now=Date.now()){
    const closed=quiz.state==="closed"||quiz.state==="open"&&now>=quiz.deadline;
    return {id:quiz._id,title:quiz.title,minutes:quiz.minutes,revision:quiz.revision,state:closed?"closed":quiz.state,deadline:quiz.deadline||null,reveal:closed&&quiz.reveal,questions:quiz.questions.map(({id,type,prompt,options,answer})=>({id,type,prompt,options,...(manager||closed&&quiz.reveal?{answer}: {})}))};
  }
  function score(quiz,submission){let earned=0,pending=0;for(const q of quiz.questions){const a=submission.answers.find(a=>a.id===q.id);if(q.type==="short"){const grade=submission.grades?.[q.id];if(grade===0||grade===1)earned+=grade;else pending++;}else if(a?.value===q.answer)earned++;}return {earned,max:quiz.questions.length,pending};}
  return Object.freeze({zonedUTC,event,occurrences,ics,question,publicQuiz,score,text});
});
