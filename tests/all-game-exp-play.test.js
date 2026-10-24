'use strict';
// Fresh-state completion proofs use only create/step inputs. Numerical controllers
// and visible-board solvers exercise the same rules as keyboard/touch play.
const test=require('node:test'),assert=require('node:assert/strict');
const modules=['sports','precision','vehicles','cards','board','classic','social'];const games=Object.assign({},...modules.map(n=>require('../all-game-exp-'+n+'.js').games));
function player(id,seed=2026,difficulty='easy'){const g=games[id];let s=g.create({seed,difficulty});return{g,get s(){return s;},act(a){s=g.step(s,a,.05);return s;},cmd(id){return this.act({type:'command',id});},cell(index){return this.act({type:'cell',index});},tick(held={}){return this.act({type:'tick',held});},ticks(n,fn){for(let i=0;i<n&&s.status==='playing';i++){if(fn)fn(this,i);this.tick();}return s;}};}
const solvers={
'futsal-match':p=>{for(let n=0;n<2500&&p.s.status==='playing';n++){if(n%100===0)p.cmd('shoot');p.tick();}},
'street-hoops':p=>{for(let n=0;n<2100&&p.s.status==='playing';n++){if(n%100===0)p.cmd('shoot');p.tick();}},
'court-tennis':p=>{for(let n=0;n<15000&&p.s.status==='playing';n++){if(p.s.phase==='serve'&&p.s.server===0)p.cmd('hit');p.tick();}},
'beach-volley':p=>{for(let n=0;n<15000&&p.s.status==='playing';n++){if(p.s.phase==='serve'&&p.s.server===0)p.cmd('bump');p.tick();}},
'diamond-baseball':p=>{for(let n=0;n<20000&&p.s.status==='playing';n++){if(p.s.phase==='ready')p.cmd('pitch');p.tick();}},
'tenpin-bowling':p=>{for(let n=0;n<3000&&p.s.status==='playing';n++){if(p.s.phase==='aim')p.cmd('roll');p.tick();}},
'sail-regatta':p=>{let tack=1;for(let n=0;n<15000&&p.s.status==='playing';n++){const b=p.s.boat,g=p.s.buoys[p.s.next],norm=a=>Math.atan2(Math.sin(a),Math.cos(a));let desired=Math.atan2(g.y-b.y,g.x-b.x);if(Math.abs(norm(desired-p.s.wind))<.55){if(b.y<g.y-35||b.y<55)tack=1;if(b.y>g.y+35||b.y>410)tack=-1;desired=p.s.wind+tack*.8;}const ideal=Math.max(.2,Math.min(1.35,Math.abs(norm(p.s.wind-b.a))*.5));const options=[.2,.4,.6,.8,1,1.2,1.4],best=options.reduce((a,b)=>Math.abs(a-ideal)<Math.abs(b-ideal)?a:b);for(let j=0;j<8&&Math.abs(p.s.trim-best)>.05;j++)p.cmd('trim');const error=norm(desired-b.a);p.tick({right:error>.04,left:error<-.04});}},
'air-traffic-control':p=>{let current=-1;for(let n=0;n<13000&&p.s.status==='playing';n++){const plane=p.s.planes.find(q=>q.id===current);if(!plane){const next=p.s.planes[0];if(next){p.act({type:'pointer',phase:'down',x:next.x,y:next.y});while(p.s.planes.find(q=>q.id===next.id).alt!==0)p.cmd('alt');p.cmd('approach');current=next.id;}}p.tick();}},
'diamond-baseball-finish':p=>{for(let n=0;n<20000&&p.s.status==='playing';n++){if(p.s.phase==='ready'){if(p.s.half%2===0)p.cmd('type');p.cmd('pitch');}if(p.s.phase==='pitch'&&p.s.half%2===1&&p.s.runs[0]<5&&p.s.pitchClock>=p.s.pitchDuration){while(p.s.aimZone!==p.s.ballZone)p.act({type:p.s.aimZone<p.s.ballZone?'up':'down'});p.cmd('swing');}p.tick();}},
'carrom-pocket':p=>{for(let n=0;n<18000&&p.s.status==='playing';n++){if(p.s.phase==='aim'&&p.s.turn===0)p.cmd('shoot');p.tick();}},
'eight-ball':p=>{for(let n=0;n<25000&&p.s.status==='playing';n++){if(p.s.phase==='aim'&&p.s.turn===0)p.cmd('shoot');p.tick();}},
'trailer-docking':p=>{const paths=[[[230,90],[460,90],[530,245],[667,245]],[[220,350],[370,350],[370,100],[370,35]],[[260,100],[520,100],[600,210],[220,315],[78,315]]];let level=1,index=0;for(let n=0;n<18000&&p.s.status==='playing';n++){if(p.s.level!==level){level=p.s.level;index=0;}const t=p.s.tractor,r=p.s.trailer,points=paths[level-1],g=points[index],dist=Math.hypot(g[0]-t.x,g[1]-t.y),norm=a=>Math.atan2(Math.sin(a),Math.cos(a));if(index<points.length-1&&dist<40){index++;continue;}let desired=Math.atan2(g[1]-t.y,g[0]-t.x),err=norm(desired-t.a);if(index===points.length-1&&dist<20)desired=[0,-Math.PI/2,Math.PI][level-1];err=norm(desired-t.a);const targetSpeed=index===points.length-1?Math.min(36,Math.max(0,dist*1.5-4)):40;const brake=t.v>targetSpeed+3;const h={up:t.v<targetSpeed-2,right:err>.025,left:err<-.025,action:brake};p.tick(h);}},
'lunar-lander':p=>{let pwm=0;for(let n=0;n<8000&&p.s.status==='playing';n++){const b=p.s.ship,target=[470,220,560][p.s.level-1],ax=Math.max(-25,Math.min(25,(target-b.x)*.12-b.vx*.8-p.s.wind)),remaining=423-b.y,vy=Math.min(18,Math.max(7,remaining*.12)),ay=(vy-b.vy)*1.8,vertical=Math.max(0,25-ay),force=Math.hypot(ax,vertical),a=Math.max(-1.1,Math.min(1.1,Math.atan2(ax,vertical||.01)));const d=Math.round((a-b.a)/.06);for(let j=0;j<Math.abs(d);j++)p.act({type:d>0?'right':'left'});pwm+=Math.min(1,force/65);const thrust=pwm>=1;if(thrust)pwm--;p.tick({up:thrust});}},
'curling-end':p=>{for(let n=0;n<15000&&p.s.status==='playing';n++){if(p.s.phase==='aim'&&p.s.turn===0)p.cmd('throw');p.tick();}},
 'swim-meet':p=>{for(let n=0;n<15000&&p.s.status==='playing';n++){if(p.s.turnReady)p.cmd('turn');if(p.s.oxygen<40)p.cmd('breathe');if(p.s.heatTime-p.s.lastStroke>=.6)p.cmd(p.s.lastSide===0?'strokeR':'strokeL');p.tick();}},
'skate-line':p=>{for(let n=0;n<4000&&p.s.status==='playing';n++){if(!p.s.air&&p.s.stageScore<120){p.cmd('ollie');p.cmd('flip');}p.tick({right:true});}},
'pit-strategy':p=>{while(p.s.status==='playing'){if(p.s.lap===5||p.s.lap===9){const target=p.s.lap===5?2:0;while(p.s.compound!==target)p.cmd('tire');const fuel=p.s.lap===5?4:6;while(p.s.refuel!==fuel)p.cmd('fuel');p.cmd('pit');}p.cmd('attack');}},
 'twist-cube':p=>{const sequence=p.s.scramble.slice().reverse();for(const m of sequence){if(m.d<0)p.cmd('face'+m.f);else{p.cell(m.f*4);p.cmd('ccw');}}},
 'klondike-table':p=>{for(let n=0;n<1000&&p.s.status==='playing';n++){if(p.g.rules.moves(p.s).some(m=>m.to>=7))p.cmd('foundation');else p.cmd('draw');}},
'hearts-table':p=>{for(let n=0;n<200&&p.s.status==='playing';n++){if(p.s.phase==='pass'){for(let i=0;i<3;i++)p.cell(i);p.cmd('pass');}else{const legal=p.g.rules.legal(p.s,0);p.cell(p.s.hands[0].indexOf(legal[0]));}}},
'spades-partners':p=>{for(let n=0;n<200&&p.s.status==='playing';n++){if(p.s.phase==='bid')p.cmd('bid');else{const legal=p.g.rules.legal(p.s,0);p.cell(p.s.hands[0].indexOf(legal[0]));}}},
'chromatic-shedding':p=>{for(let n=0;n<500&&p.s.status==='playing';n++){const i=p.s.hands[0].findIndex(c=>p.g.rules.legal(p.s,c));if(i<0)p.cmd('draw');else p.cell(i);}},
'domino-chain':p=>{for(let n=0;n<200&&p.s.status==='playing';n++){const m=p.g.rules.legal(p.s,0)[0];if(m){p.cell(m.i);p.cmd(m.end==='left'?'leftend':'rightend');}else p.cmd(p.s.stock.length?'draw':'pass');}},
'rummy-meld':p=>{for(let n=0;n<100&&p.s.status==='playing';n++){if(p.s.phase==='decision'){p.cmd('knock');continue;}if(p.s.phase==='draw'){const h=p.s.hands[0],v=p.g.rules.deadwood(h),top=p.s.discard.at(-1),potential=[...h,top];const best=Math.min(...potential.map((_,i)=>i===potential.length-1?Infinity:p.g.rules.deadwood(potential.filter((_,j)=>i!==j))));p.cmd(best<v?'discard':'stock');}if(p.s.phase==='discard'){let best=Infinity,idx=-1;const h=p.s.hands[0];h.forEach((c,i)=>{if(p.s.drawSource==='discard'&&c===p.s.justDrawn)return;const v=p.g.rules.deadwood(h.filter((_,j)=>i!==j));if(v<best){best=v;idx=i;}});p.cell(idx);}}},
'xiangqi-river':p=>{for(let n=0;n<500&&p.s.status==='playing';n++){const legal=p.g.rules.legal(p.s,1),values={K:1000,R:90,C:45,H:40,E:20,A:20,P:10};const best=legal.slice().sort((a,b)=>(values[(p.s.board[b.to]||'').toUpperCase()]||0)-(values[(p.s.board[a.to]||'').toUpperCase()]||0))[0];if(!best)throw Error('No legal and notterminal');p.cell(best.from);p.cell(best.to);}},
'shogi-drops':p=>{for(let n=0;n<500&&p.s.status==='playing';n++){const legal=p.g.rules.legal(p.s,1),values={K:1000,R:90,B:75,G:55,S:45,N:30,L:25,P:10};const best=legal.slice().sort((a,b)=>(values[(p.s.board[b.to]||'').at(-1)?.toUpperCase()]||0)+(b.promote?12:0)-(values[(p.s.board[a.to]||'').at(-1)?.toUpperCase()]||0)-(a.promote?12:0))[0];if(!best)throw Error('No legal and notterminal');if(best.drop)p.cmd('drop'+best.drop);else{if(best.promote!==p.s.promote)p.cmd('promote');p.cell(best.from);}p.cell(best.to);}},
'marble-chain':p=>{for(let n=0;n<5000&&p.s.status==='playing';n++){if(!p.s.shots.length&&p.s.chain[0].u>.02){const color=p.s.chain[0].color;if(p.s.next!==color&&p.s.reserve===color)p.cmd('swap');const g=p.s.next===color?p.g.rules.point(p.s.chain[0].u+p.s.speed*.6):{x:720,y:400};p.act({type:'pointer',phase:'down',x:g.x,y:g.y});}p.tick();}},
'liars-dice':p=>{for(let n=0;n<300&&p.s.status==='playing';n++){const own=p.s.cups[0],total=p.s.counts.reduce((a,b)=>a+b,0),f=p.s.bid.face,estimate=own.filter(x=>x===f).length+(total-own.length)/6;if(p.s.bid.n&&p.s.bid.n>estimate+.8)p.cmd('challenge');else{const counts=[1,2,3,4,5,6].map(f=>own.filter(x=>x===f).length),face=counts.indexOf(Math.max(...counts))+1;while(p.s.face!==face)p.cmd('face');const target=Math.max(1,p.s.bid.n+(face<=p.s.bid.face?1:0));while(p.s.want<target)p.cmd('more');while(p.s.want>target)p.cmd('less');p.cmd('bid');}}},
'backgammon-race':p=>{for(let n=0;n<2000&&p.s.status==='playing';n++){const m=p.g.rules.legal(p.s,1)[0];if(!m){p.cmd('pass');continue;}if(m.from===-1)p.cmd('bar');else p.cell(m.from);if(m.to===24)p.cmd('off');else p.cell(m.to);}},
'attribute-triads':p=>{while(p.s.status==='playing'){const a=p.g.rules.sets(p.s.table)[0];for(const i of a)p.cell(i);}},
'sliding-block-escape':p=>{for(let level=1;level<=3;level++){const q=[p.s.cars],prev=new Map([[JSON.stringify(p.s.cars.map(c=>[c.x,c.y])),null]]);let goal;for(let k=0;k<q.length;k++){const a=q[k],key=JSON.stringify(a.map(c=>[c.x,c.y]));if(a[0].x===4){goal=key;break;}for(let i=0;i<a.length;i++)for(const d of [-1,1]){const s={cars:JSON.parse(JSON.stringify(a))};if(!p.g.rules.slide(s,i,d))continue;const nk=JSON.stringify(s.cars.map(c=>[c.x,c.y]));if(!prev.has(nk)){prev.set(nk,{key,i,d});q.push(s.cars);}}}if(!goal)throw Error('No garage solution');const moves=[];for(let k=goal;prev.get(k);k=prev.get(k).key)moves.unshift(prev.get(k));for(const m of moves){const c=p.s.cars[m.i];p.cell(c.y*6+c.x);p.cmd(m.d>0?'forward':'back');}p.cell(p.s.cars[0].y*6+p.s.cars[0].x);p.cmd('forward');}},
'blackbox-rays':p=>{for(let e=0;e<16;e++){const i=Array.from({length:36},(_,i)=>i).find(i=>p.g.rules.entry(i)===e);p.cell(i);}let choices=[];for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)for(let c=b+1;c<16;c++){const atoms=[a,b,c];if(Object.entries(p.s.probes).every(([e,v])=>p.g.rules.trace(atoms,+e)===v))choices.push(atoms);}const a=choices[0];for(const i of a)p.cell((Math.floor(i/4)+1)*6+i%4+1);p.cmd('submit');},
'confidence-estimator':p=>{while(p.s.status==='playing'){const n=p.s.dots.length;p.cmd('observe');while(p.s.center!==n)p.act({type:p.s.center<n?'right':'left'});while(p.s.radius>1)p.act({type:'down'});p.cmd('submit');}},
'festival-draft':p=>{while(p.s.status==='playing'){const own=p.s.tableaux[0],score=p.g.rules.score;let i=0,v=-1;for(let j=0;j<p.s.hands[0].length;j++){const c=p.s.hands[0][j],q=score([...own,c])-score(own)+(p.s.stock[c.color]>0?2:0);if(q>v){i=j;v=q;}}p.cell(i);}},
'gesture-tactics':p=>{while(p.s.status==='playing'){const m=p.s.energy[0]<2?3:(p.s.botLocked+1)%3;if(m<3&&p.s.cool[0][m])p.cmd('stance3');else p.cmd('stance'+m);}},
 'trust-lab':p=>{while(p.s.status==='playing')p.cmd('cooperate');}
};

