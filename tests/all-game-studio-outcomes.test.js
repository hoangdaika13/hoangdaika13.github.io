'use strict';
// Near-end fixtures verify real finishing actions, not full playthroughs or forced result flags.
// Fresh-state completion tests below separately verify representative balance/solvability.
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../all-game-studio-core.js'),catalog=require('../all-game-studio-catalog.js');
const games=Object.assign({},...[...new Set(catalog.map(g=>g.bundle))].map(b=>require('../all-game-'+b+'.js').games));
const cmd=id=>({type:'command',id}),cell=index=>({type:'cell',index}),tick=(held={})=>({type:'tick',held});
const act=(g,s,...actions)=>actions.reduce((s,a)=>g.step(s,a,.05),s);
function frames(g,s,n=1,held={}){for(let i=0;i<n&&s.status==='playing';i++)s=g.step(s,tick(held),.05);return s;}
function deadline(g,s){s.timeLeft=.01;return frames(g,s,10);}
const fixtures={
  'fortress-weave':[
    (g,s)=>{Object.assign(s,{wave:6,phase:'wave',spawn:0,spawnTimer:1,enemies:[{id:601,p:1,hp:1,max:50,kind:'scout',slow:0}],towers:[{cell:24,kind:'bolt',level:3,cd:0}]});return frames(g,s);},
    (g,s)=>{Object.assign(s,{health:1,wave:6,phase:'wave',spawn:0,spawnTimer:1,enemies:[{id:601,p:16.999,hp:30,max:30,kind:'armor',slow:0}]});return frames(g,s);}
  ],
  'frontier-command':[
    (g,s)=>{s.bases[1].hp=1;s.units=[{uid:1,owner:1,role:'soldier',x:620,y:90,hp:50,cd:0,route:[]}];return frames(g,s);},
    (g,s)=>{s.bases[0].hp=1;s.units=[{uid:1,owner:-1,role:'soldier',x:90,y:380,hp:50,cd:0,route:[]}];return frames(g,s);}
  ],
  'hex-vanguard':[
    (g,s)=>{s.units=[{uid:0,owner:1,pos:8,hp:14,ap:3},{uid:3,owner:-1,pos:9,hp:1,ap:3}];s.selected=0;return g.step(s,cell(9));},
    (g,s)=>{s.units=[{uid:0,owner:1,pos:43,hp:1,ap:3},{uid:3,owner:-1,pos:44,hp:12,ap:3}];return g.step(s,cmd('end'));}
  ],
  'island-dominion':[
    (g,s)=>{s.owner[6]=s.owner[12]=1;s.tech=1;s.gold=30;return g.step(s,cmd('research'));},
    (g,s)=>{s.turn=16;return g.step(s,cmd('end'));}
  ],
  'hidden-fleet':[
    (g,s)=>{s=g.step(s,cmd('auto'));const last=s.enemyShips.at(-1).at(-1);s.shotsOnEnemy=s.enemyBoard.map(v=>v?3:1);s.shotsOnEnemy[last]=0;return g.step(s,cell(last));},
    (g,s)=>{s=g.step(s,cmd('auto'));const last=s.playerShips.at(-1).at(-1);s.shotsOnPlayer=s.playerBoard.map(v=>v?3:1);s.shotsOnPlayer[last]=0;return act(g,s,cmd('sonar'),cell(24));}
  ],
  'crater-command':[
    (g,s)=>{s.tanks[1].hp=1;s.phase='flight';s.shell={x:s.tanks[1].x,y:g.rules.ground(s,s.tanks[1].x)-1,vx:0,vy:50,trail:[],owner:0,heavy:false};return frames(g,s);},
    (g,s)=>{s.tanks[0].hp=1;s.phase='flight';s.shell={x:s.tanks[0].x,y:g.rules.ground(s,s.tanks[0].x)-1,vx:0,vy:50,trail:[],owner:1,heavy:false};return frames(g,s);}
  ],
  'nexus-conquest':[
    (g,s)=>{s.nodes.forEach(n=>n.owner=1);s.nodes[0].owner=-1;s.nodes[0].units=1;s.fleets=[{from:3,to:0,owner:1,amount:5,p:.99}];s.ai=10;return frames(g,s);},
    (g,s)=>{s.nodes.forEach(n=>n.owner=-1);s.nodes[0].owner=1;s.nodes[0].units=1;s.fleets=[{from:3,to:0,owner:-1,amount:5,p:.99}];s.ai=10;return frames(g,s);}
  ],
  'squad-draft':[
    (g,s)=>{s.phase='battle';s.round=5;s.fighters=[{uid:1,owner:1,type:0,level:2,x:300,y:200,hp:50,max:50,attack:10,range:40,cd:0},{uid:2,owner:-1,type:0,level:1,x:320,y:200,hp:1,max:50,attack:5,range:40,cd:2}];return frames(g,s);},
    (g,s)=>{s.phase='battle';s.round=5;s.health=1;s.fighters=[{uid:1,owner:1,type:0,level:1,x:300,y:200,hp:1,max:50,attack:5,range:40,cd:2},{uid:2,owner:-1,type:0,level:2,x:320,y:200,hp:50,max:50,attack:10,range:40,cd:0}];return frames(g,s);}
  ],
  'runedeck-quest':[
    (g,s)=>{s.level=5;s.enemy=1;s.hand=['strike'];return g.step(s,cmd('card0'));},
    (g,s)=>{s.health=1;s.guard=0;s.intent='attack';s.intentDamage=10;return g.step(s,cmd('end'));}
  ],
  'royal-chess':[
    (g,s)=>{s.board=Array(64).fill('');s.board[0]='k';s.board[18]='K';s.board[17]='Q';s.castling='';s.ep=-1;s.positions=[];return act(g,s,cell(17),cell(9));},
    (g,s)=>{s.board=Array(64).fill('');s.board[56]='K';s.board[42]='k';s.board[41]='q';s.turn=-1;s.castling='';s.ep=-1;s.positions=[];const m=g.rules.legal(s,-1).find(m=>m.from===41&&m.to===49);assert.ok(m);g.rules.apply(s,m);return s;}
  ],
  'crown-draughts':[
    (g,s)=>{s.board=Array(64).fill(0);s.board[42]=1;s.board[33]=s.board[17]=-1;return act(g,s,cell(42),cell(24),cell(10));},
    (g,s)=>{s.board=Array(64).fill(0);s.board[33]=1;s.board[17]=-1;return act(g,s,cell(33),cell(26));}
  ],
  'lotus-go':[
    (g,s)=>{s.board=Array(81).fill(1);s.board[20]=s.board[60]=0;s.previousBoard='';return g.step(s,cmd('pass'));},
    (g,s)=>{s.board=Array(81).fill(-1);s.board[20]=s.board[60]=0;s.previousBoard='';return g.step(s,cmd('pass'));}
  ],
  'seed-duel':[
    (g,s)=>{s.board=Array(14).fill(0);s.board[5]=1;s.board[7]=3;s.board[6]=34;s.board[13]=10;return g.step(s,cell(12));},
    (g,s)=>{s.board=Array(14).fill(0);s.board[5]=1;s.board[7]=3;s.board[6]=10;s.board[13]=34;return g.step(s,cell(12));}
  ],
  'bridge-hex':[
    (g,s)=>{for(const i of [3,10,17,24,31,38])s.board[i]=1;return g.step(s,cell(45));},
    (g,s)=>{for(const i of [21,22,23,24,25,26])s.board[i]=-1;return g.step(s,cell(0));}
  ],
  'hidden-ranks':[
    (g,s)=>{s.phase='battle';s.board=Array(36).fill(0);s.board[6]=4;s.board[0]=-7;s.board[35]=7;return act(g,s,cell(6),cell(0));},
    (g,s)=>{s.phase='battle';s.board=Array(36).fill(0);s.board[34]=-4;s.board[0]=-7;s.board[35]=7;s.board[21]=1;return act(g,s,cell(21),cell(22));}
  ],
  'wall-race':[
    (g,s)=>{s.pawns=[8,3];return g.step(s,cell(1));},
    (g,s)=>{s.pawns=[45,38];return g.step(s,cell(44));}
  ],
  'auction-guild':[
    (g,s)=>{Object.assign(s,{round:7,gold:[80,30],values:[60,10],collection:[[0,0,0],[0,0,0]],bid:8,leader:-1,aiValue:5});return g.step(s,cmd('pass'));},
    (g,s)=>{Object.assign(s,{round:7,gold:[20,90],values:[10,60],collection:[[0,0,0],[0,0,0]],bid:8,leader:-1,aiValue:5});return g.step(s,cmd('pass'));}
  ],
  'dice-expedition':[
    (g,s)=>{s.level=4;s.enemy=1;s.dice=Array(5).fill(6);s.roles=Array(5).fill('attack');return g.step(s,cmd('resolve'));},
    (g,s)=>{s.health=1;s.dice=Array(5).fill(1);s.roles=Array(5).fill('attack');return g.step(s,cmd('resolve'));}
  ],
  'gem-tactics':[
    (g,s)=>{s.level=3;s.enemy=1;s.mana=8;return g.step(s,cmd('skill'));},
    (g,s)=>{s.health=1;const [a,b]=g.rules.swaps(s.board)[0];return act(g,s,cell(a),cell(b));}
  ],
  'dungeon-chronicle':[
    (g,s)=>{s.level=3;s.player=17;s.hasKey=true;s.monsters.forEach(m=>m.hp=0);return g.step(s,{type:'up'});},
    (g,s)=>{s.health=1;s.monsters=[{pos:55,hp:9,attack:5,boss:false}];return g.step(s,{type:'right'});}
  ],
  'blast-grid':[
    (g,s)=>{s.bot.timer=0;s.bombs=[{pos:89,time:0,range:2,owner:1}];return frames(g,s);},
    (g,s)=>{s.bombs=[{pos:14,time:0,range:2,owner:1}];return frames(g,s);}
  ],
  'street-vanguard':[
    (g,s)=>{s.level=3;s.player={x:2925,y:350};s.enemies=[{id:1,x:2940,y:350,hp:1,max:45,cd:2,stun:0,windup:0}];return frames(g,g.step(s,cmd('punch')));},
    (g,s)=>{s.health=1;s.enemies=[{id:1,x:100,y:350,hp:30,max:30,cd:2,stun:0,windup:.01}];return frames(g,s);}
  ],
  'blade-duel':[
    (g,s)=>{s.level=3;s.player.x=300;s.enemy.x=390;s.enemy.hp=1;return frames(g,g.step(s,cmd('slash')));},
    (g,s)=>{s.health=1;s.enemy.x=s.player.x+80;s.enemy.mode='windup';s.enemy.timer=.01;s.enemy.kind='slash';return frames(g,s);}
  ],
  'silent-infiltrator':[
    (g,s)=>{s.hasFile=true;s.player.x=94;s.player.y=420;return frames(g,s,10,{left:true});},
    (g,s)=>{s.health=1;s.player={x:90,y:420};s.guards[0]={...s.guards[0],x:62,y:420,state:'chase',suspicion:1,memory:{x:90,y:420},investigate:3};return frames(g,s,10);}
  ],
  'grapple-sky':[
    (g,s)=>{s.anchor=-1;s.player={x:1799,y:407,vx:80,vy:1};return frames(g,s,5,{right:true});},
    (g,s)=>{s.health=1;s.anchor=-1;s.player={x:200,y:549,vx:0,vy:100};return frames(g,s,5);}
  ],
  'returning-blade':[
    (g,s)=>{s.level=4;s.enemies=[{id:1,x:380,y:220,hp:1,cd:2}];s.blade={x:370,y:220,vx:200,vy:0,phase:'out',life:0,hits:[]};return frames(g,s,5);},
    (g,s)=>{s.health=1;s.enemies=[{id:1,x:s.player.x,y:s.player.y,hp:20,cd:0}];return frames(g,s,5);}
  ],
  'frontier-trail':[
    (g,s)=>{for(let y=7;y<14;y++)for(let x=0;x<20;x++)s.board[y*20+x]=1;s.trail=[130,110,90,70,50,30];s.player=30;s.safe=150;s.enemies=[{x:3,y:3,vx:1,vy:1},{x:4,y:4,vx:1,vy:1}];s.move=0;return frames(g,s,1,{up:true});},
    (g,s)=>{s.health=1;s.trail=[31,30];s.player=30;s.safe=11;s.move=0;return frames(g,s,1,{right:true});}
  ],
  'crystal-excavator':[
    (g,s)=>{s.ore=5;s.rescued=1;s.cargo=true;s.player=37;s.board[37]=0;s.board=s.board.map(v=>v===4?0:v);return g.step(s,{type:'up'});},
    (g,s)=>{s.air=.01;s.player=37;return frames(g,s,10);}
  ],
  'kinetic-arena':[
    (g,s)=>{s.level=3;s.enemies=[{id:1,x:400,y:200,hp:1,cd:2}];s.objects=[{id:1,x:385,y:200,vx:200,vy:0,r:15,mass:1,held:false,thrown:true,hit:[]}];return frames(g,s,5);},
    (g,s)=>{s.health=1;s.shots=[{x:s.player.x,y:s.player.y,vx:0,vy:0,life:2,owner:-1}];return frames(g,s,5);}
  ],
  'portal-courier':[
    (g,s)=>{s.level=3;g.rules.room(s);s.crate={...s.crate,x:520,y:166,vx:180,vy:0,grounded:true};return frames(g,s,5);},
    (g,s)=>{s.health=1;s.player.x=700;s.player.y=519;s.player.vy=100;return frames(g,s,5);}
  ],
  'ring-sumo':[
    (g,s)=>{s.wins=2;s.enemy.x=544.5;s.enemy.y=250;s.enemy.vx=50;s.enemy.vy=0;s.enemy.mode='recover';s.enemy.timer=1;s.wait=0;return frames(g,s,5);},
    (g,s)=>{s.losses=2;s.wait=0;s.player.x=175.5;s.player.y=250;s.player.vx=-50;s.player.vy=0;return frames(g,s,5);}
  ],
  'titan-ascent':[
    (g,s)=>{s.broken=[3,6,9];s.hold=9;s.stamina=80;return frames(g,g.step(s,{type:'up'}),30);},
    (g,s)=>{s.health=1;s.hold=-1;s.player.y=1269;s.player.vy=100;return frames(g,s,5);}
  ],
  'sky-hoist':[
    (g,s)=>{s.rescued=2;s.cargo=2;s.people[0].rescued=s.people[1].rescued=true;s.player={x:110,y:250,vx:0,vy:0};s.hook={x:110,y:350,vx:0,vy:0};return frames(g,g.step(s,cmd('hook')));},
    deadline
  ],
  'trial-rider':[
    (g,s)=>{s.checkpoint=1680;s.wheels=[1925,1973].map(x=>({x,y:g.rules.height(x)-12,vx:150,vy:0}));return frames(g,s,5,{up:true});},deadline
  ],
  'apex-drift':[
    (g,s)=>{s.laps=2;s.next=0;s.player={x:417,y:395,vx:-100,vy:0,angle:Math.PI,forward:100};return frames(g,s,5,{up:true});},deadline
  ],
  'prism-pinball':[
    (g,s)=>{s.score=2100;s.waiting=false;s.ball={x:230,y:194,vx:0,vy:-100,r:8};return frames(g,s,5);},
    (g,s)=>{s.lives=1;s.waiting=false;s.ball={x:360,y:489,vx:0,vy:100,r:8};return frames(g,s,5);}
  ],
  'bubble-reactor':[
    (g,s)=>{s.level=3;s.board=Array(90).fill(-1);s.board[0]=s.board[1]=0;s.board[10]=1;s.current=0;s.ball={...g.rules.position(2),y:39,vx:0,vy:-100};return frames(g,s,5);},
    (g,s)=>{s.misses=4;s.board=Array(90).fill(-1);for(let y=0;y<8;y++)s.board[y*10]=y%2;s.board[9]=4;s.current=4;s.ball={...g.rules.position(1),y:39,vx:0,vy:-100};return frames(g,s,5);}
  ],
  'abyss-rescue':[
    (g,s)=>{s.rescued=2;s.cargo=2;s.people[0].rescued=s.people[1].rescued=true;s.people[2].net=0;s.player={x:100,y:117,vx:0,vy:0};return frames(g,g.step(s,cmd('rescue')));},
    (g,s)=>{s.health=.2;s.oxygen=0;s.player.x=300;s.player.y=400;return frames(g,s,5);}
  ],
  'sky-interceptor':[
    (g,s)=>{s.wave=5;s.phase='wave';s.left=0;s.incoming=[{x:360,y:200,vx:0,vy:30,target:1,split:false}];s.explosions=[{x:360,y:200,max:55,age:.3}];return frames(g,s,100);},
    (g,s)=>{s.cities.forEach((c,i)=>c.hp=i?0:1);s.phase='wave';s.left=0;s.incoming=[{x:s.cities[0].x,y:434,vx:0,vy:50,target:0,split:false}];return frames(g,s,5);}
  ],
  'polarity-workshop':[
    (g,s)=>{s.level=3;s.gate=3;s.particle.x=623;s.particle.y=240;s.particle.vx=s.particle.vy=0;s.dwell=.34;return frames(g,s,3);},deadline
  ],
  'forge-expedition':[
    (g,s)=>{s.level=3;s.phase='battle';s.weapon={quality:.97,power:22,speed:1,guard:7};s.enemy=1;return g.step(s,cmd('attack'));},
    (g,s)=>{s.health=1;s.phase='battle';s.weapon={quality:.12,power:10,speed:1,guard:1};s.enemy=38;return g.step(s,cmd('attack'));}
  ],
  'factory-flow':[
    (g,s)=>{s.delivered=7;s.running=true;s.clock=.24;s.tiles[28]={kind:'belt',dir:1,queue:[2],process:0};return frames(g,s);},
    (g,s)=>{s.running=true;s.timeLeft=.01;return frames(g,s,10);}
  ],
  'rail-dispatch':[
    (g,s)=>{s.delivered=9;s.mistakes=2;s.schedule=[];s.queue=[];s.trains=[{id:1,from:2,to:3,p:.999,dest:3,speed:80}];return frames(g,s,5);},
    (g,s)=>{s.mistakes=2;s.schedule=[];s.queue=[];s.trains=[{id:1,from:6,to:7,p:.999,dest:3,speed:80}];return frames(g,s,5);}
  ],
  'tide-merchants':[
    (g,s)=>{s.gold=140;s.day=10;return g.step(s,cmd('finish'));},
    (g,s)=>g.step(s,cmd('finish'))
  ],
  'frontier-colony':[
    (g,s)=>{s.day=9;s.beacon=7;s.food=s.fuel=20;s.tools=2;s.assign[5]=1;return g.step(s,cmd('end'));},
    (g,s)=>{s.day=9;s.health=1;s.food=s.fuel=0;return g.step(s,cmd('end'));}
  ],
  'wildfire-command':[
    (g,s)=>{s.rescued=2;s.people[0].rescued=s.people[1].rescued=true;s.units[0].cargo=2;s.people[2].carrier=0;return g.step(s,cmd('rescue'));},
    (g,s)=>{s.health=1;s.fire[63]=1;s.fuel[63]=2;return g.step(s,cmd('end'));}
  ],
  'bridgeworks':[
    (g,s)=>{s.bars=g.rules.guide.map(([a,b],i)=>({a,b,material:[6,7,8].includes(i)?1:0}));s.phase='test';s.car=654;return frames(g,s,5);},
    (g,s)=>{s.bars=[{a:0,b:1,material:0}];s.phase='test';s.lives=1;return frames(g,s);}
  ],
  'drone-programmer':[
    (g,s)=>{s.level=3;g.rules.reset(s);s.player=37;s.direction=3;s.hasBattery=true;s.program=['F'];s.code=g.rules.compile(s.program);return g.step(s,cmd('step'));},
    (g,s)=>{s.energy=0;s.program=['F'];s.code=g.rules.compile(s.program);return g.step(s,cmd('step'));}
  ],
  'living-world':[
    (g,s)=>{s.season=7;s.stability=2;s.plants=s.terrain.map(v=>v===2?0:8);s.herbs=s.terrain.map((v,i)=>v!==2&&i%4===0?2:0);s.predators=s.terrain.map((v,i)=>v!==2&&i%9===0?1:0);return g.step(s,cmd('season'));},
    (g,s)=>{s.season=11;s.herbs=s.herbs.map(()=>0);s.predators=s.predators.map(()=>0);return g.step(s,cmd('season'));}
  ],
  'castle-mosaic':[
    (g,s)=>mosaicPlay(g,s,true),
    (g,s)=>mosaicPlay(g,s,false)
  ]
};
function mosaicPlay(g,s,winning){
  function place(i,r){while(s.rotation!==r)s=g.step(s,cmd('rotate'));s=g.step(s,cell(i));}
  if(winning){place(28,0);place(36,0);place(1,2);}
  for(let k=0;k<14&&s.status==='playing';k++){
    const moves=g.rules.moves(s);if(!moves.length){s=g.step(s,cmd('discard'));continue;}
    const scored=moves.map(m=>{const board=s.board.slice();for(const i of g.rules.cells(s.deck[s.piece],m.r,m.i))board[i]=s.deck[s.piece].type;const v=g.rules.score(board);return{...m,value:v.score+(winning?20*(Math.min(2,v.homes)+Math.min(2,v.farms)):0)};}).sort((a,b)=>winning?b.value-a.value:a.value-b.value);
    place(scored[0].i,scored[0].r);
  }return s;
}
assert.equal(Object.keys(fixtures).length,50);
for(const row of catalog)for(const [index,result] of ['won','lost'].entries())test(row.id+': real '+result+' condition from a near-end fixture',()=>{
  const game=games[row.id],start=game.create({seed:2026,difficulty:'normal'}),s=fixtures[row.id][index](game,start);
  assert.equal(s.status,result,s.message+' | '+game.describe(s).summary);assert.notEqual(s.result,'draw');assert.ok(Number.isFinite(s.score));
  assert.deepEqual(game.step(s,tick({action:true}),.05),s,'result must remain frozen');
});

