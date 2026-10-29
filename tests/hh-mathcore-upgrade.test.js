'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../hh-mathcore-core'),E=require('../hh-mathcore-engine'),P=require('../hh-mathcore-practice');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),a+' != '+b);
const member=(x,rows)=>rows.some(row=>(x>row.lo||row.lc&&x===row.lo)&&(x<row.hi||row.hc&&x===row.hi));
test('two-variable parser is opt-in and cannot expose names or executable syntax',()=>{
 assert.throws(()=>C.parse('x+y'));close(C.evaluate(C.parse('2x+y',{variables:['x','y']}),{x:2,y:3}),7);for(const text of ['z+1','window.x','y[0]','x; process.exit()'])assert.throws(()=>C.parse(text,{variables:['x','y']}));
});
test('linear systems find unique solutions and distinguish inconsistent/infinite/constant rows',()=>{
 const r=E.solve('2x+y=7\nx-y=2');close(r.solution.x,3);close(r.solution.y,1);assert.equal(r.kind,'system');assert.ok(r.hints.length>=3&&r.steps.length>=4);
 for(const text of ['x+y=2;2x+2y=4','0=0;0=0','x=2;2x=4'])assert.equal(E.solve(text,{kind:'system'}).classification,'infinite');
 for(const text of ['x+y=2;2x+2y=5','0=1;0=0','x=2;x=3'])assert.equal(E.solve(text,{kind:'system'}).classification,'none');
 for(const text of ['x*y=1;x+y=2','x^2+y=1;x-y=0','x/y=2;x+y=3','x+y=1','x+y=1;x-y=0;x=1'])assert.throws(()=>E.solve(text,{kind:'system'}));
});
test('systems independently satisfy hundreds of generated original equations',()=>{
 for(let x=-5;x<=5;x++)for(let y=-5;y<=5;y++){const result=E.solve('3x+2y='+(3*x+2*y)+';x-4y='+(x-4*y));close(result.solution.x,x);close(result.solution.y,y);}
 assert.throws(()=>E.solve('x+y=1;x+1.0000000000001y=2'),/gần suy biến/);
});
test('inequality sets agree with direct evaluation across signs, strictness and double roots',()=>{
 const ops=['<','<=','>','>='];for(const a of [-2,-1,0,1,2])for(const b of [-3,0,2])for(const c of [-4,0,3])for(const op of ops){const text=a+'x^2+('+b+')x+('+c+')'+op+'0',result=E.solve(text,{kind:'inequality'});for(let x=-6;x<=6;x+=.25){const value=a*x*x+b*x+c,expected=op==='<'?value<0:op==='<='?value<=0:op==='>'?value>0:value>=0;assert.equal(member(x,result.intervals),expected,text+' at '+x);}}
 assert.equal(E.solve('x^2-5x+6<=0').answer,'S = [2; 3]');assert.equal(E.solve('-2x<4').answer,'S = (-2; +∞)');assert.equal(E.solve('x^2<=0').answer,'S = {0}');assert.equal(E.solve('x^2>=0').answer,'S = ℝ');
});
test('inequality line checking catches failure to flip direction without guessing interval text',()=>{
 const rows=E.checkWork('-2x<4','x>-2\nx<-2\nS = (-2;+∞)');assert.deepEqual(rows.map(row=>row.status),['equivalent','review','unread']);
});
test('polynomial derivatives are symbolic and agree with independent numeric checks',()=>{
 const r=E.solve('3x^4-2x^2+5x-1',{kind:'derivative'});assert.equal(r.answer,"f′(x) = 12x^3 − 4x + 5");const coefficients=E.coefficients(C.parse(r.answer.split(' = ')[1]));for(const x of [-2,-1,.5,2])close(E.at(coefficients,x),12*x**3-4*x+5);
 assert.equal(E.solve('đạo hàm 4x^3').answer,"f′(x) = 12x^2");assert.equal(E.solve('0',{kind:'derivative'}).answer,"f′(x) = 0");
 for(const text of ['sin(x)','x^7','1/x','x^0','0^0'])assert.throws(()=>E.solve(text,{kind:'derivative'}));
 assert.throws(()=>E.solve('1e-14*x',{kind:'derivative'}),/quá nhỏ/);assert.match(E.solve('pi*x^2',{kind:'derivative'}).answer,/≈/);
});
test('polynomial integrals respect sign, reversed/equal bounds and bounded inputs',()=>{
 assert.equal(E.solve('3x^2+2x+1',{kind:'integral',lower:0,upper:2}).answer,'I = 14');assert.equal(E.solve('3x^2+2x+1',{kind:'integral',lower:2,upper:0}).answer,'I = -14');assert.equal(E.solve('x^6',{kind:'integral',lower:2,upper:2}).answer,'I = 0');assert.throws(()=>E.solve('x',{kind:'integral',lower:101}));assert.throws(()=>E.solve('x',{kind:'integral',upper:NaN}));
 assert.match(E.solve('x^2',{kind:'integral'}).steps[0].formula,/1\/3/);assert.throws(()=>E.solve('x',{kind:'integral',lower:''}));
});
function expected(q){const {a,b,c,d}=q.facts,L=['basic','standard','advanced'].indexOf(q.difficulty);switch(q.topic){
 case 'linear':return L===1?b+c:c;
 case 'systems':return [a,b,a+b][L];
 case 'inequality':return [b,b+c+1,Array.from({length:30},(_,i)=>i-10).filter(x=>(x-a)*(x-a-c)<=0).length][L];
 case 'quadratic':{const roots=[a,a+b+c];return L===0?roots.reduce((a,b)=>a+b):L===1?Math.max(...roots):roots.reduce((n,x)=>n+x*x,0);}
 case 'fractions':return L===1?a/b-c/d:(a/b+c/d)/(L===2?2:1);
 case 'powers':return [a*a-b*b,(a+b)**2,(a+b)**2-(a-b)**2][L];
 case 'logarithm':return [Math.log2(2**a),b+2**a,2**a][L];
 case 'sequences':{const rows=Array.from({length:10},(_,i)=>a+i*b);return L===0?rows[c-1]:L===1?rows.slice(0,c).reduce((n,x)=>n+x,0):rows[9];}
 case 'trigonometry':return [Math.hypot(3*a,4*a),3*a/(5*a),Math.sin(2*Math.asin(3/5))][L];
 case 'derivative':{const f=x=>L===0?a*x*x:L===1?a*x**3+b*x:a*(x+b)**3,dx=1e-4;return (f(c+dx)-f(c-dx))/(2*dx);}
 case 'integral':{const f=x=>L===2?3*a*x*x+2*x:2*a*x+b,lo=L===2?b:0,hi=L===0?1:L===1?c:b+c;return (hi-lo)/6*(f(lo)+4*f((lo+hi)/2)+f(hi));}
 case 'geometry':return L===2?Math.PI*a*a*b:a*b*c;
 case 'probability':{const n=a+b;let hit=0,total=0;if(L===0)return a/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(L===1&&i===j)continue;total++;if(L===1?i<a&&j<a:i<a||j<a)hit++;}return hit/total;}
 case 'statistics':{const rows=L===0?[a,a+b,a+2*b]:L===1?[a+3*b+3*c,a,a+2*b+2*c,a+b,a+b+c]:[a-b,a,a+b],mean=rows.reduce((n,x)=>n+x,0)/rows.length;return L===0?mean:L===1?rows.sort((a,b)=>a-b)[2]:rows.reduce((n,x)=>n+(x-mean)**2,0)/rows.length;}
 default:throw Error('Missing independent reference');}}