solvers['diamond-baseball']=solvers['diamond-baseball-finish'];
solvers['street-hoops']=p=>{p.cmd('power');p.cmd('shoot');p.ticks(2100);};
const campaigns=['lunar-lander','trailer-docking','swim-meet','skate-line','sail-regatta','sliding-block-escape'];
for(const id of Object.keys(games))test(id+': full fresh match/campaign reaches a rule-derived outcome without state injection',()=>{
 const p=player(id);const fresh=JSON.stringify(p.s);assert.equal(p.s.status,'playing');solvers[id](p);assert.ok(['won','lost'].includes(p.s.status),id+' not completed: '+p.s.message);assert.ok(Number.isFinite(p.s.score));assert.notEqual(JSON.stringify(p.s),fresh);
 if(campaigns.includes(id))assert.equal(p.s.level,3,id+' includes all mandatory stages');
 if(['hearts-table','spades-partners','festival-draft'].includes(id))assert.equal(p.s.round,3,id+' completes every deal/draft round');
 if(id==='diamond-baseball')assert.equal(p.s.half,6,'all six half innings');
 if(id==='beach-volley')assert.ok(p.s.sets.some(n=>n===2),'best-of-three set completed');
 if(id==='court-tennis')assert.ok(p.s.games.some(n=>n===2),'two-game set completed');
 const ended=p.s;assert.deepEqual(p.g.step(ended,{type:'command',id:'shoot'},.05),ended);
});
for(const id of [...campaigns,'twist-cube'])test(id+': every difficulty has a fresh, successful completion through public inputs',()=>{
 for(const difficulty of ['easy','normal','hard']){const p=player(id,2026,difficulty);solvers[id](p);assert.equal(p.s.status,'won',id+' '+difficulty+': '+p.s.message);}
});
test('all garage layouts are non-overlapping and the actual three-stage public solution fits its move budget',()=>{
 const p=player('sliding-block-escape');const seen=new Set();const original=p.act.bind(p);p.act=a=>{const s=original(a);if(!seen.has(s.level)){const cells=[];for(const c of s.cars)for(let k=0;k<c.len;k++)cells.push((c.y+(c.h?0:k))*6+c.x+(c.h?k:0));assert.equal(new Set(cells).size,cells.length,'stage '+s.level+' overlaps');assert.ok(cells.every(n=>n>=0&&n<36));seen.add(s.level);}return s;};solvers['sliding-block-escape'](p);assert.equal(p.s.status,'won');assert.equal(seen.size,3);
});
test('bowling scores strikes, spares and final-frame bonuses without counting incomplete bonuses',()=>{
 const score=games['tenpin-bowling'].rules.score;assert.equal(score(Array(12).fill(10)),300);assert.equal(score(Array(21).fill(5)),150);assert.equal(score(Array(20).fill(0)),0);assert.equal(score([10,3]),0);assert.equal(score([10,3,4]),24);
});
test('Gin blocks returning the just-drawn discard and preserves the exact52-card multiset',()=>{
 const p=player('rummy-meld');p.cmd('discard');const h=p.s.hands[0].slice();p.cell(h.length-1);assert.deepEqual(p.s.hands[0],h);assert.equal(p.s.phase,'discard');assert.match(p.s.message,/Không được trả lại/);
 const all=[...p.s.hands.flat(),...p.s.stock,...p.s.discard];assert.equal(all.length,52);assert.equal(new Set(all).size,52);assert.equal(p.g.rules.deadwood([0,1,2,13,14,15,26,27,28,51]),10);
});
test('Hearts follows suit and first-trick safety; Spades honors trump and Ace high',()=>{
 const h=games['hearts-table'].rules,s={...games['hearts-table'].create(),hands:[[0,13,26,50],[],[],[]],trick:[{p:1,c:1}],trickNo:1};assert.deepEqual(h.legal(s,0),[0]);assert.equal(h.winner([{p:0,c:0},{p:1,c:12},{p:2,c:26},{p:3,c:13}],'hearts'),0);
 const sp=games['spades-partners'].rules;assert.equal(sp.winner([{p:0,c:0},{p:1,c:12},{p:2,c:39},{p:3,c:26}],'spades'),2);
});
test('Shogi rejects nifu and dead-rank pawn drops while retaining legal drops in an open file',()=>{
 const g=games['shogi-drops'],s=g.create();s.hands[0].P=1;assert.ok(!g.rules.legal(s,1).some(m=>m.drop==='P'));s.board[54]='';const drops=g.rules.legal(s,1).filter(m=>m.drop==='P');assert.ok(drops.length>0);assert.ok(drops.every(m=>m.to%9===0&&m.to>=9));
});
test('Xiangqi legal moves never expose the own general and cannot capture the opposing general directly',()=>{
 const g=games['xiangqi-river'],s=g.create();const moves=g.rules.legal(s,1);assert.ok(moves.length>10);for(const m of moves){const b=s.board.slice();b[m.to]=b[m.from];b[m.from]='';assert.equal(g.rules.check(b,1),false);assert.notEqual(s.board[m.to],'k');}
});
test('8-ball early black is a real loss; Carrom queen is awarded only with a cover',()=>{
 const pool=games['eight-ball'],s=pool.create();s.pots=[8];s.first=8;s.groups=[0,1];s.balls.find(b=>b.id===8).sunk=true;pool.rules.resolve(s);assert.equal(s.status,'lost');
 const carrom=games['carrom-pocket'],c=carrom.create();c.coins.find(q=>q.kind===2).sunk=true;carrom.rules.resolve(c);assert.equal(c.queen,-1);assert.equal(c.queenPending,0);
 const covered=carrom.create();covered.coins.find(q=>q.kind===2).sunk=true;covered.coins.find(q=>q.kind===0).sunk=true;carrom.rules.resolve(covered);assert.equal(covered.queen,0);assert.equal(covered.queenPending,-1);
});
test('pool and Carrom collision integration remains finite and fuel cannot increase during a lander burn',()=>{
 const p=player('lunar-lander'),before=p.s.fuel;p.tick({up:true});assert.ok(p.s.fuel<before);const s=p.g.create();assert.deepEqual(p.g.step(s,{type:'tick',held:{up:true}},10),p.g.step(s,{type:'tick',held:{up:true}},.05));
 for(const id of ['eight-ball','carrom-pocket']){const q=player(id);q.cmd('shoot');for(let i=0;i<300;i++)q.tick();const finite=v=>{if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(finite);};finite(q.s);}
});
test('sailing polar has a real no-go zone and asymmetric trim cost; interval confidence penalizes misses',()=>{
 const speed=games['sail-regatta'].rules.speed;assert.equal(speed(0,0,.4),0);assert.ok(speed(Math.PI/2,0,.8)>speed(Math.PI/2,0,.2));const score=games['confidence-estimator'].rules.score;assert.equal(score(40,60,50,.8),20);assert.ok(score(40,60,70,.95)>score(40,60,70,.8));
});
