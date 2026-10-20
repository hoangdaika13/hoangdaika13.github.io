(function(scope){'use strict';
  // Original vector scenery shared by thumbnails, accessible boards and Canvas.
  // No image requests, hidden renderer, animation loop or change to game physics.
  const themes={
    space:['#0b1238','#423ab6','#45dcff','#ffd166'],forest:['#092c36','#148574','#78f3ae','#ffca7a'],
    alpine:['#182d64','#7a65d0','#b8eaff','#ff9bc8'],city:['#141335','#6140b9','#76e6ff','#ff78b2'],
    river:['#102950','#237eaf','#8df6e0','#ffcf78'],stadium:['#0a2b46','#147c80','#8af1bc','#ffe18a'],
    workshop:['#1a1244','#7344b2','#bb9bff','#ffc472'],temple:['#241946','#7b4bb0','#e7bdff','#ffcf7e'],
    garden:['#103937','#288975','#b9f59a','#ffadcb'],cafe:['#39213c','#a75f75','#ffd1a2','#fff0bb'],
    sea:['#082b4d','#248da8','#90f4ef','#ffb5aa'],solar:['#34204e','#b75a8d','#ffb797','#ffe48a']
  };
  const families={
    space:['star-guard','meteor-dodge','asteroid-drift','orbit-collect','shield-defense','constellation-trace','memory'],
    forest:['snake','peg-solitaire','treasure-grid','whack-orb'],alpine:['sky-glider','jump-tower','orbit-runner'],
    city:['road-rush','gravity-flip','laser-dash','reaction-stop','rhythm-tap'],river:['river-cross','coin-catcher','maze-path'],
    stadium:['paddle-duel','penalty-kick','mini-golf','basket-shot','aim-trainer','target-range'],
    workshop:['breakout','merge','block-drop','lights-out','slide-tiles','color-flood','pipe-link','code-breaker','pixel-painter'],
    temple:['crate-lab','n-queens','towers-hanoi','connect-four','tic-tac-toe','reversi-mini','knights-tour','lock-timing','stack-tower'],
    garden:['garden-care','odd-one-out','pattern-recall'],cafe:['cafe-orders','math-sprint','word-search','number-order'],
    sea:['ball-balance','sudoku-mini','nonogram'],solar:['mines','simon-sequence','color-word']
  };
  const profiles=Object.freeze(Object.fromEntries(Object.entries(families).flatMap(([theme,ids])=>ids.map((id,index)=>[id,Object.freeze({id,theme,variant:index,palette:Object.freeze([...themes[theme]])})]))));
  const cache=new Map();
  function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
  function scene(id){
    if(cache.has(id))return cache.get(id);const profile=profiles[id]||profiles['star-guard'],[dark,mid,light,warm]=profile.palette;
    let seed=hash(id);const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296),shapes=[];
    const add=(type,values,fill,stroke,width=1)=>shapes.push({type,values,fill,stroke,width});
    const rect=(x,y,w,h,fill,stroke,width)=>add('rect',[x,y,w,h],fill,stroke,width),circle=(x,y,r,fill,stroke,width)=>add('circle',[x,y,r],fill,stroke,width),ellipse=(x,y,rx,ry,fill,stroke,width)=>add('ellipse',[x,y,rx,ry],fill,stroke,width),poly=(points,fill,stroke,width)=>add('polygon',points,fill,stroke,width),line=(x,y,x2,y2,stroke,width=1)=>add('line',[x,y,x2,y2],null,stroke,width);
    const sunX=540+random()*80;rect(0,0,720,480,'sky');circle(sunX,75,37,warm+'20');circle(sunX,75,22,warm+'b0');
    const theme=profile.theme;
    if(['space','city','temple','workshop'].includes(theme))for(let i=0;i<24;i++)circle(random()*720,random()*290,.6+random()*1.5,light+(i%3?'70':'d0'));
    if(['forest','alpine','river','garden','sea','solar'].includes(theme)){
      for(let i=0;i<5;i++){const x=i*170+random()*55,y=60+random()*95;ellipse(x,y,65,12,light+'14');ellipse(x+24,y-8,28,15,light+'13');}
      poly([0,250,95,135,180,220,290,108,398,225,480,160,590,235,665,130,720,215,720,480,0,480],mid+'aa');
      poly([0,300,110,235,220,290,338,215,460,300,560,235,720,294,720,480,0,480],dark+'8c');
    }
    if(theme==='space'){
      ellipse(390,245,290,145,mid+'50');ellipse(465,195,240,80,light+'08',light+'17',2);circle(125,140,68,'planet',light+'22',2);ellipse(125,143,98,16,null,light+'69',5);circle(590,328,26,mid,light+'80',2);
      for(let i=0;i<12;i++)line(45+i*56,420,100+i*42,312,light+'0b');
    }else if(theme==='city'){
      for(let i=0;i<13;i++){const x=i*60-15,h=65+random()*130;rect(x,280-h,47,h,dark+'cf',mid,1);for(let j=0;j<3;j++)for(let k=0;k<4;k++)rect(x+8+j*11,290-h+k*27,4,10,(k+j)%3?light+'45':warm+'95');}
      poly([0,480,260,276,460,276,720,480],'ground');for(let i=0;i<7;i++)line(20+i*110,480,280+i*26,276,light+'20');line(275,284,23,480,light+'88',2);line(445,284,697,480,warm+'88',2);
    }else if(theme==='forest'||theme==='garden'){
      rect(0,302,720,178,'ground');for(let i=0;i<9;i++){const x=i*95-25,y=225+random()*55;rect(x+18,y,11,105,dark);circle(x+25,y-13,42,mid+'d8');circle(x+5,y+2,31,dark+'8f');circle(x+38,y-24,25,light+'30');}
      poly([245,480,330,315,390,315,510,480],warm+'18');for(let i=0;i<16;i++){const x=random()*720,y=330+random()*150;ellipse(x,y,12,3,dark+'65');line(x,y,x+3,y-12,light+'50');circle(x+3,y-13,2.5,i%2?warm:light);}
    }else if(theme==='river'||theme==='sea'){
      rect(0,305,720,175,'water');for(let i=0;i<20;i++){const x=random()*720,y=310+random()*150;line(x,y,x+12+random()*55,y,light+(i%2?'35':'15'),2);}
      poly([0,300,160,277,280,315,100,350,0,350],dark);poly([720,297,625,270,525,312,630,350,720,350],dark);ellipse(542,370,65,5,warm+'1c');
      if(theme==='sea'){poly([0,480,0,410,155,400,340,450,510,480],warm+'65');for(let i=0;i<9;i++)ellipse(i*80,425+i%3*7,25,3,light+'34');}
    }else if(theme==='alpine'){
      poly([0,350,100,195,215,315,330,165,455,320,590,185,720,350,720,480,0,480],'ground');poly([73,235,100,195,132,241,105,225],light+'d0');poly([292,222,330,165,375,230,337,209],light+'dd');poly([550,238,590,185,629,240,595,223],light+'d0');
      for(let i=0;i<10;i++){const x=i*85-30,y=315+i%3*20;poly([x,y-55,x-20,y+12,x+22,y+12],dark+'b0');rect(x-2,y+10,4,25,dark);}
    }else if(theme==='stadium'){
      ellipse(360,295,520,200,mid+'85');for(let j=0;j<3;j++)for(let i=0;i<15;i++)circle(i*53+5,220+j*15,2.2,(i+j)%2?light+'65':warm+'70');
      rect(0,320,720,160,'ground');for(let i=0;i<8;i++)rect(i*100,320,50,160,light+'07');line(0,385,720,385,light+'50',2);ellipse(360,385,78,30,null,light+'45',2);
      [65,655].forEach(x=>{line(x,135,x,305,light+'65',4);for(let i=0;i<4;i++)circle(x-20+i*13,132,5,warm+'d0');});
    }else if(theme==='workshop'||theme==='temple'){
      rect(0,285,720,195,'ground');for(let i=0;i<9;i++)line(i*110-80,480,260+i*25,285,light+'13');for(let y=310;y<480;y+=38)line(0,y,720,y,light+'12');
      [25,635].forEach(x=>{rect(x,110,60,225,dark+'ab',light+'26',2);rect(x-7,105,74,14,mid,light+'55');rect(x-8,326,76,15,mid,light+'45');for(let k=0;k<3;k++)line(x+16+k*14,130,x+16+k*14,305,light+'15',2);});
      ellipse(360,225,163,110,null,light+'27',2);ellipse(360,225,135,89,null,warm+'28');circle(360,225,37,'planet');
    }else if(theme==='cafe'){
      rect(75,53,275,230,dark+'d0',warm+'65',7);rect(86,65,253,205,'water');line(211,63,211,271,warm+'70',6);line(83,160,340,160,warm+'70',6);rect(414,80,226,125,dark+'bd',warm+'38',3);
      for(let i=0;i<3;i++)line(440,108+i*27,610-i*25,108+i*27,light+'50',3);rect(0,320,720,160,'ground');rect(0,310,720,20,warm+'8a');ellipse(530,357,79,14,dark+'80');rect(482,290,80,56,light+'bd',warm,2);ellipse(522,290,40,9,warm);ellipse(522,291,33,5,dark);ellipse(568,313,15,18,null,light+'b0',7);line(503,273,509,251,light+'55',3);line(530,270,526,245,light+'55',3);
    }else{
      rect(0,310,720,170,'ground');ellipse(364,270,165,75,null,light+'2b',2);circle(364,253,60,'planet');ellipse(364,260,91,17,null,warm+'50',4);for(let i=0;i<10;i++)circle(random()*720,80+random()*340,1.5,light+'85');
    }
    // The per-game props make subjects distinct even inside a shared world.
    const backgroundCount=shapes.length,v=profile.variant,px=110+v%4*125;
    if(id==='road-rush'){poly([270,480,327,300,393,300,450,480],dark+'99');for(let i=0;i<4;i++)rect(357,325+i*37,6,20,warm+'aa');}
    else if(id==='garden-care'){for(let i=0;i<3;i++){const x=225+i*140;ellipse(x,401,52,9,dark+'80');poly([x-30,355,x+30,355,x+23,400,x-23,400],warm+'aa',warm,2);line(x,355,x,320,light,5);ellipse(x-12,331,15,6,light);ellipse(x+12,316,15,6,light);}}
    else if(id==='basket-shot'){rect(550,160,90,62,light+'90',light,3);ellipse(595,228,37,8,null,warm,4);for(let i=0;i<6;i++)line(566+i*11,229,576+i*7,260,light+'80');}
    else if(id==='penalty-kick'){rect(220,245,280,100,null,light+'d0',4);for(let i=0;i<10;i++)line(220+i*31,245,220+i*31,345,light+'25');for(let i=0;i<5;i++)line(220,245+i*25,500,245+i*25,light+'25');}
    else if(id==='mini-golf'){ellipse(400,385,175,60,light+'20',light+'35',2);line(475,357,475,265,light,3);poly([475,265,516,279,475,291],warm);ellipse(475,361,13,4,dark);}
    else if(id==='stack-tower'||id==='towers-hanoi'){for(let i=0;i<5;i++)rect(275+i*9,390-i*20,170-i*18,17,i%2?light+'85':warm+'90',light+'65');}
    else if(id==='coin-catcher'){for(let i=0;i<5;i++){circle(175+i*85,115+i%3*35,12,warm,light,2);line(175+i*85,107+i%3*35,175+i*85,123+i%3*35,dark,2);}}
    else if(!['space','cafe'].includes(theme)){ellipse(px,392,27,7,dark+'85');circle(px,365,18,light+'55',light+'90',2);line(px-10,365,px+10,365,warm,2);line(px,355,px,375,warm,2);}
    const gradients={sky:[dark,mid,dark],ground:[mid,dark,dark],water:[mid,dark,light],planet:[warm,mid,dark]};
    const result={profile,shapes,gradients,backgroundCount};cache.set(id,result);return result;
  }
  function paint(ctx,id){
    const data=scene(id);ctx.save();for(const shape of data.shapes.slice(0,data.backgroundCount)){
      const {type,values:v,fill,stroke,width}=shape;let color=fill;
      if(data.gradients[fill]){const gradient=fill==='planet'?ctx.createRadialGradient(v[0]-v[2]*.3,v[1]-v[2]*.3,v[2]*.05,v[0],v[1],v[2]):ctx.createLinearGradient(0,type==='rect'?v[1]:0,720,480);data.gradients[fill].forEach((c,i)=>gradient.addColorStop(i/2,c));color=gradient;}
      ctx.beginPath();if(type==='rect')ctx.rect(...v);else if(type==='circle')ctx.arc(...v,0,Math.PI*2);else if(type==='ellipse')ctx.ellipse(...v,0,0,Math.PI*2);else{ctx.moveTo(v[0],v[1]);for(let i=2;i<v.length;i+=2)ctx.lineTo(v[i],v[i+1]);if(type==='polygon')ctx.closePath();}
      if(color){ctx.fillStyle=color;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
    }ctx.fillStyle='#08132b38';ctx.fillRect(0,0,720,480);ctx.restore();
  }
  function backdrop(id,namespace='scene'){
    const {shapes,gradients}=scene(id),prefix='ags-'+(profiles[id]?id:'fallback')+'-'+String(namespace).replace(/[^a-z0-9-]/gi,'');
    const defs=Object.entries(gradients).map(([name,colors])=>{const radial=name==='planet',tag=radial?'radialGradient':'linearGradient';return`<${tag} id="${prefix}-${name}" ${radial?'cx=".35" cy=".3" r=".7"':'x2="1" y2="1"'}>${colors.map((c,i)=>`<stop offset="${i/2}" stop-color="${c}"/>`).join('')}</${tag}>`;}).join('');
    const body=shapes.map(({type,values:v,fill,stroke,width})=>{
      const attrs=type==='rect'?`x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}"`:type==='circle'?`cx="${v[0]}" cy="${v[1]}" r="${v[2]}"`:type==='ellipse'?`cx="${v[0]}" cy="${v[1]}" rx="${v[2]}" ry="${v[3]}"`:type==='line'?`x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}"`:`points="${v.join(' ')}"`;
      return`<${type} ${attrs} fill="${gradients[fill]?`url(#${prefix}-${fill})`:fill||'none'}"${stroke?` stroke="${stroke}" stroke-width="${width}"`:''}/>`;
    }).join('');return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 480" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
  }
  // Each destination has a gameplay illustration, in addition to its world scenery.
  // These pure vector builders also supply the small illustration in the game intro.
  const accents=['#25d9f8','#a684ff','#ff86bd','#ffd166','#68edaf','#ff997f'];
  function visual(id){const p=profiles[id]||profiles['star-guard'];return Object.freeze({primary:accents[(p.variant+Object.keys(families).indexOf(p.theme))%accents.length],secondary:p.palette[2],warm:p.palette[3],ink:'#10162f',surface:p.palette[0],theme:p.theme});}
  function illustration(id){
    const v=visual(id),a=v.primary,b=v.secondary,gold='#ffd166',pink='#ff78b2',cyan='#25d9f8',green='#68edaf',ink='#151b3d',paper='#f8f4ff';
    const r=(x,y,w,h,c,round=14,edge='#ffffff50')=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+round+'" fill="'+c+'" stroke="'+edge+'" stroke-width="2"/>';
    const c=(x,y,radius,fill,edge='none',width=3)=>'<circle cx="'+x+'" cy="'+y+'" r="'+radius+'" fill="'+fill+'" stroke="'+edge+'" stroke-width="'+width+'"/>';
    const line=(d,color,width=7)=>'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"/>';
    const path=(d,fill,edge='none')=>'<path d="'+d+'" fill="'+fill+'" stroke="'+edge+'" stroke-width="3" stroke-linejoin="round"/>';
    const t=(text,x,y,size=36,color=paper)=>'<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="central" fill="'+color+'" style="font:800 '+size+'px system-ui,sans-serif">'+text+'</text>';
    const grid=(cols,rows,values,colors,cell=54)=>{
      const x=360-cols*cell/2,y=252-rows*cell/2;let body=r(x-14,y-14,cols*cell+28,rows*cell+28,ink,22);
      for(let i=0;i<cols*rows;i++){const value=values[i]||'',fill=Array.isArray(colors)?colors[i%colors.length]:colors||'#303d70';body+=r(x+i%cols*cell+3,y+Math.floor(i/cols)*cell+3,cell-6,cell-6,fill,Math.min(10,cell*.15));if(value)body+=t(value,x+(i%cols+.5)*cell,y+(Math.floor(i/cols)+.5)*cell,cell*.45,fill===gold||fill===green||fill===paper||fill==='#e2d7ff'?ink:paper);}
      return body;
    };
    const target=(x,y,radius=58)=>c(x,y,radius,pink)+c(x,y,radius*.7,paper)+c(x,y,radius*.44,pink)+c(x,y,radius*.17,paper);
    const coin=(x,y,radius=20)=>c(x,y+4,radius,'#b66a2d')+c(x,y,radius,gold,'#fff3bf',3)+line('M'+x+' '+(y-radius*.45)+'v'+radius*.9,'#b87930',4);
    const ship=(x,y,angle=0)=>'<g transform="translate('+x+' '+y+') rotate('+angle+')">'+path('M0 -53L36 40L0 24L-36 40Z',a,paper)+path('M-13 36L0 76L13 36',gold)+r(-10,-15,20,34,ink,9)+'</g>';
    const car=(x,y,color,scale=1)=>'<g transform="translate('+x+' '+y+') scale('+scale+')">'+r(-34,-22,9,27,ink,3)+r(25,-22,9,27,ink,3)+r(-34,38,9,28,ink,3)+r(25,38,9,28,ink,3)+r(-27,-53,54,130,color,17)+r(-20,-25,40,40,'#17284e',9)+r(-20,35,40,19,'#17284e',5)+r(-19,-45,10,5,paper,2)+r(9,-45,10,5,paper,2)+'</g>';
    const plants=(count=3)=>Array.from({length:count},(_,i)=>{const x=230+i*130;return r(x-36,288,72,75,[pink,a,gold][i%3],12)+line('M'+x+' 289V'+(190-i*13),green,9)+'<ellipse cx="'+(x-18)+'" cy="238" rx="27" ry="12" transform="rotate(25 '+(x-18)+' 238)" fill="'+green+'"/><ellipse cx="'+(x+19)+'" cy="214" rx="28" ry="13" transform="rotate(-25 '+(x+19)+' 214)" fill="'+b+'"/>'+c(x,178-i*13,22,[gold,pink,a][i%3])+c(x,178-i*13,8,paper);}).join('');
    const art={
      snake:()=>r(173,124,374,260,ink,25)+line('M230 305H310V245H382V193H446', '#1c845e',43)+line('M230 299H310V239H382V187H446',green,31)+c(449,185,23,green)+c(452,178,4,ink)+c(459,189,4,ink)+c(478,299,20,pink)+line('M477 279Q478 266 488 267',gold,5),
      breakout:()=>Array.from({length:18},(_,i)=>r(169+i%6*65,133+Math.floor(i/6)*45,57,35,[pink,a,green,gold][Math.floor(i/6)%4],9)).join('')+r(286,348,148,19,cyan,9)+c(435,301,15,paper)+line('M427 315L407 338',gold,5),
      'star-guard':()=>ship(363,286)+[245,360,475].map((x,i)=>'<g transform="translate('+x+' '+(145+i%2*25)+')">'+path('M-26 0L0 -22L26 0L35 26L0 14L-35 26Z',pink,paper)+'</g>').join('')+line('M352 209v-30M373 192v-30',gold,6),
      merge:()=>grid(4,3,['2','4','8','','4','8','16','','8','16','32','64'],['#324f89','#7551bd','#ac4e92',ink,gold,a,cyan,ink,green,a,pink,gold],66),
      mines:()=>grid(5,4,['1','1','2','','','2','⚑','3','','','1','2','2','','','','','1','1',''],['#315482','#6d55a7','#5168af','#263456','#263456'],49)+path('M335 194v34M335 194l28 10-28 10',pink,paper),
      memory:()=>[[-108,-45,false],[-36,-45,true],[36,-45,true],[108,-45,false],[-108,45,false],[-36,45,false],[36,45,false],[108,45,false]].map(([x,y,open],i)=>r(360+x-29,248+y-37,58,77,open?gold:i%2?a:'#53419b',11)+t(open?'★':'✦',360+x,248+y,32,open?ink:'#d0c5ff')).join(''),
      'block-drop':()=>grid(6,5,['','','','','','','','','','','','','','','','','','','','','','','','','','','','','',''],Array(30).fill('#1c2850'),43)+[[0,3,cyan],[1,3,cyan],[2,3,cyan],[2,4,cyan],[3,4,pink],[4,4,pink],[4,3,pink],[5,4,gold],[2,0,a],[2,1,a],[3,1,a],[2,2,a]].map(([x,y,color])=>r(234+x*43,148+y*43,37,37,color,6)).join(''),
      'crate-lab':()=>grid(5,4,['','','','','','','','✦','','','','','','✦','','','','','',''],['#476491','#23395d','#23395d','#23395d','#476491'],51)+r(322,223,44,44,gold,7)+line('M329 230l30 30m0-30-30 30','#a56832',4)+r(372,274,44,44,pink,7)+c(290,293,19,cyan,paper),
      'orbit-runner':()=>r(172,338,175,23,a,8)+r(412,276,143,22,cyan,8)+[290,360,430].map((x,i)=>coin(x,227-i*25,13)).join('')+r(274,267,43,50,paper,14)+r(279,278,34,19,ink,7)+r(281,312,13,18,pink,4)+r(301,312,13,18,pink,4)+path('M462 194Q498 164 527 195', 'none',gold),
      'lights-out':()=>grid(5,4,Array.from({length:20},(_,i)=>i%3?'●':'○'),Array.from({length:20},(_,i)=>i%3?gold:'#28375b'),52),
      'slide-tiles':()=>grid(3,3,['1','2','3','4','5','6','7','','8'],[a,cyan,pink,cyan,gold,a,pink,ink,green],72),
      'peg-solitaire':()=>grid(5,5,Array(25).fill(''),Array(25).fill('#644a8a'),43)+Array.from({length:25},(_,i)=>{const x=274+i%5*43,y=166+Math.floor(i/5)*43;return (i<5||i>19)&&(i%5===0||i%5===4)?'':c(x,y,14,i===12?ink:gold,'#ffe8ba');}).join(''),
      'n-queens':()=>grid(4,4,Array.from({length:16},(_,i)=>[1,7,8,14].includes(i)?'♛':''),Array.from({length:16},(_,i)=>(i%4+Math.floor(i/4))%2?'#6546a0':'#364579'),57),
      nonogram:()=>grid(5,5,Array.from({length:25},(_,i)=>[1,3,5,7,9,10,14,16,18,22].includes(i)?'':'·'),Array.from({length:25},(_,i)=>[1,3,5,7,9,10,14,16,18,22].includes(i)?a:paper),44)+t('1  3  1  3  1',360,105,20),
      'towers-hanoi':()=>line('M190 349H530',gold,13)+[240,360,480].map(x=>line('M'+x+' 160V343','#d8b9ff',9)).join('')+[0,1,2,3].map(i=>r(240-67+i*12,318-i*32,134-i*24,26,[pink,a,cyan,gold][i],10)).join(''),
      'maze-path':()=>grid(7,5,[],Array.from({length:35},(_,i)=>[1,2,3,9,10,11,15,16,18,22,23,25,26,30].includes(i)?'#51a5a0':ink),42)+line('M233 168V295H318V337H402V252H486',gold,8)+c(233,168,12,cyan)+t('★',486,253,30,gold),
      'connect-four':()=>grid(7,5,Array(35).fill(''),Array(35).fill('#2858ac'),44)+Array.from({length:35},(_,i)=>c(228+i%7*44,164+Math.floor(i/7)*44,15,i<14?ink:i%3?gold:pink,'#ffffff30')).join(''),
      'tic-tac-toe':()=>grid(3,3,['×','○','','','×','○','○','','×'],['#3d397c','#205776'],77),
      'reversi-mini':()=>grid(4,4,Array(16).fill(''),Array(16).fill('#217b72'),57)+[5,6,9,10,13,14].map((i,n)=>c(274+i%4*57,166+Math.floor(i/4)*57,21,n%2?paper:ink,'#ffffff70')).join(''),
      'word-search':()=>grid(5,4,['S','T','A','R','S','A','R','C','A','D','O','R','B','I','T','P','L','A','Y','S'],Array.from({length:20},(_,i)=>i<5?'#6960c0':'#334373'),49),
      'number-order':()=>grid(4,3,['8','3','11','6','1','9','5','12','4','7','2','10'],[a,'#2c456d','#2c456d','#2c456d'],62),
      'sudoku-mini':()=>grid(4,4,['1','','3','','','4','','2','2','','4','','','3','','1'],Array.from({length:16},(_,i)=>i%3?paper:'#e2d7ff'),56),
      'color-flood':()=>grid(6,5,[],Array.from({length:30},(_,i)=>i<9?cyan:[pink,gold,green,a,cyan][(i*7)%5]),43),
      'pipe-link':()=>grid(4,4,[],Array(16).fill('#293b67'),59)+line('M272 165V224H331V283H390V342H449',cyan,18)+line('M272 165V224H331V283H390V342H449','#b7fff9',5)+c(272,165,18,gold)+c(449,342,18,pink),
      'code-breaker':()=>r(217,133,286,235,ink,23)+Array.from({length:12},(_,i)=>c(270+i%4*60,188+Math.floor(i/4)*64,21,[a,cyan,gold,pink,green][i%5],paper)).join('')+[0,1,2].map(i=>c(480,188+i*64,5,gold)).join(''),
      'knights-tour':()=>grid(5,4,['1','','','','','2','','','','','','','♞','','','','','','',''],Array.from({length:20},(_,i)=>(i%5+Math.floor(i/5))%2?'#71569c':'#34456b'),52),
      'paddle-duel':()=>r(173,137,374,235,ink,24)+line('M360 154V351','#ffffff50',4)+r(202,221,17,90,cyan,9)+r(501,166,17,90,pink,9)+c(391,247,14,gold)+line('M375 250L333 268','#ffecad70',8),
      'sky-glider':()=>r(215,124,51,113,green,10)+r(215,323,51,66,green,10)+r(470,124,51,69,a,10)+r(470,282,51,107,a,10)+c(353,244,32,gold,paper)+path('M377 240L401 252L377 262',pink)+c(364,232,5,ink)+path('M331 253Q307 232 317 277Q341 278 350 257',pink),
      'meteor-dodge':()=>ship(359,303)+[[-122,-30,32],[-22,-105,38],[123,-45,29]].map(([x,y,sz])=>c(360+x,245+y,sz,'#aa689c',pink)+c(351+x,236+y,sz*.25,'#563775')).join(''),
      'coin-catcher':()=>[230,320,410,490].map((x,i)=>coin(x,153+i%2*49,23)).join('')+path('M263 290H457L436 360H284Z',pink,paper)+line('M280 291Q360 211 440 291',gold,9)+line('M307 306v38m35-38v38m35-38v38m35-38v38','#ffffff70',4),
      'road-rush':()=>path('M251 105H469L544 399H176Z',ink)+line('M360 121V162M360 191V232M360 261V302M360 331V373',gold,7)+car(301,290,cyan,.9)+car(418,187,pink,.7),
      'river-cross':()=>[0,1,2,3,4].map(i=>r(165,127+i*52,390,49,[green,cyan,cyan,'#263b63',green][i],4)).join('')+r(210,188,130,30,gold,12)+r(377,237,140,30,gold,12)+car(283,309,pink,.38)+c(386,355,20,green,paper)+c(377,340,7,green)+c(395,340,7,green)+c(377,339,3,ink)+c(395,339,3,ink),
      'asteroid-drift':()=>ship(360,265,30)+[[-127,-55,34],[128,55,38],[68,-108,24]].map(([x,y,sz])=>path('M'+(360+x-sz)+' '+(245+y)+'l'+sz*.4+' -'+sz+' '+sz+' -'+sz*.2+' '+sz*.8+' '+sz+' -'+sz*.8+' '+sz+' -'+sz+' '+sz*.1+'Z','#8b73bd',paper)).join('')+line('M404 173L425 136',gold,6),
      'gravity-flip':()=>r(167,129,386,22,a,8)+r(167,351,386,22,pink,8)+r(310,164,35,40,cyan,10)+path('M447 350l-24-53-24 53Z',gold)+line('M368 214v73m-15-15 15 15 15-15',paper,6),
      'ball-balance':()=>r(200,122,320,260,'#3e6291',30)+[[-70,-40],[50,66],[90,-60]].map(([x,y])=>c(360+x,250+y,24,ink,'#8cb5df',5)).join('')+c(326,256,24,cyan,paper)+c(451,321,16,gold)+line('M279 323l31-23',paper,5),
      'jump-tower':()=>[[195,333,135],[345,271,125],[225,202,112],[417,146,118]].map(([x,y,w],i)=>r(x,y,w,20,[pink,cyan,a,gold][i],8)).join('')+r(377,219,34,44,paper,10)+r(382,227,24,14,ink,4)+path('M286 286Q306 221 344 236', 'none',gold),
      'laser-dash':()=>r(176,136,368,236,ink,24)+[0,1,2].map(i=>line('M'+(253+i*90)+' 155V345',i===1?pink:'#ff78b250',i===1?10:4)).join('')+r(293,255,38,47,cyan,10)+line('M283 268H239M282 285H219',gold,5),
      'orbit-collect':()=>c(360,252,106,'none','#a89bff80',3)+c(360,252,68,'none','#a89bff50',2)+c(360,252,34,pink,paper)+c(449,195,22,cyan,paper)+[0,1,2,3].map(i=>coin(360+Math.cos(i*1.57)*106,252+Math.sin(i*1.57)*106,13)).join(''),
      'shield-defense':()=>c(360,252,59,a,paper)+c(360,252,28,cyan)+line('M279 189A103 103 0 0 1 452 209',green,15)+[[230,153],[482,156],[496,319]].map(([x,y])=>path('M'+x+' '+y+'l-12-18h24Z',pink,paper)).join(''),
      'target-range':()=>target(298,251,76)+target(452,203,50)+line('M235 301L374 200',gold,6)+path('M374 200l-25 7 18 18Z',gold),
      'penalty-kick':()=>r(194,163,332,173,ink,8)+Array.from({length:8},(_,i)=>line('M'+(205+i*44)+' 168V331','#92cad64a',2)).join('')+Array.from({length:4},(_,i)=>line('M201 '+(185+i*44)+'H519','#92cad64a',2)).join('')+c(360,337,28,paper)+path('M360 320l15 11-5 18h-20l-5-18Z',ink)+r(345,214,30,51,pink,9)+line('M354 225l-39-19m47 19 42-19',pink,12),
      'mini-golf':()=>'<ellipse cx="360" cy="292" rx="176" ry="83" fill="'+green+'" stroke="'+paper+'" stroke-width="3"/>'+line('M425 282V152',paper,7)+path('M425 152l64 23-64 24Z',pink)+ '<ellipse cx="425" cy="284" rx="20" ry="8" fill="'+ink+'"/>'+c(283,293,17,paper)+line('M297 290Q352 248 408 281',gold,4),
      'basket-shot':()=>r(406,136,116,79,paper,10)+r(433,160,63,45,'#d4c9f1',4)+line('M422 226H510',pink,8)+path('M427 233l12 49h53l13-49', 'none',paper)+c(280,300,42,'#ff9970',paper)+line('M242 300H317M280 258Q257 297 280 342M280 258Q304 298 280 342','#ab4f49',4)+line('M306 254Q355 159 428 200',gold,4),
      'simon-sequence':()=>grid(2,2,['1','2','3','4'],[cyan,a,pink,gold],111)+c(360,252,40,ink,paper)+t('▶',360,251,30,paper),
      'reaction-stop':()=>r(204,159,312,191,green,30)+c(360,223,30,ink)+t('GO!',360,302,47,ink)+path('M345 222l11 11 20-24', 'none',green),
      'rhythm-tap':()=>r(178,169,364,159,ink,28)+r(330,185,61,125,green,12)+line('M200 249H521','#ffffff70',4)+[230,284,359,447,496].map((x,i)=>c(x,249,14,i===2?gold:a,paper)).join('')+t('♪',360,122,48,gold),
      'whack-orb':()=>grid(3,3,['','','','','●','','','',''],Array.from({length:9},(_,i)=>i===4?pink:'#25385f'),71)+c(360,252,24,pink,paper),
      'aim-trainer':()=>target(360,252,89)+line('M360 137V187M360 316V367M247 252H293M427 252H473',cyan,7),
      'math-sprint':()=>r(195,136,330,99,ink,20)+t('8 × 4 = ?',360,186,43,gold)+[24,32,36].map((n,i)=>r(212+i*104,262,89,77,n===32?green:a,17)+t(n,256+i*104,299,34,n===32?ink:paper)).join(''),
      'color-word':()=>r(195,140,330,105,ink,22)+t('TÍM',360,194,58,cyan)+[cyan,a,pink,gold].map((color,i)=>r(202+i*83,279,68,68,color,16)).join(''),
      'odd-one-out':()=>grid(4,3,Array.from({length:12},(_,i)=>i===6?'◆':'◇'),[a,'#345178'],65),
      'pattern-recall':()=>grid(4,4,Array.from({length:16},(_,i)=>[1,6,8,11,14].includes(i)?'✦':''),Array.from({length:16},(_,i)=>[1,6,8,11,14].includes(i)?a:'#283b67'),57),
      'treasure-grid':()=>grid(5,4,['1','','2','','','','2','','3','','','','★','','','','1','','',''],Array.from({length:20},(_,i)=>i===12?gold:i%3?'#206a65':'#38568c'),51),
      'lock-timing':()=>c(360,252,109,ink,a,12)+line('M297 164A107 107 0 0 1 427 168',green,18)+line('M360 252L404 168',gold,9)+c(360,252,19,pink,paper)+t('03',360,296,28,paper),
      'stack-tower':()=>[0,1,2,3,4].map(i=>r(235+i*9,340-i*36,251-i*18,31,[cyan,a,pink,gold,green][i],7)).join('')+r(296,131,142,31,paper,7),
      'constellation-trace':()=>line('M218 280L287 155L374 225L448 148L507 295L380 348L218 280',cyan,5)+[[218,280],[287,155],[374,225],[448,148],[507,295],[380,348]].map(([x,y],i)=>c(x,y,13,i<3?gold:paper)+t(i+1,x,y+29,17)).join(''),
      'pixel-painter':()=>grid(8,6,[],Array.from({length:48},(_,i)=>{const x=i%8,y=Math.floor(i/8);return y>0&&y<5&&x>1&&x<6?[a,pink,gold,cyan][(x+y)%4]:'#25345c';}),37)+line('M476 202L538 145',gold,19)+path('M472 205l-7 24 25-7Z',paper),
      'garden-care':()=>plants(),
      'cafe-orders':()=>r(208,137,125,152,ink,18)+line('M230 168H311M230 196H295M230 225H302',gold,5)+r(372,207,122,120,paper,22)+'<ellipse cx="433" cy="207" rx="61" ry="16" fill="#765047" stroke="'+gold+'" stroke-width="4"/>'+line('M495 226Q551 221 529 272Q517 291 495 280',paper,13)+line('M403 175q-18-23 0-43M438 170q18-25 0-44M472 178q-18-26 0-44',pink,6)
    };
    return art[id]?art[id]():'';
  }
  const posterCache=new Map();
  function thumbnail(id,namespace='card'){
    const key=id+':'+namespace;if(posterCache.has(key))return posterCache.get(key);
    const base=backdrop(id,namespace),v=visual(id),art=illustration(id);
    const svg=base.replace('</svg>','<ellipse cx="360" cy="404" rx="192" ry="16" fill="#070c2b60"/><g data-game-art="'+(profiles[id]?id:'unknown')+'" stroke-linecap="round" stroke-linejoin="round">'+art+'</g><path d="M47 427h52M47 427v-25M673 427h-52M673 427v-25" fill="none" stroke="'+v.primary+'" stroke-width="3" opacity=".7"/></svg>');
    posterCache.set(key,svg);return svg;
  }
  const api=Object.freeze({profiles,paint,thumbnail,backdrop,visual,illustration});scope.HHAllGameScenes=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