test('all42practice variants have distinct skills and independently correct answers',()=>{
 assert.notEqual(P.generate('linear','basic',1,42)[0].id,P.generate('systems','advanced',1,42)[0].id);
 assert.equal(P.topics.length,14);for(const topic of P.topics){const skills=new Set();for(const level of Object.keys(P.levels)){for(let seed=1;seed<=35;seed++){const questions=P.generate(topic,level,5,seed);for(const q of questions){skills.add(q.skill);close(C.calculator(q.options[q.correct]),expected(q));assert.equal(q.variant,topic+'-'+level);assert.equal(new Set(q.options).size,4);}}}assert.equal(skills.size,3,topic);}
});
test('legacy notes/answers migrate additively and rich saved lessons retain their steps',()=>{
 const legacy={version:1,topic:'linear',notes:'keep',saved:[{problem:'2x=8',answer:'x=4',provider:'local',at:'2026-10-29'}],attempts:[]},p=C.preferences(legacy);assert.equal(p.notes,'keep');assert.equal(p.quiz,null);assert.deepEqual(p.mistakes,[]);assert.ok(p.saved[0].id.startsWith('legacy-'));
 assert.equal(C.VERSION,3);assert.equal(p.version,3);assert.equal(C.preferenceKey(null),'hh.mathcore.v1:guest');assert.throws(()=>C.preferences({...legacy,version:4}));
 const lesson={...E.solve('2x+y=7;x-y=2'),rawProblem:'2x+y=7;x-y=2',id:'example'},saved=C.preferences({...C.defaults(),saved:[lesson]}).saved[0];assert.equal(saved.steps.length,lesson.steps.length);assert.equal(saved.rawProblem,lesson.rawProblem);assert.equal(saved.kind,'system');
});
test('quiz state resumes exactly and protects malformed/future nested versions',()=>{
 const questions=P.generate('systems','advanced',5,42),raw={...C.defaults(),quiz:{version:1,id:'session',questions,answers:{[questions[0].id]:2},index:2,submitted:false}};const p=C.preferences(raw);assert.equal(p.quiz.index,2);assert.equal(p.quiz.answers[questions[0].id],2);assert.equal(p.quiz.questions[0].text,questions[0].text);for(const quiz of [{...raw.quiz,version:2},{...raw.quiz,submitted:true},{...raw.quiz,questions:[{id:'x'}]}])assert.throws(()=>C.preferences({...raw,quiz}));
});
test('mistake archive retains selected answers and resolved state within bounds',()=>{
 const q=P.generate('probability','advanced',1,100)[0],p=C.preferences({...C.defaults(),mistakes:[{...q,selected:1,resolved:true,at:'2026-10-29'}]});assert.equal(p.mistakes[0].selected,1);assert.equal(p.mistakes[0].resolved,true);assert.equal(p.mistakes[0].explanation,q.explanation);
});
test('crop rectangles map percentages to native pixels without escaping the image',()=>{
 const image=require('../hh-mathcore-image');assert.deepEqual(image.cropPixels(1000,500,{x:5,y:10,w:75,h:70}),{x:50,y:50,w:750,h:350});assert.deepEqual(image.cropPixels(1600,900,{x:0,y:0,w:100,h:100}),{x:0,y:0,w:1600,h:900});for(const rect of [{x:-1,y:0,w:50,h:50},{x:50,y:0,w:60,h:20},{x:0,y:0,w:1,h:1},{x:NaN,y:0,w:30,h:30}])assert.throws(()=>image.cropPixels(1000,500,rect));
});
