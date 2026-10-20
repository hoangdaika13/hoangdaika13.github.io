(function(scope){'use strict';
  // Original vector scenery shared by thumbnails, accessible boards and Canvas.
  // No image requests, hidden renderer, animation loop or change to game physics.
  const themes={
    space:['#080d29','#29316a','#73d9fc','#f6dca0'],forest:['#102d38','#487d77','#b4e9b3','#ffe1a2'],
    alpine:['#172d55','#819bb6','#ddf4ff','#ffd3b7'],city:['#14192f','#443360','#a19ffa','#72eff0'],
    river:['#193747','#6eaca4','#c2ece0','#ffdc9e'],stadium:['#101e3f','#485a88','#8ed8bd','#fff4d5'],
    workshop:['#17192e','#514465','#d1b9f5','#f5d895'],temple:['#1d203c','#65567f','#cbb8ee','#f6dca0'],
    garden:['#183b39','#81a99b','#d4efbe','#ffe1ab'],cafe:['#281d32','#8c665e','#efd1a3','#f8f0d9'],
    sea:['#10273d','#3c8393','#8bd9de','#f8cc9c'],solar:['#202246','#825673','#f8b787','#ffe5ac']
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
    }ctx.restore();
  }
  function thumbnail(id){
    const {shapes,gradients}=scene(id),prefix='ags-'+(profiles[id]?id:'fallback');
    const defs=Object.entries(gradients).map(([name,colors])=>{const radial=name==='planet',tag=radial?'radialGradient':'linearGradient';return`<${tag} id="${prefix}-${name}" ${radial?'cx=".35" cy=".3" r=".7"':'x2="1" y2="1"'}>${colors.map((c,i)=>`<stop offset="${i/2}" stop-color="${c}"/>`).join('')}</${tag}>`;}).join('');
    const body=shapes.map(({type,values:v,fill,stroke,width})=>{
      const attrs=type==='rect'?`x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}"`:type==='circle'?`cx="${v[0]}" cy="${v[1]}" r="${v[2]}"`:type==='ellipse'?`cx="${v[0]}" cy="${v[1]}" rx="${v[2]}" ry="${v[3]}"`:type==='line'?`x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}"`:`points="${v.join(' ')}"`;
      return`<${type} ${attrs} fill="${gradients[fill]?`url(#${prefix}-${fill})`:fill||'none'}"${stroke?` stroke="${stroke}" stroke-width="${width}"`:''}/>`;
    }).join('');return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 480" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
  }
  const api=Object.freeze({profiles,paint,thumbnail});scope.HHAllGameScenes=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
