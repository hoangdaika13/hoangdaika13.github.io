(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.HHEnglishAcademyCore=api;})(globalThis,function(){
  "use strict";
  const provenance=Object.freeze({author:"HH English · AI-assisted original draft",source:"Project curriculum and original practice design",license:"Project-owned content; no third-party assets",reviewStatus:"draft",createdAt:"2026-10-09"});
  const normalize=v=>String(v??"").normalize("NFKC").replace(/[‘’]/g,"'").trim().toLocaleLowerCase("en-US").replace(/[.!?,;:"]/g,"").replace(/\s+/g," ");
  const line=lesson=>String(lesson.dialogue||lesson.listening||"").split("\n").map(s=>s.replace(/^[^:]{1,30}:\s*/,"").trim()).find(Boolean)||String(lesson.canDo||lesson.title||"");
  const hash=s=>{let value=2166136261;for(const ch of String(s)){value^=ch.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;};
  function shuffle(items,seed){const result=[...items];let value=hash(seed);for(let i=result.length-1;i>0;i--){value=(Math.imul(value,1664525)+1013904223)>>>0;const j=value%(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}
  function task(lesson,type="choice",index=0){
    const q=(lesson.exercises||[])[index]||(lesson.exercises||[])[0],words=(lesson.vocabulary||[]).filter(w=>Array.isArray(w)&&w[0]&&w[2]).slice(0,4),target=line(lesson);
    const base={id:lesson.id+":"+type+":"+index,type,level:lesson.level,provenance,explanation:q?.explanation||"Đối chiếu nội dung bài. Câu cần đúng trật tự, không chỉ chứa cùng một tập từ."};
    if(type==="match")return words.length>=2?{...base,prompt:"Ghép từ/cụm trong bài với nghĩa đã có.",pairs:words.map((w,i)=>({id:String(i),term:w[0],meaning:w[2]})),choices:shuffle(words.map((w,i)=>({id:String(i),meaning:w[2]})),base.id)}:null;
    if(type==="order")return target?{...base,prompt:"Khôi phục câu trong bài theo đúng trật tự.",expected:target,tiles:shuffle(target.split(/\s+/).map((word,i)=>({id:String(i),word})),base.id)}:null;
    if(type==="dictation")return target?{...base,prompt:"Nghe giọng tổng hợp và chép lại câu.",expected:target,variants:[],sample:target}:null;
    if(!q||!q.answer)return null;
    if(type==="correction"){const wrong=(q.options||[]).find(o=>normalize(o)!==normalize(q.answer));if(!wrong)return null;return {...base,prompt:q.prompt,wrong,expected:q.answer,variants:q.acceptedAnswers||[],instruction:"Thay lựa chọn chưa phù hợp bằng câu trả lời đúng theo đề bài; không phải công cụ tự chấm ngữ pháp tự do."};}
    return {...base,type:type==="gap"?"gap":"choice",prompt:q.prompt,options:type==="gap"?[]:q.options||[],expected:q.answer,variants:q.acceptedAnswers||[]};
  }
  function evaluate(t,answer){
    if(!t)return {status:"unavailable",correct:false,score:null,explanation:"Bài chưa có dữ liệu chấm."};
    let correct=false;
    if(t.type==="match")correct=Array.isArray(answer)&&answer.length===t.pairs.length&&t.pairs.every(p=>answer.find(x=>x.id===p.id)?.value===p.id);
    else{const text=Array.isArray(answer)&&t.type==="order"?answer.map(id=>t.tiles.find(x=>x.id===id)?.word||"").join(" "):String(answer??"");correct=[t.expected,...(t.variants||[])].filter(v=>typeof v==="string"&&v.trim()).some(v=>normalize(text)===normalize(v));}
    return {correct,score:correct?100:0,status:correct?"assessed-correct":"retry",method:"authored-answer-v1",explanation:t.explanation,expected:t.expected||t.pairs?.map(p=>p.term+" → "+p.meaning).join(";")||""};
  }
  function completion(checkpoint,steps){
    const missing=steps.filter(id=>!checkpoint.completedSteps?.includes(id)||checkpoint.skippedSteps?.includes(id));
    const assessed=["gist","gap","order","challenge","recall"].filter(id=>steps.includes(id));
    for(const id of assessed)if(checkpoint.answers?.[id]?.graded!==true||checkpoint.answers?.[id]?.correct!==true)if(!missing.includes(id))missing.push(id);
    return {eligible:missing.length===0,missing,assessed:assessed.filter(id=>checkpoint.answers?.[id]?.graded===true&&checkpoint.answers[id].correct===true),selfReported:steps.filter(id=>checkpoint.evidence?.[id]?.kind==="self-report")};
  }
  const writingTemplates=Object.freeze([
    {id:"A0",label:"Giới thiệu ngắn · dự bị nội bộ",title:"Introduce yourself",min:15,prompt:"Viết 3–5 câu giới thiệu bản thân.",outline:["My name is …","I live in …","I like …"],checklist:["Có tên/thông tin muốn chia sẻ","Có câu với I am / I live / I like","Đọc lại chữ hoa và dấu chấm"]},
    {id:"A1",label:"A1 · Email làm quen",title:"An introduction email",min:35,prompt:"Viết email giới thiệu bản thân với một người bạn mới.",outline:["Hi …,","My name is … . I am from … .","In my free time, I … .","What do you like doing?","Best wishes,"],checklist:["Có lời chào và kết thúc","Giới thiệu ít nhất hai thông tin","Có một câu hỏi cho người nhận"]},
    {id:"A2",label:"A2 · Kể trải nghiệm",title:"A memorable day",min:70,prompt:"Kể một ngày đáng nhớ: chuyện gì xảy ra và bạn cảm thấy thế nào.",outline:["Last …, I … .","First, … . Then, … .","I felt … because … ."],checklist:["Nêu thời gian và địa điểm","Dùng quá khứ khi kể sự kiện","Nêu cảm xúc và lý do"]},
    {id:"B1",label:"B1 · Nêu quan điểm",title:"Learning with a group",min:100,prompt:"Nêu quan điểm về học một mình và học nhóm, có ví dụ.",outline:["In my opinion, … .","One advantage is … . For example, … .","However, … .","Overall, … ."],checklist:["Quan điểm rõ","Có lý do và ví dụ","Có liên kết giữa các đoạn"]},
    {id:"B2",label:"B2 · Email đề xuất",title:"Propose a study programme",min:140,prompt:"Đề xuất một chương trình học cho nhóm và giải thích lợi ích/hạn chế.",outline:["Dear …,","I would like to propose … .","The main benefits would be … .","One potential challenge is … .","I suggest … ."],checklist:["Mục đích và người nhận phù hợp","Đánh giá cả lợi ích và hạn chế","Đề nghị bước thực hiện cụ thể"]},
    {id:"C1",label:"C1 · Lập luận có giới hạn",title:"Evaluate a learning policy",min:180,prompt:"Đánh giá chính sách học trực tuyến: phân tích, phản biện và giới hạn bằng chứng.",outline:["This proposal aims to … .","The available evidence suggests … .","Nevertheless, this interpretation is limited by … .","A more practical approach would be … ."],checklist:["Luận điểm có phạm vi","Phản biện được trình bày công bằng","Không gán nguồn/bằng chứng không có"]},
    {id:"C2",label:"C2 · Tổng hợp và sắc thái",title:"A nuanced recommendation",min:220,prompt:"Tổng hợp hai quan điểm trái chiều và đề xuất có điều kiện; không tự tạo trích dẫn.",outline:["The apparent disagreement concerns … .","While … emphasises …, … prioritises … .","These positions can be reconciled if … .","Any recommendation should remain conditional on … ."],checklist:["Phân biệt lập trường và giả định","Điều chỉnh sắc thái phù hợp người đọc","Kết luận giữ đúng giới hạn của lập luận"]}
  ]);
  const sounds=Object.freeze([
    {id:"i",title:"/iː/ và /ɪ/",pairs:[["sheep","ship"],["leave","live"]],tip:"Nghe độ dài và vị trí lưỡi; không kéo dài mọi nguyên âm.",phrase:"The sheep is near the ship."},
    {id:"th",title:"/θ/ và /s/",pairs:[["think","sink"],["thin","sin"]],tip:"Với /θ/, đầu lưỡi gần/kẽ răng, đẩy luồng khí nhẹ; đây là hướng dẫn tự luyện, không là chẩn đoán âm.",phrase:"I think the path is thin."},
    {id:"dh",title:"/ð/ và /d/",pairs:[["they","day"],["then","den"]],tip:"So sánh rung thanh quản với âm đầu /ð/ và /d/ khi nghe mẫu.",phrase:"They will be there."},
    {id:"v",title:"/v/ và /w/",pairs:[["vine","wine"],["vest","west"]],tip:"/v/: môi dưới gần răng trên. /w/: môi tròn; tránh biến cả hai thành cùng một âm.",phrase:"We visited the vineyard."},
    {id:"final",title:"Âm cuối và cụm âm",pairs:[["rice","rise"],["cap","cab"]],tip:"Nghe sự khác nhau của âm cuối; không tự thêm một nguyên âm sau phụ âm.",phrase:"Please send the next draft."},
    {id:"stress",title:"Trọng âm từ",pairs:[["REcord","reCORD"],["PREsent","preSENT"]],tip:"Dùng ngữ cảnh và IPA trong bài để xác định trọng âm; chữ hoa chỉ là hướng dẫn thị giác.",phrase:"I will record a short message."},
    {id:"link",title:"Nối âm trong cụm",pairs:[["turn off","turn on"],["pick it up","put it down"]],tip:"Nghe cả cụm rồi tự ghi âm đối chiếu. Không dùng transcript để đo độ nối âm.",phrase:"Could you pick it up?"},
    {id:"schwa",title:"Nguyên âm không nhấn /ə/",pairs:[["about","above"],["a teacher","a doctor"]],tip:"Âm không nhấn thường ngắn và nhẹ; tránh nhấn mọi âm tiết như nhau.",phrase:"A teacher is talking about a doctor."}
  ]);
  const conversations=Object.freeze([
    ["introduce","Làm quen","Introduce yourself and ask one question.","Hi! I'm Alex. What's your name?","Nice to meet you. What do you enjoy doing?",["name","from","enjoy"],"Share two details and ask a follow-up."],
    ["cafe","Gọi đồ uống","Order a drink and clarify your preference.","What would you like to drink?","Would you like it hot or iced?",["like","please","hot"],"State an order and one preference."],
    ["travel","Hỏi đường","Ask for directions and confirm understanding.","How can I help you?","The station is two streets away. What would you like to check?",["where","station","left"],"Ask politely and confirm a direction."],
    ["hotel","Đặt phòng","Ask about room availability and conditions.","What dates are you planning to stay?","Would you prefer a single or a double room?",["room","night","available"],"Give dates and ask about one condition."],
    ["shopping","Mua sắm","Ask about size, price and availability.","Are you looking for a particular size?","Would you like to try a different colour?",["size","price","try"],"Ask about a product and respond to an option."],
    ["study","Học nhóm","Set a goal and divide a task.","What should our group work on today?","Which part would you like to take?",["review","task","together"],"Agree a goal and suggest a contribution."],
    ["meeting","Cuộc họp","Clarify a proposal and suggest a next step.","What is your main suggestion?","What concern should we consider before deciding?",["suggest","because","next"],"Give a reason and address a concern."],
    ["interview","Phỏng vấn","Explain relevant experience with an example.","Could you tell me about a skill relevant to this role?","Can you give a specific example?",["experience","example","learned"],"Describe a real example; do not invent credentials."],
    ["presentation","Thuyết trình","Introduce an idea and answer a question.","What is the main point of your presentation?","Why does this matter to your audience?",["main","example","important"],"State a main point with one supporting detail."],
    ["negotiate","Thương lượng","Make a proposal and offer a reasonable alternative.","What arrangement would work for you?","Is there an alternative we could both accept?",["could","offer","alternative"],"Propose, explain and consider an alternative."],
    ["email","Làm rõ email","Clarify an unclear message respectfully.","Which part of the message would you like to clarify?","How could you ask without sounding demanding?",["clarify","mean","please"],"Ask a precise, polite question."],
    ["feedback","Đưa phản hồi","Give specific constructive feedback.","What worked well, and what could improve?","Can you suggest one practical change?",["worked","improve","suggest"],"Name an observation and a suggestion."],
    ["support","Hỗ trợ khách hàng","Explain a problem and ask for a next step.","Could you describe the issue?","What have you tried so far?",["problem","tried","help"],"Describe the problem and relevant steps."],
    ["compare","So sánh lựa chọn","Compare two options using relevant criteria.","Which options are you considering?","What is the most important criterion for you?",["prefer","because","however"],"Compare criteria, not just label an option better."],
    ["agree","Đồng ý và phản biện","Disagree politely and explain your reason.","Do you agree with the proposed plan?","What would you change, and why?",["agree","although","reason"],"Acknowledge another view and explain a difference."],
    ["reflect","Tổng kết buổi học","Reflect on one task and plan a next step.","What did you practise today?","What will you try next time?",["practised","difficult","next"],"Describe an actual activity, not an invented achievement."]
  ].map(([id,title,goal,first,second,phrases,criterion])=>({id,title,goal,turns:[first,second],phrases,criterion,provenance})));
  function writingFeedback(text,template){const value=String(text||"").trim(),words=value?value.split(/\s+/).length:0;return {words,paragraphs:value?value.split(/\n\s*\n/).length:0,hasClosingPunctuation:/[.!?]$/.test(value),lengthSuggested:words>=(template?.min||15),method:"local-structure-check",disclaimer:"Chỉ kiểm tra độ dài/cấu trúc bề mặt; không chấm ngữ pháp, chất lượng lập luận, band thi hoặc CEFR."};}
  function conversationFeedback(replies,scenario){const text=normalize(replies.join(" "));return {turns:replies.filter(s=>String(s).trim()).length,phrasesSeen:scenario.phrases.filter(p=>text.includes(normalize(p))),method:"scripted-self-practice",disclaimer:"Hội thoại theo kịch bản; số lượt và từ đã dùng không chứng minh độ trôi chảy hay phát âm."};}
  function normalizeAcademy(state){
    if(!state.learningOS)state.learningOS={};const a=state.learningOS.academy||{};
    const object=v=>v&&typeof v==="object"&&!Array.isArray(v)?v:{},text=(v,n=12000)=>String(v??"").slice(0,n),writing={};
    for(const t of writingTemplates){const w=object(a.writing?.[t.id]);if(Object.keys(w).length)writing[t.id]={checklist:Array.isArray(w.checklist)?w.checklist.filter(i=>Number.isInteger(i)&&i>=0&&i<t.checklist.length):[],versions:Array.isArray(w.versions)?w.versions.slice(0,20).map(v=>({body:text(v.body),words:Math.max(0,Number(v.words)||0),at:text(v.at,40)})):[]};}
    const conversation={};for(const scenario of conversations){const row=object(a.conversation?.[scenario.id]);if(Object.keys(row).length)conversation[scenario.id]={draft:text(row.draft,2000),replies:Array.isArray(row.replies)?row.replies.slice(0,2).map(v=>text(v,2000)):[],history:Array.isArray(row.history)?row.history.slice(0,10).map(h=>({at:text(h.at,40),replies:Array.isArray(h.replies)?h.replies.slice(0,2).map(v=>text(v,2000)):[]})):[],updatedAt:text(row.updatedAt,40)};}
    const practice={};for(const [id,row]of Object.entries(object(a.practice)).slice(0,600))if(/^[a-zA-Z0-9_-]{1,120}$/.test(id))practice[id]={attempts:Math.max(0,Number(row.attempts)||0),correct:Math.max(0,Number(row.correct)||0),drafts:object(row.drafts),last:object(row.last)};
    state.learningOS.academy={version:1,writing:boundVersions(writing),conversation,practice,weekly:{goal:text(a.weekly?.goal,160),skill:text(a.weekly?.skill,30),at:text(a.weekly?.at,40)},timerSessions:Array.isArray(a.timerSessions)?a.timerSessions.slice(-100):[],soundId:sounds.some(s=>s.id===a.soundId)?a.soundId:"i",scenarioId:conversations.some(s=>s.id===a.scenarioId)?a.scenarioId:"introduce",exerciseType:["choice","gap","order","dictation","match","correction"].includes(a.exerciseType)?a.exerciseType:"choice"};
    return state;
  }
  function importState(input,allowed){
    const source=input?.data||input;if(!source||typeof source!=="object"||Array.isArray(source)||source.version!==1)throw Error("Sai phiên bản hoặc cấu trúc dữ liệu.");
    let nodes=0;const clone=(v,depth=0)=>{if(++nodes>80000||depth>20)throw Error("Dữ liệu quá phức tạp.");if(typeof v==="string"){if(v.length>12000)throw Error("Trường văn bản vượt giới hạn.");return v;}if(v===null||typeof v==="boolean")return v;if(typeof v==="number"){if(!Number.isFinite(v))throw Error("Số không hợp lệ.");return v;}if(Array.isArray(v)){if(v.length>2000)throw Error("Mảng vượt giới hạn.");return v.map(x=>clone(x,depth+1));}if(!v||typeof v!=="object")return null;const result={};for(const[k,value]of Object.entries(v)){if(/password|secret|token|authorization|cookie|credential|private[-_]?key|api[-_]?key/i.test(k)||["__proto__","prototype","constructor","ownerId","userId"].includes(k)||k.startsWith("$")||k.includes("."))continue;result[k]=clone(value,depth+1);}return result;};
    const result={};for(const[k,v]of Object.entries(source))if(allowed.includes(k)&&k!=="ownerId")result[k]=clone(v);
    if(result.learningOS){result.learningOS.sync={status:"local",dirty:true,revision:0};delete result.learningOS.localSave;}
    return result;
  }
  function boundVersions(writing){const all=Object.entries(writing).flatMap(([level,row])=>(row.versions||[]).map((v,i)=>({level,i,at:v.at}))).sort((a,b)=>String(b.at).localeCompare(String(a.at))),keep=new Set(all.slice(0,20).map(v=>v.level+":"+v.i));for(const[level,row]of Object.entries(writing))row.versions=(row.versions||[]).filter((_,i)=>keep.has(level+":"+i));return writing;}
  return Object.freeze({provenance,normalize,line,shuffle,task,evaluate,completion,writingTemplates,sounds,conversations,writingFeedback,conversationFeedback,normalizeAcademy,importState,boundVersions});
});
