/* MATHCORE AI: bounded arithmetic, guided algebra and account-scoped learning state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HHMathCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1, MAX_INPUT=500;
  const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>!Number.isFinite(n)?'không xác định':Math.abs(n)<1e-12?'0':Number(n.toPrecision(11)).toString();
  const fail=message=>{throw new Error(message);};
  const normalize=value=>String(value??'').trim().replace(/[−–]/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/π/g,'pi').replace(/²/g,'^2').replace(/³/g,'^3').replace(/√\(/g,'sqrt(');
  const FUNCTIONS=new Set(['sin','cos','tan','sqrt','abs','ln','log','exp']);
  function parse(value){
    const text=normalize(value);if(!text||text.length>MAX_INPUT)fail('Biểu thức cần từ 1 đến 500 ký tự.');
    const tokens=[];let offset=0;
    while(offset<text.length){const part=text.slice(offset);if(/^\s/.test(part)){offset++;continue;}const m=part.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^[a-z]+|^[+\-*/^()]/i);if(!m)fail('Ký hiệu chưa hỗ trợ. Dùng dấu chấm cho số thập phân, * để nhân và ^ để lũy thừa.');tokens.push(m[0].toLowerCase());offset+=m[0].length;if(tokens.length>180)fail('Biểu thức quá dài.');}
    // Explicit implicit multiplication: 2x, 2(x+1), (x+1)(x-1), 2pi.
    const expanded=[];const atomEnd=t=>/^(?:\d|\.)/.test(t)||['x','pi','e',')'].includes(t);const atomStart=t=>/^(?:\d|\.)/.test(t)||['x','pi','e','('].includes(t)||FUNCTIONS.has(t);
    for(const t of tokens){const prev=expanded.at(-1);if(prev&&atomEnd(prev)&&atomStart(t))expanded.push('*');expanded.push(t);}
    let i=0,depth=0,nodes=0;
    const node=(op,...args)=>{if(++nodes>240)fail('Biểu thức quá phức tạp.');return {op,args};};
    function expression(min=0){if(++depth>28)fail('Có quá nhiều ngoặc lồng nhau.');let t=expanded[i++],left;
      if(t==='+'||t==='-')left=node(t==='-'?'neg':'pos',expression(25));
      else if(t==='('){left=expression();if(expanded[i++]!==')')fail('Thiếu dấu đóng ngoặc.');}
      else if(FUNCTIONS.has(t)){if(expanded[i++]!=='(')fail('Hàm cần ngoặc, ví dụ sin(x).');left=node(t,expression());if(expanded[i++]!==')')fail('Thiếu dấu đóng ngoặc của hàm.');}
      else if(['x','pi','e'].includes(t))left=node(t);
      else if(t&&Number.isFinite(Number(t)))left=node('number',Number(t));
      else fail('Thiếu số, biến x hoặc hàm hợp lệ.');
      while(i<expanded.length){const op=expanded[i],priority={'+':10,'-':10,'*':20,'/':20,'^':30}[op];if(priority===undefined||priority<min)break;i++;left=node(op,left,expression(op==='^'?priority:priority+1));}
      depth--;return left;
    }
    const ast=expression();if(i!==expanded.length)fail('Biểu thức chưa đúng cú pháp.');return ast;
  }
  function evaluate(ast,x=0,unit='rad'){
    function run(n){const a=n.args;if(n.op==='number')return a[0];if(n.op==='x')return Number(x);if(n.op==='pi')return Math.PI;if(n.op==='e')return Math.E;const u=run(a[0]),v=a[1]?run(a[1]):0;
      switch(n.op){case 'neg':return -u;case 'pos':return u;case '+':return u+v;case '-':return u-v;case '*':return u*v;case '/':return v===0?NaN:u/v;case '^':return Math.abs(v)>1000||u===0&&v===0?NaN:Math.pow(u,v);case 'sin':return Math.sin(unit==='deg'?u*Math.PI/180:u);case 'cos':return Math.cos(unit==='deg'?u*Math.PI/180:u);case 'tan':{const angle=unit==='deg'?u*Math.PI/180:u;return Math.abs(Math.cos(angle))<1e-12?NaN:Math.tan(angle);}case 'sqrt':return Math.sqrt(u);case 'abs':return Math.abs(u);case 'ln':return Math.log(u);case 'log':return Math.log10(u);case 'exp':return Math.exp(u);default:return NaN;}}
    const n=run(ast);return Number.isFinite(n)&&Math.abs(n)<1e100?n:NaN;
  }
  const calculator=(text,unit)=>{const ast=parse(text);if(hasVariable(ast))fail('Máy tính số không nhận biến x. Dùng khu Đồ thị để tính theo x.');const n=evaluate(ast,0,unit);if(!Number.isFinite(n))fail('Biểu thức nằm ngoài miền xác định hoặc vượt giới hạn tính toán.');return n;};
  function derivativeAt(ast,x){const dx=1e-5*Math.max(1,Math.abs(x)),center=evaluate(ast,x),left=(center-evaluate(ast,x-dx))/dx,right=(evaluate(ast,x+dx)-center)/dx;if(![center,left,right].every(Number.isFinite)||Math.abs(left-right)>.02*Math.max(1,Math.abs(left),Math.abs(right)))return NaN;return (left+right)/2;}
  const hasVariable=ast=>ast.op==='x'||ast.args.some(a=>a&&typeof a==='object'&&hasVariable(a));
  const cleanPoly=p=>{if(p.some(n=>n!==0&&Math.abs(n)<1e-12))fail('Hệ số quá nhỏ để đối chiếu tin cậy bằng bộ giải cục bộ. Hãy đổi đơn vị hoặc dùng cách giải ký hiệu.');if(!p.every(Number.isFinite)||p.some(n=>Math.abs(n)>1e9))fail('Hệ số vượt giới hạn tính toán.');return p.map(n=>Math.abs(n)<1e-12?0:n);};
  function polynomial(ast){const a=ast.args;if(ast.op==='number')return cleanPoly([a[0],0,0]);if(ast.op==='x')return [0,1,0];if(ast.op==='pi'||ast.op==='e')return [evaluate(ast),0,0];
    if(ast.op==='neg'||ast.op==='pos')return polynomial(a[0]).map(n=>ast.op==='neg'?-n:n);
    if(!['+','-','*','/','^'].includes(ast.op))fail('Bộ giải cục bộ nhận phương trình đa thức bậc 1 hoặc 2 theo x.');
    const l=polynomial(a[0]),r=polynomial(a[1]);
    if(ast.op==='+'||ast.op==='-')return cleanPoly(l.map((n,i)=>n+(ast.op==='+'?1:-1)*r[i]));
    if(ast.op==='/'){if(r[1]||r[2]||r[0]===0)fail('Mẫu chứa x cần xét điều kiện riêng; hãy dùng trợ giảng AI.');return cleanPoly(l.map(n=>n/r[0]));}
    const mul=(p,q)=>{const v=Array(5).fill(0);p.forEach((n,i)=>q.forEach((m,j)=>v[i+j]+=n*m));if(Math.abs(v[3])>1e-12||Math.abs(v[4])>1e-12)fail('Bộ giải cục bộ hỗ trợ đến bậc 2.');return cleanPoly(v.slice(0,3));};
    if(ast.op==='*')return mul(l,r);if(r[0]===0&&(hasVariable(a[0])||l[0]===0))fail('Lũy thừa 0 cần cơ số khác 0; dạng chứa ẩn cần xét điều kiện riêng.');if(r[1]||r[2]||![0,1,2].includes(r[0]))fail('Số mũ của đa thức cần là 0, 1 hoặc 2.');return r[0]===0?[1,0,0]:r[0]===1?l:mul(l,l);
  }
  const relation=n=>Number(fmt(n))===n?' = ':' ≈ ';
  const polyText=([c,b,a])=>[[a,'x²'],[b,'x'],[c,'']].filter(([n])=>n!==0).map(([n,v],i)=>(i?(n<0?' − ':' + '):(n<0?'−':''))+(Math.abs(n)===1&&v?'':fmt(Math.abs(n)))+v).join('')||'0';
  function solveEquation(value){const text=normalize(value),sides=text.split('=');if(sides.length!==2)fail('Nhập một phương trình, ví dụ 2x + 3 = 11.');const left=polynomial(parse(sides[0])),right=polynomial(parse(sides[1])),p=cleanPoly(left.map((n,i)=>n-right[i])),[c,b,a]=p;
    const base={provider:'local',title:'Cùng giải phương trình',problem:text,topic:a?'quadratic':'linear',conditions:['Xét nghiệm thực. Hệ số được tính bằng số dấu phẩy động; hãy kiểm tra lại bằng phép thế.'],steps:[],hints:[],answer:'',alternative:''};
    base.steps.push({title:'Đưa về một vế',text:'Trừ cả hai vế cho vế phải, rồi thu gọn các hạng tử cùng bậc.',formula:polyText(p)+' = 0'});
    base.hints.push('Em hãy đưa các hạng tử về cùng một vế. Khi chuyển vế, dấu của chúng thay đổi thế nào?');
    if(!a){if(!b){base.answer=c===0?'Mọi số thực x đều là nghiệm.':'Phương trình vô nghiệm.';base.hints.push('Sau khi thu gọn còn biến x không? Đẳng thức số còn lại đúng hay sai?');base.steps.push({title:'Xét đẳng thức còn lại',text:c===0?'Hai vế bằng nhau với mọi x.':'Đẳng thức không đúng với bất kỳ x nào.',formula:fmt(c)+' = 0'});}
      else{const x=-c/b;base.hints.push('Muốn tách x, em cần cộng hoặc trừ số nào ở cả hai vế, rồi chia cho hệ số nào?','Thế giá trị em tìm được vào phương trình gốc. Hai vế có bằng nhau không?');base.steps.push({title:'Tách ẩn x',text:'Trừ hằng số ở cả hai vế, sau đó chia cả hai vế cho hệ số khác 0 của x.',formula:fmt(b)+'x = '+fmt(-c)+' ⇒ x'+relation(x)+fmt(x)},{title:'Kiểm tra bằng phép thế',text:'Tính lại từng vế của phương trình gốc ở giá trị x vừa tìm.',formula:fmt(evaluate(parse(sides[0]),x))+' = '+fmt(evaluate(parse(sides[1]),x))});base.answer='x'+relation(x)+fmt(x);base.alternative='Có thể dùng các phép biến đổi tương đương trực tiếp trên hai vế; hoặc xem giao điểm của y = '+polyText(p)+' với trục hoành trong Đồ thị.';}}
    else{const delta=b*b-4*a*c;base.hints.push('Xác định a, b, c của ax² + bx + c = 0. Hãy tính Δ = b² − 4ac.','Dấu của Δ cho biết phương trình có bao nhiêu nghiệm thực? Nếu Δ ≥ 0, áp dụng công thức nghiệm rồi kiểm tra.');base.steps.push({title:'Tính biệt thức',text:'Ở dạng chuẩn, a = '+fmt(a)+', b = '+fmt(b)+', c = '+fmt(c)+'.',formula:'Δ = ('+fmt(b)+')² − 4 × '+fmt(a)+' × '+fmt(c)+' = '+fmt(delta)});
      if(delta<0){base.answer='Phương trình không có nghiệm thực.';base.steps.push({title:'Xét dấu Δ',text:'Δ < 0 nên không tồn tại căn bậc hai thực của Δ.',formula:'S = ∅ trong ℝ'});}
      else{const sqrt=Math.sqrt(delta),q=-.5*(b+(b>=0?sqrt:-sqrt)),roots=delta===0?[-b/(2*a)]:q===0?[0,-b/a]:[q/a,c/q];roots.sort((x,y)=>x-y);base.answer=delta===0?'Nghiệm kép x'+relation(roots[0])+fmt(roots[0]):'x₁'+relation(roots[0])+fmt(roots[0])+'; x₂'+relation(roots[1])+fmt(roots[1]);base.steps.push({title:'Áp dụng công thức nghiệm',text:delta===0?'Δ = 0: có một nghiệm kép.':'Δ > 0: có hai nghiệm phân biệt.',formula:'x = (−b ± √Δ)/(2a)'},{title:'Thử lại nghiệm',text:roots.map(x=>'Với x = '+fmt(x)+', vế trái sau khi thu gọn ≈ '+fmt(evaluate(parse(sides[0]),x)-evaluate(parse(sides[1]),x))+'.').join(' '),formula:base.answer});}base.alternative='Nếu tìm được hai số có tổng −b/a và tích c/a, có thể phân tích đa thức thành nhân tử. Máy tính Equation giúp đối chiếu nghiệm, còn lời giải cần nêu điều kiện và các phép biến đổi.';}
    return base;
  }
  function checkLines(problem,attempt){const original=solveEquation(problem),rows=String(attempt||'').split(/\r?\n/).map(t=>t.trim()).filter(Boolean).slice(0,30),parts=normalize(problem).split('='),p=polynomial(parse(parts[0])).map((v,i)=>v-polynomial(parse(parts[1]))[i]);
    return rows.map((text,index)=>{try{let eq=normalize(text).replace(/^(?:[⇒⇔]|=>|<=>)\s*/,'');const sides=eq.split('=');if(sides.length!==2)throw Error();const q=polynomial(parse(sides[0])).map((v,i)=>v-polynomial(parse(sides[1]))[i]);const pivot=p.findIndex(v=>Math.abs(v)>1e-10);if(pivot<0)return {line:index+1,text,status:q.every(v=>v===0)?'equivalent':'review',note:'Kiểm tra đẳng thức sau khi thu gọn.'};const scale=q[pivot]/p[pivot],same=Math.abs(scale)>1e-12&&q.every((v,i)=>Math.abs(v-p[i]*scale)<=1e-8*Math.max(1,Math.abs(v),Math.abs(p[i]*scale)));return {line:index+1,text,status:same?'equivalent':'review',note:same?'Phương trình này có vế trái thu gọn là một bội khác 0 của phương trình gốc.':'Phương trình này không còn cùng dạng tương đương đã kiểm tra. Xem lại chuyển vế, dấu hoặc hệ số.'};}catch{return {line:index+1,text,status:'unread',note:'Chưa kiểm tra được dòng này. Mỗi dòng cần là một phương trình đa thức, ví dụ 2x = 8.'};}}).map(row=>({...row,scope:'Đối chiếu các phương trình đa thức tỉ lệ; không kiểm chứng mọi cách lập luận.'}));
  }
  const random=seed=>{let n=Number(seed)>>>0;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};};
  const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
  function practice(topic='linear',difficulty='basic',count=5,seed=Date.now()){
    const r=random(seed),int=(a,b)=>Math.floor(r()*(b-a+1))+a,limit=difficulty==='advanced'?20:difficulty==='standard'?12:6,result=[];
    for(let i=0;i<Math.max(1,Math.min(20,Number(count)||5));i++){
      let text,answer,explanation,unit='',wrong=[];const a=int(2,limit),b=int(1,limit),c=int(1,limit);
      switch(topic){
        case 'fractions':{const d=int(2,limit),n=a*d+c*b,k=gcd(n,b*d);text=fmt(a)+'/'+fmt(b)+' + '+fmt(c)+'/'+fmt(d)+' bằng bao nhiêu?';answer=fmt(n/k)+'/'+fmt(b*d/k);explanation='Quy đồng: ('+a+' × '+d+' + '+c+' × '+b+')/('+b+' × '+d+'), rồi rút gọn.';wrong=[fmt(a+c)+'/'+fmt(b+d),fmt(n+1)+'/'+fmt(b*d),fmt(n)+'/'+fmt(b*d+1)];break;}
        case 'quadratic':{const p=a,q=b+limit+1;text='Tổng hai nghiệm của x² − '+(p+q)+'x + '+(p*q)+' = 0 là?';answer=p+q;explanation='Theo Viète, tổng hai nghiệm là −b/a = '+(p+q)+'.';wrong=[p*q,p+q+2,-p-q];break;}
        case 'derivative':text='Đạo hàm của f(x) = '+a+'x³ + '+b+'x tại x = '+c+' là?';answer=3*a*c*c+b;explanation="f′(x) = "+(3*a)+'x² + '+b+". Thế x = "+c+'.';break;
        case 'integral':text='Tính ∫₀¹ ('+(2*a)+'x + '+b+') dx.';answer=a+b;explanation='Nguyên hàm là '+a+'x² + '+b+'x. Lấy giá trị tại 1 trừ tại 0.';break;
        case 'probability':{const total=a+b,n=gcd(a,total);text='Hộp có '+a+' bi xanh và '+b+' bi đỏ. Chọn ngẫu nhiên một bi. Xác suất chọn bi xanh?';answer=(a/n)+'/'+(total/n);explanation='Các viên bi có khả năng được chọn như nhau: P = số bi xanh / tổng số bi.';wrong=[(a+1)+'/'+(total+1),(a+total)+'/'+total,'0'];break;}
        case 'statistics':text='Trung bình cộng của '+a+', '+(a+b)+', '+(a+2*b)+' là?';answer=a+b;explanation='Cộng ba giá trị rồi chia cho 3; các số cách đều nên trung bình là số giữa.';break;
        case 'geometry':text='Hình hộp chữ nhật có ba kích thước '+a+', '+b+', '+c+'. Thể tích bằng bao nhiêu?';answer=a*b*c;explanation='V = dài × rộng × cao = '+a+' × '+b+' × '+c+'.';unit='đơn vị³';break;
        case 'powers':text='Giá trị của '+a+'² − '+b+'² là?';answer=a*a-b*b;explanation='Áp dụng a² − b² = (a − b)(a + b).';break;
        case 'trigonometry':text='Tam giác vuông có hai cạnh góc vuông '+(3*a)+' và '+(4*a)+'. Độ dài cạnh huyền là?';answer=5*a;explanation='Theo Pythagore: c = √(a² + b²). Bộ 3–4–5 nhân với '+a+'.';break;
        default:text='Giải phương trình '+a+'x + '+b+' = '+(a*c+b)+'. Giá trị của x là?';answer=c;explanation='Trừ '+b+' ở cả hai vế rồi chia cho '+a+'.';
      }
      const correct=String(answer);if(!wrong.length){const n=Number(answer);wrong=[n+1,n+a,n===0?-1:-n].map(String);}
      const unique=[correct,...wrong.map(String)].filter((v,j,arr)=>arr.indexOf(v)===j);while(unique.length<4)unique.push(String(int(30,900)));
      const options=unique.slice(0,4).map((value,j)=>({value,key:r(),j})).sort((x,y)=>x.key-y.key).map(x=>x.value);
      result.push({id:'mc-'+(Number(seed)>>>0)+'-'+i,topic,difficulty,text,options,correct:options.indexOf(correct),explanation,unit});
    }return result;
  }
  function dimensions(input={}){const value=(name,fallback)=>{const n=Number(input[name]??fallback);return Number.isFinite(n)?Math.max(.5,Math.min(10,n)):fallback;};return {w:value('w',4),d:value('d',3),h:value('h',5),r:value('r',2)};}
  function solidMeasure(shape,input){const {w,d,h,r}=dimensions(input);if(shape==='pyramid')return {volume:w*d*h/3,formula:'V = Sđáy × h / 3',area:null};if(shape==='cylinder')return {volume:Math.PI*r*r*h,area:2*Math.PI*r*(r+h),formula:'V = πr²h'};if(shape==='cone')return {volume:Math.PI*r*r*h/3,area:Math.PI*r*(r+Math.hypot(r,h)),formula:'V = πr²h / 3'};if(shape==='sphere')return {volume:4*Math.PI*r*r*r/3,area:4*Math.PI*r*r,formula:'V = 4πr³ / 3'};return {volume:w*d*h,area:2*(w*d+w*h+d*h),formula:'V = dài × rộng × cao'};}
  const preferenceKey=user=>'hh.mathcore.v1:'+encodeURIComponent(String(user?.id||user?._id||'guest'));
  const defaults=()=>({version:VERSION,topic:'linear',saved:[],attempts:[],notes:'',draft:{problem:'',attempt:''},casioModel:'fx-580VN X'});
  function preferences(raw){if(raw===null||raw===undefined)return defaults();if(typeof raw!=='object'||Array.isArray(raw)||raw.version!==VERSION||!Array.isArray(raw.saved)||!Array.isArray(raw.attempts)||typeof raw.notes!=='string')fail('Dữ liệu MATHCORE trên thiết bị chưa đọc được. Hãy tải bản sao trước khi đặt lại.');return {...defaults(),topic:typeof raw.topic==='string'?raw.topic.slice(0,50):'linear',casioModel:['fx-580VN X','fx-880BTG'].includes(raw.casioModel)?raw.casioModel:'fx-580VN X',saved:raw.saved.filter(x=>x&&typeof x==='object'&&typeof x.problem==='string'&&typeof x.answer==='string').slice(0,100).map(x=>({problem:x.problem.slice(0,500),answer:x.answer.slice(0,3000),at:String(x.at||'').slice(0,40),provider:x.provider==='openai'?'openai':'local'})),attempts:raw.attempts.filter(x=>x&&typeof x==='object'&&typeof x.id==='string').slice(-500).map(x=>({id:x.id.slice(0,100),topic:String(x.topic||'').slice(0,40),correct:x.correct===true,at:String(x.at||'').slice(0,40)})),notes:raw.notes.slice(0,30000),draft:{problem:typeof raw.draft?.problem==='string'?raw.draft.problem.slice(0,5000):'',attempt:typeof raw.draft?.attempt==='string'?raw.draft.attempt.slice(0,8000):''}};}
  function imageBox(value){if(value===null||value===undefined)return null;const {x,y,w,h}=value;if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>1.001||y+h>1.001)fail('Vị trí đánh dấu ảnh không hợp lệ.');return {x,y,w,h};}
  return Object.freeze({VERSION,fold,escape,fmt,normalize,parse,evaluate,calculator,derivativeAt,polynomial,polyText,solveEquation,checkLines,practice,dimensions,solidMeasure,preferenceKey,defaults,preferences,imageBox});
});