test('tower defense: a fresh six-wave campaign is winnable with legal builds/upgrades',()=>{
  const g=games['fortress-weave'];let s=g.create({seed:2026});
  for(const i of [29,41,53])s=g.step(s,cell(i));
  for(let wave=1;wave<=6&&s.status==='playing';wave++){
    for(const i of [29,41,53]){s=g.step(s,cell(i));while(s.gold>=45&&s.towers.find(t=>t.cell===i).level<3)s=g.step(s,cmd('upgrade'));}
    for(const i of [52,55,67,57,27])if(s.gold>=50)s=g.step(s,cell(i));
    s=g.step(s,cmd('wave'));for(let i=0;i<3000&&s.phase==='wave'&&s.status==='playing';i++)s=frames(g,s);
  }assert.equal(s.status,'won');assert.equal(s.kills,66);assert.ok(s.health>0);
});
test('RTS: a fresh resource/recruiting campaign can defeat the opposing base',()=>{
  const g=games['frontier-command'];let s=g.create({seed:2026});s=act(g,s,cmd('barracks'),cmd('worker'));
  for(let i=0;i<3000&&s.status==='playing';i++){if(s.gold[0]>=40)s=g.step(s,cmd('soldier'));s=frames(g,s);}
  assert.equal(s.status,'won');assert.ok(s.bases[0].hp>0);
});
test('colony: a fresh ten-day balanced worker plan survives and builds the beacon',()=>{
  const g=games['frontier-colony'];let s=g.create({seed:2026});
  for(let day=0;day<10&&s.status==='playing';day++)s=act(g,s,cmd('job0'),cmd('job0'),cmd('job1'),cmd('job1'),cmd('job2'),cmd('job5'),cmd('end'));
  assert.equal(s.status,'won');assert.equal(s.day,10);assert.ok(s.health>0&&s.beacon>=8);
});
test('ecosystem: fresh-state feedback can sustain the required three stable seasons',()=>{
  const g=games['living-world'];let s=g.create({seed:2026});
  for(let season=0;season<12&&s.status==='playing';season++){if(g.rules.totals(s).predators<3.5&&s.points>=4)s=act(g,s,cmd('predator'),cell(0));s=g.step(s,cmd('season'));}
  assert.equal(s.status,'won');assert.ok(s.stability>=3);
});
test('mosaic cannot remain stuck on an unplaceable final piece with unused discards',()=>{
  const g=games['castle-mosaic'];let s=g.create();s.piece=11;s.placed=9;s.board=s.board.map(v=>v===0?4:v);s=g.step(s,cmd('rotate'));g.rules.check(s);assert.equal(s.status,'lost');
});
