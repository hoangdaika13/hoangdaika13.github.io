'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const games=require('../all-game-exp-cards.js').games;
const command=id=>({type:'command',id}),cell=index=>({type:'cell',index});

// Rule references checked directly: bicyclecards.com/how-to-play/klondike
// and bicyclecards.com/how-to-play/hearts. Existing saved openings retain their rule.
// Focused rule fixtures, separate from the fresh-state campaign walkthroughs.
function solitaire(columns,hidden=Array(7).fill(0)){
  const s=games['klondike-table'].create({seed:1});
  s.cols=columns.concat(Array.from({length:7-columns.length},()=>[]));
  s.hidden=hidden;s.foundation=[0,0,0,0];s.stock=[];s.waste=[];s.history=[];
  return s;
}

for(const [name,run]of [['same-color',[8,7]],['rank gap',[8,19]]])test('Klondike rejects an internally invalid '+name+' suffix through public input',()=>{
  const e=games['klondike-table'];let s=solitaire([run,[22]]);
  assert.ok(!e.rules.moves(s).some(m=>m.from===0&&m.to===1&&m.count===2));
  s=e.step(s,cell(0));s=e.step(s,command('depth'));
  const before=JSON.stringify(s.cols),next=e.step(s,cell(1));
  assert.equal(JSON.stringify(next.cols),before);
  assert.equal(next.moves,0);assert.equal(next.history.length,0);
});

test('Klondike transfers a valid descending alternating suffix and undo restores it',()=>{
  const e=games['klondike-table'];let s=solitaire([[8,20],[22]]);
  assert.ok(e.rules.moves(s).some(m=>m.from===0&&m.to===1&&m.count===2));
  s=e.step(s,cell(0));s=e.step(s,command('depth'));
  const before=JSON.stringify(s.cols),moved=e.step(s,cell(1));
  assert.deepEqual(moved.cols.slice(0,2),[[],[22,8,20]]);
  assert.equal(moved.moves,1);assert.equal(JSON.stringify(s.cols),before);
  const restored=e.step(moved,command('undo'));
  assert.equal(JSON.stringify(restored.cols),before);assert.equal(restored.moves,0);
});

test('Klondike never moves a hidden prefix and still permits an exposed top card',()=>{
  const e=games['klondike-table'],s=solitaire([[8,20],[22],[8]],[1,0,0,0,0,0,0]);
  assert.ok(!e.rules.moves(s).some(m=>m.from===0&&m.count===2));
  assert.ok(e.rules.moves(s).some(m=>m.from===0&&m.to===2&&m.count===1));
});

test('new Hearts hands lead 2 clubs after passing throughout three complete deals',()=>{
  const e=games['hearts-table'];
  for(const seed of [1,4,19,47]){
    let s=e.create({seed}),passed=0;
    for(let steps=0;s.status==='playing'&&steps<250;steps++){
      if(s.phase==='pass'){
        assert.equal(s.openingClub,1);
        for(let i=0;i<3;i++)s=e.step(s,cell(i));
        s=e.step(s,command('pass'));passed++;
        assert.equal(s.turn,0);
        if(s.trickNo===0){
          if(s.trick.length)assert.equal(s.trick[0].c,1);
          else assert.deepEqual(e.rules.legal(s,0),[1]);
        }else{assert.equal(s.trickNo,1);assert.equal(s.last[0].c,1);}
      }else{
        const legal=e.rules.legal(s,0);assert.ok(legal.length);
        s=e.step(s,cell(s.hands[0].indexOf(legal[0])));
      }
      assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
    }
    assert.equal(passed,3);assert.equal(s.round,3);assert.notEqual(s.status,'playing');
  }
});

test('a previously saved Hearts opening retains its legacy lead convention',()=>{
  const e=games['hearts-table'],s=e.create({seed:4});
  delete s.openingClub;s.phase='play';s.trick=[];s.trickNo=0;
  s.turn=0;s.hands[0]=[0,1,13,26];
  assert.deepEqual(e.rules.legal(s,0),[0]);
  const restored=JSON.parse(JSON.stringify(s)),next=e.step(restored,cell(0));
  assert.equal((next.trick[0]||next.last[0]).c,0);
});

test('Trust Lab grim campaign remembers a public defection within its own scenario history',()=>{
  const runtime=require('../all-game-campaign-studio-runtime.js');
  const base=require('../all-game-exp-social.js').games['trust-lab'];
  const spec=runtime.makeSpec('trust-lab','exp-social'),mission=spec.missions[14];
  const engine=spec.createEngine(base,mission,{}),initial=engine.create({difficulty:'normal'});
  assert.equal(initial.chapter,2);assert.equal(initial.botLocked,true);
  const betrayed=engine.step(initial,command('defect'));
  assert.equal(betrayed.history[0].bot,true,'the first bot decision was locked before player input');
  assert.equal(betrayed.botLocked,false,'grim retaliates on the next turn');
  const attemptedRepair=engine.step(betrayed,command('cooperate'));
  assert.equal(attemptedRepair.history[1].bot,false);
  assert.equal(attemptedRepair.botLocked,false,'grim continues to remember the earlier defection');
  assert.equal(initial.history.length,0,'source state remains immutable');
  const restored=JSON.parse(JSON.stringify(attemptedRepair));
  assert.equal(engine.step(restored,command('cooperate')).history[2].bot,false);
});

test('Trust Lab Quick Play starts grim memory at its own chapter boundary',()=>{
  const e=require('../all-game-exp-social.js').games['trust-lab'];
  let s=e.create({difficulty:'easy',seed:1});
  s=e.step(s,command('defect'));
  for(let i=1;i<10;i++)s=e.step(s,command('cooperate'));
  assert.equal(s.chapter,2);assert.equal(s.botLocked,true,'a defection before this chapter does not change the native convention');
  s=e.step(s,command('defect'));assert.equal(s.botLocked,false);
  s=e.step(s,command('cooperate'));assert.equal(s.history[11].bot,false);
});

test('canceling a rune gesture ends the drag without adding a stroke or casting',()=>{
  const e=require('../all-game-exp-action.js').games['rune-gesture'];
  let s=e.create({seed:1});
  s=e.step(s,{type:'pointer',phase:'down',x:100,y:100});
  s=e.step(s,{type:'pointer',phase:'move',x:140,y:150});
  assert.equal(s.drawing,true);
  const points=JSON.stringify(s.points),before=JSON.stringify(s);
  const canceled=e.step(s,{type:'pointer',phase:'cancel',x:160,y:180});
  assert.equal(canceled.drawing,false);assert.equal(JSON.stringify(canceled.points),points);
  assert.equal(canceled.score,0);assert.equal(JSON.stringify(s),before);
  const moved=e.step(canceled,{type:'pointer',phase:'move',x:200,y:220});
  assert.equal(JSON.stringify(moved.points),points,'move after cancel must not keep drawing');
  assert.deepEqual(JSON.parse(JSON.stringify(canceled)),canceled);
});
