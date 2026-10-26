/* Original HH longform commissions, signal courses and learning situations. */
(function (scope, factory) {
  'use strict'; const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (scope) scope.HHAllGameCampaignPackCasual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const games = {};
  const CHAPTERS = [
    ['observe', 'Quan sát ở trạm nhỏ', 'Đọc tín hiệu, nhận diện thông tin cần thiết và thử công cụ.'],
    ['transform', 'Đổi cách nhìn', 'Thứ tự, vị trí và quy tắc thay đổi; đọc brief trước mỗi lượt.'],
    ['combine', 'Phối hợp kỹ năng', 'Kết hợp thông tin với giới hạn tài nguyên và đường đi.'],
    ['deliver', 'Ngày hội Bình Minh', 'Hoàn thành tác phẩm, phục vụ cộng đồng và lưu kết quả.']
  ].map(([id,title,summary]) => ({id,title,summary}));
  const SIGNALS = [[0,1,0,2],[2,0,3,1,2],[1,3,2,0,1,3],[0,2,1,2,3],[3,1,0,2,1,0],[1,0,2,3,0,2,1]];
  const PATTERNS = [[0,1,4,5],[0,3,5,10,12,15],[1,2,4,7,9,10],[0,2,5,7,8,10,13,15],[0,1,2,6,10,14],[3,6,9,12,13,14]];
  const ORDERS = [[0,2,4,6,7,5,3,1],[0,1,3,2,4,5,7,6],[0,4,1,5,2,6,3,7],[0,2,5,7,4,1,6,3],[1,3,0,6,2,5,7,4],[2,4,6,0,7,5,3,1]];
  const FIGURES = [
    [[245,330],[210,245],[265,160],[345,135],[425,170],[465,250],[420,340],[330,370]],
    [[210,320],[260,260],[210,170],[320,205],[365,120],[390,220],[500,180],[455,330]],
    [[205,240],[260,155],[325,210],[360,125],[400,210],[475,155],[515,240],[360,355]],
    [[215,320],[245,160],[315,250],[360,130],[405,250],[475,160],[500,320],[360,370]],
    [[230,260],[275,145],[360,175],[445,145],[490,260],[435,355],[360,325],[285,355]],
    [[205,350],[240,210],[310,135],[365,220],[415,140],[490,235],[470,350],[340,315]]
  ];
  const INGREDIENTS = ['Cà phê','Sữa','Trà','Nước','Đá','Siro'];
  const RECIPE_SETS = [
    [[0,1],[2,3,4],[0,5]], [[2,1,4],[0,1,4],[2,3,5]], [[3,2,1],[0,3,1],[2,5,1]], [[0,1,5],[2,3,1,4],[3,5,4]]
  ];
  const TITLES = {'simon-sequence':'Đài tín hiệu','reaction-stop':'Gác cầu','rhythm-tap':'Sân khấu sao','whack-orb':'Vườn quả cầu','aim-trainer':'Xưởng kính','math-sprint':'Toán trong thành phố','color-word':'Phòng mực','odd-one-out':'Kho phân loại','pattern-recall':'Bản đồ ánh sáng','treasure-grid':'Đảo kho báu','lock-timing':'Thợ mở cổng','stack-tower':'Kiến trúc sư','constellation-trace':'Nhật ký thiên văn','pixel-painter':'Xưởng tranh tự do','garden-care':'Vườn cộng đồng','cafe-orders':'Quán hẹn Bình Minh'};
  const MODELS = {'simon-sequence':'puzzle','reaction-stop':'action','rhythm-tap':'music','whack-orb':'action','aim-trainer':'action','math-sprint':'learning','color-word':'learning','odd-one-out':'puzzle','pattern-recall':'puzzle','treasure-grid':'puzzle','lock-timing':'action','stack-tower':'action','constellation-trace':'puzzle','pixel-painter':'creative','garden-care':'creative','cafe-orders':'creative'};
  function transforms(values, mode, n) {
    if (mode === 1) return values.slice().reverse();
    if (mode === 2) return values.map(value => (value + 1) % n);
    if (mode === 3) return values.filter((_, i) => i % 2 === 0).concat(values.filter((_, i) => i % 2));
    return values.slice();
  }
  function mathRound(chapter, variant, round) {
    const n = variant + 2, r = round + 1;
    const forms = [
      [n * 2 + r, n + r, n + ' giỏ, mỗi giỏ 2 quả; thêm ' + r + ' quả. Tổng số quả?', n * 2 + r, 'Nhân số giỏ với 2 trước, sau đó cộng quả thêm.'],
      [n * 3 + r, n * 2 + r, 'Có ' + (n * 3 + r) + ' vé, dành ' + n + ' vé cho đội. Còn bao nhiêu vé?', n * 2 + r, 'Lấy tổng vé trừ phần dành cho đội.'],
      [n * (r + 2), n * (r + 1), 'Xếp ' + (n * (r + 2)) + ' chai vào ' + n + ' hộp bằng nhau. Mỗi hộp bao nhiêu chai?', r + 2, 'Chia tổng số chai cho số hộp.'],
      [n + r, n * r, 'Tuyến xe đi ' + n + ' km, quay lại ' + r + ' km. Cách điểm đầu bao nhiêu km?', n - r, 'Đi và quay lại ngược chiều: lấy quãng đi trừ quãng quay.']
    ];
    const form = forms[chapter], answer = form[3];
    const options = [answer, answer + 1, answer - 2, answer + n + 2];
    const shift = (variant + round) % 4;
    return {prompt:form[2], answer, options:options.slice(shift).concat(options.slice(0,shift)), explanation:form[4]};
  }
  function setupFor(id, chapter, variant) {
    const mode = chapter, count = 3 + variant % 3;
    if (id === 'simon-sequence') return {rule:['Nhập đúng thứ tự','Nhập ngược thứ tự','Mỗi tín hiệu đổi sang ô kế tiếp (4 về 1)','Nhập vị trí lẻ trước, vị trí chẵn sau'][mode], rounds:Array.from({length:count},(_,r)=>({sequence:SIGNALS[(variant+r)%6].concat(r > 1 ? [r % 4] : []),mode})), roundGoal:count};
    if (id === 'reaction-stop') return {rule:['Chỉ chạm tín hiệu xanh','Chạm xanh, bỏ qua tín hiệu đỏ','Chọn nút bên có mũi tên','Chọn phía đối diện mũi tên, bỏ qua đỏ'][mode], roundGoal:4+variant%3, signals:Array.from({length:4+variant%3},(_,r)=>({wait:.8 + ((r*3+variant)%5)*.22, noGo:mode===1 && r%3===1 || mode===3 && r%4===1, side:(variant+r)%2, opposite:mode===3})),mode};
    if (id === 'rhythm-tap') { const motifs = [[1,1,.5,.5,1,1],[.5,.5,1,.5,.5,2],[1.5,.5,1,1,.5,.5],[.5,1.5,.5,.5,1,2]]; const intervals=motifs[mode].concat(motifs[(mode+variant%3+1)%4]).map((n,i)=>n*(i%5===variant%5? .6:.5)); return {rule:'Bản gốc '+['Bước chân','Mưa trên mái','Đèn lồng','Ngày hội'][mode]+': nhịp ngắn, dài và khoảng nghỉ có cue rõ.',intervals,beatGoal:intervals.length,hitGoal:Math.ceil(intervals.length*.8),roundGoal:1,accent:variant%4}; }
    if (id === 'whack-orb' || id === 'aim-trainer') { const size=id==='whack-orb'?9:20; const routes=[[0,1,2,5,8,7,6,3],[4,0,8,2,6,1,7,3],[0,4,8,1,5,6,2,3],[1,3,5,7,0,8,2,6]]; return {rule:['Bắt theo đường viền','Bỏ qua mồi nhử, bắt tâm có số','Theo cặp xa–gần','Bắt theo thứ tự ký hiệu'][mode],targets:routes[mode].concat(routes[(mode+1)%4].slice(0,variant+1)).map((n,r)=>(n+(id==='aim-trainer'?r%3*5:0))%size),decoys:mode?[(variant+2)%size,(variant+5)%size]:[],hitGoal:8+variant+1}; }
    if (id === 'math-sprint') return {rule:['Đếm nhóm và cộng phần dư','Phân chia tài nguyên','Chia đều và kiểm tra đơn vị','Lập quãng đường có hướng'][mode],questions:Array.from({length:4},(_,r)=>mathRound(chapter,variant,r)),roundGoal:4};
    if (id === 'color-word') return {rule:['Chọn màu mực','Chọn nghĩa của từ','Chọn màu kế tiếp trong chu kỳ ngọc→tím→hồng→vàng','Chọn mực ở câu lẻ, nghĩa ở câu chẵn'][mode],mode,roundGoal:6+Math.floor(variant/4),rounds:Array.from({length:6+Math.floor(variant/4)},(_,r)=>({ink:(variant+r*3)%4,word:(variant*2+r+1)%4}))};
    if (id === 'odd-one-out') { const sets=[['○','◇','vòng tròn','hình thoi'],['□','△','hình vuông','tam giác'],['+','×','dấu cộng','dấu nhân'],['≡','=','ba nét','hai nét']]; return {rule:['Tìm khác biệt hình học','Tìm khác biệt về số nét','Tìm hướng biểu tượng','Phân loại cặp hỗn hợp'][mode],roundGoal:4,rounds:Array.from({length:4},(_,r)=>({target:(variant*3+r*5)%16,pair:(chapter+r)%3,symbols:sets[(chapter+variant+r)%4]}))}; }
    if (id === 'pattern-recall') return {rule:['Nhớ cụm liền nhau','Nhớ đường chéo và khoảng trống','Phản chiếu qua trục dọc khi nhập','Nhớ hình, bổ sung ô giữa còn thiếu'][mode],roundGoal:3,rounds:Array.from({length:3},(_,r)=>({pattern:PATTERNS[(variant+r)%6],mirror:mode===2,extra:mode===3?[(variant+r+6)%16]:[]}))};
    if (id === 'treasure-grid') { const wallsByChapter=[[],[8,9,14,20],[7,13,19,22],[2,8,14,21,27]]; const routes=[[5,17,30],[6,23,32],[11,18,34],[4,16,31],[12,24,29],[10,25,33]]; const walls=wallsByChapter[mode].filter(i=>!routes[variant].includes(i)); return {rule:['Đọc tín hiệu ô kề','Đi vòng vách đá','Tìm đường theo ba kho','Lộ trình ngắn, một lá chắn'][mode],treasures:routes[variant],traps:[15+variant,26-variant].filter(i=>!walls.includes(i)&&!routes[variant].includes(i)),walls,maxMoves:60-mode*5-variant,lives:mode===3?1:3}; }
    if (id === 'lock-timing') return {rule:['Chạm trong cung','Đổi chiều sau mỗi cổng','Hai cung hợp lệ, tránh vùng đỏ','Cung xanh di chuyển có dự báo'][mode],roundGoal:4+variant%3,locks:Array.from({length:4+variant%3},(_,r)=>({target:(.14+((variant*3+r*5)%15)/20)%1,window:.18+(r%2)*.04,direction:mode===1&&r%2?-1:1,drift:mode===3?.05:0,second:mode===2})),mode};
    if (id === 'stack-tower') return {rule:['Giữ mặt đỡ rộng','Tầng hẹp xen kẽ','Móng lệch: căn tâm từng tầng','Nhịp giao ca: đổi chiều từng tầng'][mode],floorGoal:6+variant%3,foundation:{x:130+variant*16,width:330-variant*9},insets:mode===1?[0,20,0,24,0,16,0,14]:mode===2?[0,8,16,0,12,0,16,0]:[0,0,0,0,0,0,0,0],mode};
    if (id === 'constellation-trace') return {rule:['Nối đường bao','Nối hình có giao tuyến','Nối cầu qua các cụm','Hoàn thành bản đồ quan sát'][mode],roundGoal:2,rounds:[0,1].map(r=>({order:ORDERS[(variant+r+mode)%6],nodes:FIGURES[(variant+r)%6].map(([x,y])=>({x,y}))}))};
    if (id === 'pixel-painter') { const required=[[9+variant,1],[49-variant,2]]; return {rule:['Poster hai sắc, bố cục mở','Huy hiệu đối xứng trái–phải','Vườn ba sắc có điểm sáng','Tác phẩm tặng ngày hội: tự do phối màu'][mode],brief:['Một poster có ít nhất 8 ô ngọc và 6 ô hồng trên ít nhất 4 hàng.','Thiết kế huy hiệu đối xứng: ít nhất 12 ô màu, 4 hàng.','Một khu vườn 3 màu: ít nhất 5 ô mỗi màu, 5 hàng.','Tự vẽ quà tặng, có dải màu vàng và 2 điểm nhấn đã đánh dấu.'][mode],paintRubric:{minColors:mode===2?[0,5,5,5]:mode===3?[0,6,6,8]:[0,8,6,0],minRows:mode===2?5:4,symmetry:mode===1,required:mode===3?required:[]},required,mode,variant}; }
    if (id === 'garden-care') return {rule:['Cân bằng nước cho ba loài','Phục hồi cây bị úng','Chăm cây khô và chia bình','Ba vi khí hậu: đọc từng khoảng nước'][mode],plants:[0,1,2].map((i)=>({water:mode===1?.86-i*.06:mode===2?.18+i*.04:.4+i*.06,growth:0,health:.8+variant*.025,harvested:false,minWater:mode===3?[.3,.4,.2][i]:.25,maxWater:mode===3?[.65,.75,.55][i]:.8,evaporation:[.035,.028,.04][i]+variant*.001,growthRate:[.04,.033,.028][i]})),reservoir:mode===2?3:6,mode};
    if (id === 'cafe-orders') return {rule:['Phục vụ công thức rõ','Menu đồ mát: quản lý đá','Pha chế theo thứ tự mới','Quà ngày hội: menu kết hợp'][mode],orders:Array.from({length:4+variant%3},(_,r)=>({name:'Đơn '+(r+1)+' · '+['Quán nhỏ','Sân ga','Nhà vườn','Ngày hội'][mode],parts:RECIPE_SETS[mode][(variant+r)%3].concat(variant>2?[variant===3?5:3]:[])})),roundGoal:4+variant%3,forbidden:mode===2?[4]:[],mode};
    throw new Error('Unknown casual content '+id);
  }
  function applyRound(state, setup) {
    const n=(state.round || state.level || 1)-1;
    if(state.id==='simon-sequence'){state.sequence=copy(setup.rounds[n].sequence);state.expectedSequence=transforms(state.sequence,setup.rounds[n].mode,4);}
    if(state.id==='reaction-stop'){const signal=setup.signals[n];state.phase='wait';state.wait=signal.wait;state.responseTime=0;state.signal=copy(signal);}
    if(state.id==='rhythm-tap'){state.nextInterval=setup.intervals[state.beat-1] || .5;}
    if(state.id==='whack-orb'||state.id==='aim-trainer'){state.target=setup.targets[state.hits];state.targetTime=1.2;}
    if(state.id==='math-sprint')state.question=copy(setup.questions[n]);
    if(state.id==='color-word'){const r=setup.rounds[n];state.ink=r.ink;state.word=r.word;state.expectedColor=setup.mode===1?r.word:setup.mode===2?(r.ink+1)%4:setup.mode===3&&state.round%2===0?r.word:r.ink;}
    if(state.id==='odd-one-out'){const r=setup.rounds[n];state.target=r.target;state.pair=r.pair;state.symbols=r.symbols;}
    if(state.id==='pattern-recall'){const r=setup.rounds[n];state.pattern=copy(r.pattern);state.expectedPattern=r.mirror?state.pattern.map(i=>Math.floor(i/4)*4+3-i%4):state.pattern.concat(r.extra).filter((v,i,a)=>a.indexOf(v)===i);}
    if(state.id==='lock-timing'){const r=setup.locks[n];state.target=r.target;state.window=r.window;state.phase=0;state.lockDirection=r.direction;state.lockDrift=r.drift;state.secondArc=r.second;}
    if(state.id==='constellation-trace'){const r=setup.rounds[n];state.order=copy(r.order);state.nodes=copy(r.nodes);}
    if(state.id==='cafe-orders')state.recipe=copy(setup.orders[state.served]);
  }
  function prepare(state, setup) {
    ['roundGoal','beatGoal','hitGoal','floorGoal','paintRubric'].forEach(key=>{if(setup[key]!==undefined)state[key]=copy(setup[key]);});
    if(state.id==='rhythm-tap'){state.nextBeat=1;state.timeLeft=setup.intervals.reduce((a,b)=>a+b,0)+4;}
    if(state.id==='treasure-grid')Object.assign(state,{treasures:copy(setup.treasures),traps:copy(setup.traps),walls:copy(setup.walls),maxMoves:setup.maxMoves,lives:setup.lives});
    if(state.id==='stack-tower'){state.tower=[copy(setup.foundation)];state.moving={x:0,width:setup.foundation.width,direction:1};}
    if(state.id==='garden-care'){state.plants=copy(setup.plants);state.reservoir=setup.reservoir;}
    if(state.id==='pixel-painter'){state.target=Array(64).fill(0);state.message=setup.brief;}
    applyRound(state,setup);state.message=setup.rule;
    return state;
  }
  function createEngine(base, mission) {
    const setup=mission.setup,id=base.id;
    return {id,
      create(options){return prepare(base.create(options),setup);},
      step(previous,action,dt){
        const a=typeof action==='string'?{type:action}:action||{type:'tick'};
        if(previous.status!=='playing')return copy(previous);
        if(id==='reaction-stop'){
          const s=copy(previous),delta=Math.max(0,Math.min(.05,Number(dt)||0));
          if(a.type==='tick'){s.elapsed+=delta;s.timeLeft-=delta;if(s.phase==='wait'){s.wait-=delta;if(s.wait<=0){s.phase=s.signal.noGo?'red':'go';s.responseTime=0;}}else {s.responseTime+=delta;if(s.phase==='red'&&s.responseTime>=.65){s.results.push(null);s.score+=100;nextSignal(s);}else if(s.phase==='go'&&s.responseTime>1.2){s.status='lost';s.message='Đã bỏ lỡ tín hiệu xanh.';}}}
          else if(a.type==='action'||a.type==='cell'){
            const expected=s.signal.opposite?1-s.signal.side:s.signal.side;
            if(s.phase!=='go'||setup.mode>=2&&a.type==='cell'&&a.index!==expected){s.status='lost';s.message='Tín hiệu hoặc phía được chọn chưa đúng.';}
            else {s.results.push(s.responseTime);s.score+=Math.max(1,1200-Math.round(s.responseTime*1000));nextSignal(s);}
          }
          if(s.timeLeft<=0&&s.status==='playing')s.status='lost';return s;
        }
        if(id==='pattern-recall'&&previous.phase==='recall'&&(a.type==='action'||a.type==='cell'&&a.index===16)){
          const correct=previous.selected.length===previous.expectedPattern.length&&previous.expectedPattern.every(i=>previous.selected.includes(i));
          if(!correct){const s=copy(previous);s.status='lost';s.message='Mẫu nhập chưa đáp ứng phép biến đổi.';return s;}
          const transformed=copy(previous);transformed.pattern=copy(previous.expectedPattern);return advance(base.step(transformed,a,dt),previous);
        }
        if(id==='lock-timing'&&a.type==='tick'){
          const s=copy(previous),delta=Math.max(0,Math.min(.05,Number(dt)||0));s.elapsed+=delta;s.timeLeft-=delta;s.phase=(s.phase+delta*(.32+s.level*.06)*s.lockDirection+1)%1;s.target=(s.target+s.lockDrift*delta)%1;if(s.timeLeft<=0)s.status='lost';return s;
        }
        let before=previous;
        if(id==='lock-timing'&&previous.secondArc&&(a.type==='action'||a.type==='cell')){const diff=Math.abs(((previous.phase-previous.target+1.5)%1)-.5);if(diff>.25){before=copy(previous);before.target=(before.target+.5)%1;}}
        if(id==='treasure-grid'&&a.type==='cell'&&setup.walls.includes(a.index))return copy(previous);
        if(id==='cafe-orders'&&a.type==='cell'&&setup.forbidden.includes(a.index)){const s=copy(previous);s.message='Nguyên liệu này không có trong menu hôm nay.';return s;}
        const next=base.step(before,a,dt);return advance(next,previous);
      },
      describe(state){const info=base.describe(state);info.summary=mission.objective+' '+setup.rule+'. '+info.summary;
        if(id==='reaction-stop'){info.columns=2;info.cells=[0,1].map(index=>({index,text:state.phase==='red'?'ĐỎ · CHỜ':state.phase==='wait'?'CHỜ':(state.signal.side===index?'← TÍN HIỆU':'→'),label:'Nút '+(index+1)+', '+state.phase,description:'Nút '+(index+1)+', '+state.phase,disabled:state.status!=='playing',pressed:state.phase==='go'&&state.signal.side===index}));}
        if((id==='whack-orb'||id==='aim-trainer')&&setup.decoys.length)info.cells=info.cells.map(c=>setup.decoys.includes(c.index)&&c.index!==state.target?{...c,text:'◇',label:'Mồi nhử hình thoi, không chọn',description:'Mồi nhử hình thoi, không chọn',pressed:false}:c);
        if(id==='odd-one-out'&&state.symbols)info.cells=info.cells.map(c=>({...c,text:state.symbols[c.index===state.target?1:0],label:'Ô '+(c.index+1)+': '+state.symbols[c.index===state.target?3:2]}));
        if(id==='garden-care')info.summary+=' Khoảng nước từng loài: '+state.plants.map(p=>Math.round(p.minWater*100)+'–'+Math.round(p.maxWater*100)+'%').join('; ')+'.';
        if(id==='pixel-painter')info.summary=setup.brief+' Chấm theo số màu, số hàng và đối xứng ghi trong brief. Có nhiều tranh hợp lệ; dùng mực 0 để xóa.';
        return info;
      },
      draw(ctx,state,options){base.draw(ctx,state,options);ctx.save();ctx.scale((options&&options.width||720)/720,(options&&options.height||480)/480);ctx.fillStyle='#10213aed';ctx.fillRect(24,68,672,27);ctx.fillStyle='#edf5ff';ctx.font='600 13px system-ui';ctx.textAlign='center';ctx.fillText(setup.rule,360,86,650);ctx.restore();}
    };
    function nextSignal(s){if(s.round>=s.roundGoal){s.status='won';s.message='Đã xử lý đủ tín hiệu: chạm xanh và giữ tay khi đỏ.';}else{s.round++;s.level=s.round;applyRound(s,setup);}}
    function advance(next,previous){
      if(next.status==='playing'&&((next.round||next.level)!==(previous.round||previous.level)||next.served!==previous.served||next.hits!==previous.hits||next.beat!==previous.beat))applyRound(next,setup);
      if(id==='stack-tower'&&next.tower.length!==previous.tower.length&&next.status==='playing'){const inset=setup.insets[next.tower.length-1]||0;next.moving.width=Math.max(26,next.moving.width-inset);}
      if(id==='math-sprint'&&next.round!==previous.round)next.message=previous.question.explanation;
      return next;
    }
  }
  Object.keys(TITLES).forEach(id=>{
    const model=MODELS[id],perChapter=['creative','music'].includes(model)?5:model==='action'?5:6;
    const missions=[];
    CHAPTERS.forEach((chapter,c)=>{for(let v=0;v<perChapter;v++){
      const setup=setupFor(id,c,v),n=missions.length+1;
      missions.push({id:id+'-c'+(c+1)+'-m'+(v+1),contentVersion:1,title:TITLES[id]+' · '+(c+1)+'.'+(v+1),chapter:chapter.id,objective:setup.brief||'Hoàn thành '+setup.rule.toLowerCase()+' theo luật công khai.',mechanicIntroduced:setup.rule,setup,availableTools:['Mũi tên','Chọn ô','Hành động','Khởi động lại'],resources:{mistakeBudget:id==='treasure-grid'?setup.lives:3},hazards:[id==='garden-care'?'Khô hoặc úng kéo dài':'Nhập sai quy tắc hoặc bỏ lỡ cue'],prerequisites:n>1?[missions[n-2].id]:[],hintSteps:['Đọc brief và cue được hiển thị.','Thử từng bước theo quy tắc; ưu tiên độ chính xác.','Dùng thông tin đang thấy để kiểm tra trước khi xác nhận.'],winConditions:['Đạt mục tiêu qua thao tác hợp lệ của game.'],loseConditions:['Vi phạm giới hạn lỗi hoặc tài nguyên của nhiệm vụ.'],rewards:{medal:TITLES[id]+' '+n},story:{before:'Cộng đồng Bình Minh cần kỹ năng của bạn tại '+chapter.title.toLowerCase()+'.',after:'Kết quả đã giúp chuẩn bị một phần ngày hội.'}});
    }});
    games[id]={id,contentVersion:1,model,chapters:copy(CHAPTERS),missions,createEngine,renderer:id==='garden-care'?'2.5D':'2D',estimatedMinutes:{min:45,max:90,method:'Ước tính nội bộ; chưa có lượt chơi thử độc lập.'}};
  });
  return {VERSION:1,games};
});
