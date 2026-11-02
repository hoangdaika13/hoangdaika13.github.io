'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const X=require('../hh-multiverse-explorer'),E=require('../hh-multiverse-engine'),M=require('../hh-multiverse-model');
const create=()=>E.create('Nếu ký ức có thể được trao đổi?',{complexity:'rich'},{id:'explorer-world'});

test('explorer searches Vietnamese without accents and filters real entity types',()=>{
  const world=create(),person=world.blueprint.characters[0];
  assert.ok(X.entities(world,{query:'ben sao',kind:'location'}).some(row=>row.id==='loc-0'));
  const found=X.entities(world,{query:M.fold(person.name),kind:'character'});assert.equal(found.length,1);assert.equal(found[0].id,person.id);
  assert.ok(X.entities(world,{kind:'event'}).every(row=>row.kind==='event'));
  assert.deepEqual(X.entities(world,{query:'not-present-in-world-anywhere'}),[]);
});
test('explorer never leaks future or sibling branch event text or historical metrics',()=>{
  let world=E.advance(create(),3650);world.events.at(-1).title='FUTURE_SECRET_EVENT';const futureId=world.current.snapshotId;
  const before=E.select(world,'main','s0');const past=X.history(before);assert.equal(past.length,1);assert.equal(past[0].day,0);assert.ok(!X.entities(before).some(row=>row.title.includes('FUTURE_SECRET_EVENT')));
  const sibling=E.advance(E.fork(before,'Alternate'),30);assert.ok(!X.history(sibling).some(s=>s.snapshotId===futureId));
  const html=X.render({world:sibling,explorer:{}});assert.doesNotMatch(html,/FUTURE_SECRET_EVENT/);assert.ok(!X.entities(sibling).some(row=>row.title==='FUTURE_SECRET_EVENT'));
});
test('location details agree with current destruction, recovery and related events',()=>{
  const original=create(),destroyed=E.apply(original,E.preview(original,'Phá hủy khu vực','conflict'));
  const detail=X.location(destroyed,'loc-0');assert.equal(detail.status,'destroyed');assert.ok(detail.relatedEvents.some(e=>e.kind==='decision'));assert.ok(detail.products.every(p=>p.available===false));assert.ok(detail.characters.length);
  const recovered=E.apply(destroyed,E.preview(destroyed,'Phục hồi khu vực','recovery'));assert.equal(X.location(recovered,'loc-0').status,'active');assert.equal(X.location(original,'loc-0').status,'active');assert.equal(X.location(original,'unknown'),null);
});
test('trend comparisons use exact ancestor endpoints including fork snapshots',()=>{
  const original=create(),world=E.advance(E.fork(E.advance(original,365),'Research branch'),30),data=X.trend(world);
  assert.equal(data.points.length,E.lineage(world,world.current.snapshotId).length);assert.equal(data.first.snapshotId,'s0');assert.equal(data.last.snapshotId,world.current.snapshotId);
  for(const row of data.comparisons){assert.equal(row.first,original.snapshots[0].metrics[row.key]);assert.equal(row.current,E.snapshot(world).metrics[row.key]);assert.equal(row.delta,Math.round((row.current-row.first)*100)/100);}
  const past=E.select(world,world.current.branchId,'s0');assert.ok(X.trend(past).comparisons.every(row=>row.delta===0));
});
test('map state clamps zoom, clears invalid filters and does not mutate world data',()=>{
  const world=create(),before=M.serialize(world);assert.equal(X.state({zoom:99},world).zoom,3);assert.equal(X.state({zoom:-5},world).zoom,1);assert.equal(X.state({zoom:'NaN'},world).zoom,1);assert.equal(X.state({locationId:'missing'},world).locationId,'loc-0');assert.equal(X.state({kind:'__proto__'},world).kind,'all');
  assert.ok(X.render({world,explorer:{zoom:2,locationId:'loc-1'}}).includes('width:200%'));assert.equal(M.serialize(world),before);
});
test('render escapes imported names and includes accessible controls with only internal actions',()=>{
  const world=create();world.blueprint.locations[0].name='<img src=x onerror=alert(1)>';world.blueprint.characters[0].name='<script>bad()</script>';
  const html=X.render({world,readOnly:true,explorer:{query:'<input autofocus>',zoom:1}});assert.doesNotMatch(html,/<img src=x|<script>bad|value="<input/);assert.match(html,/&lt;img/);assert.match(html,/data-mv-action="explorer-zoom"/);assert.match(html,/data-mv-form="explorer-search"/);assert.match(html,/role="region"/);assert.match(html,/<caption>/);assert.doesNotMatch(html,/data-mv-action="(?:buy|advance|apply-decision)"/);
});
test('render derives selected snapshot instead of trusting a stale context projection',()=>{
  const initial=create(),future=E.apply(initial,E.preview(initial,'Phá hủy khu vực','conflict'));
  const before=E.select(future,'main','s0');
  const html=X.render({world:before,projection:{year:99999,locations:[{name:'STALE_FUTURE_LOCATION'}]},explorer:{locationId:'loc-0'}});
  assert.doesNotMatch(html,/STALE_FUTURE_LOCATION|99999|data-status="destroyed"/);
  assert.match(html,/data-status="active"/);
});
