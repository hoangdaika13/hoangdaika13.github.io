const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../all-game.js'),read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
test('All Game has59 distinct original playable destinations including50 extra engines',()=>{
  assert.equal(api.CATALOG.length,59);assert.equal(new Set(api.CATALOG.map(g=>g.id)).size,59);assert.equal(require('../all-game-catalog.js').length,50);
  const bundles={arcade:require('../all-game-arcade.js'),puzzles:require('../all-game-puzzles.js'),adventure:require('../all-game-adventure.js'),'pack-puzzles':require('../all-game-pack-puzzles.js'),'pack-arcade':require('../all-game-pack-arcade.js'),'pack-casual':require('../all-game-pack-casual.js')};
  for(const g of api.CATALOG){assert.ok(g.description.length>30&&g.controls.length>30);assert.equal(g.route,'/all-game/'+g.id);const engine=bundles[g.bundle].games[g.id],state=engine.create({seed:2026,difficulty:'normal'});assert.equal(state.id,g.id);assert.equal(state.status,'playing');assert.equal(typeof engine.describe(state).summary,'string');}
});
test('Library search supports Vietnamese, categories, favorites and truthful empty results',()=>{
  assert.ok(api.filter('RẮN').some(g=>g.id==='snake'));assert.ok(api.filter('ghép số').some(g=>g.id==='merge'));
  assert.ok(api.filter('','Trí tuệ').every(g=>g.category==='Trí tuệ'));assert.deepEqual(api.filter('','all',true,['memory']).map(g=>g.id),['memory']);assert.deepEqual(api.filter('not-a-game'),[]);
});
test('Local data normalizer rejects foreign IDs and bounds all imported statistics',()=>{
  const result=api.normalizeData({favorites:['snake','snake','unknown'],recents:['bogus','merge','merge'],bests:{snake:{score:-20,plays:Infinity,wins:'evil'},constructor:{score:42}},difficulty:'impossible',motion:false});
  assert.deepEqual(result.favorites,['snake']);assert.deepEqual(result.recents,['merge']);assert.equal(result.bests.snake.score,0);assert.equal(result.bests.snake.plays,1e9);assert.equal(result.bests.snake.wins,0);assert.equal(Object.getPrototypeOf(result.bests),null);assert.equal(result.difficulty,'normal');assert.equal(result.motion,false);
});
test('Favorites/records persist and reload per account without reading legacy or another account',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const data=api.normalizeData({favorites:['snake'],bests:{snake:{score:250,plays:2,wins:1}}});
  assert.equal(api.save(storage,'alice',data).ok,true);assert.equal(api.read(storage,'alice').bests.snake.score,250);assert.deepEqual(api.read(storage,'bob').favorites,[]);assert.deepEqual(api.read(storage,'guest').favorites,[]);assert.ok(api.keyFor('alice').startsWith('hh.'));assert.equal(values.has(api.KEY),false);
});
test('Storage failures, malformed data and unknown versions never claim a save',()=>{
  assert.equal(api.save(null,'alice',{}).ok,false);assert.equal(api.save({setItem(){throw Error('quota')}},'alice',{}).ok,false);
  assert.deepEqual(api.read({getItem:()=>'{invalid'},'alice').favorites,[]);assert.deepEqual(api.read({getItem:()=>JSON.stringify({version:99,favorites:['snake']})},'alice').favorites,[]);
});
test('All Game is a separate Entertainment route, searchable registry and lifecycle mount',()=>{
  const router=read('script.js'),section=router.match(/id:\s*"entertainment",[\s\S]*?groupIds:\s*\[([^\]]+)\]/)?.[1];
  for(const id of ['all-game','play-center','eonwild-game','patin'])assert.ok(section.includes('"'+id+'"'));
  assert.match(router,/id: "all-game", label: "All Game"/);assert.match(router,/window\.HHAllGame\?\.mount/);assert.match(router,/window\.HHAllGame\?\.unmount/);
  assert.match(router,/gameId, currentUser: readCurrentAuthUser\(\)/);assert.match(router,/"all-game": "all game arcade/);
  const loader=read('performance-loader.js');assert.match(loader,/"all-game": \{ styles: \["all-game\.css\?v=2"\], scripts: \["all-game-scenes\.js\?v=2", "all-game\.js\?v=2"\]/);assert.match(loader,/value === "\/all-game" \|\| value.startsWith\("\/all-game\/"\)/);
  for(const file of ['all-game.css','all-game.js','all-game-puzzles.js','all-game-arcade.js','all-game-adventure.js'])assert.match(read('sw.js'),new RegExp(file.replaceAll('.','\\.')+'\\?v=2'));
});
test('Host has one explicit frame owner and keyboard/mobile/visibility cleanup without global scroll locks',()=>{
  const source=read('all-game.js'),css=read('all-game.css');
  for(const token of ['requestAnimationFrame(tick)','cancelAnimationFrame(raf)','visibilitychange',"listen(scope,'blur',pause)",'session?.difficulty','data-ag-control','data-ag-undo','data-ag-retry','disabled','description||c.label'])assert.ok(source.includes(token),token);
  assert.doesNotMatch(source,/AudioContext|navigator\.mediaDevices|fetch\(|XMLHttpRequest|document\.body\.style/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/forced-colors/);assert.match(css,/:focus-visible/);assert.match(css,/@media\(max-width:640px\)/);
});
