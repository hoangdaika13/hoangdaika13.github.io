'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),A=require('../hh-multiverse-art'),E=require('../hh-multiverse-engine');
const root=path.resolve(__dirname,'..');
test('all18 original artworks have local responsive WebP files matching the published prompt manifest',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/multiverse/artwork-manifest-v1.json'),'utf8'));
  assert.equal(A.catalog.length,18);assert.equal(A.list('world').length,8);assert.equal(A.list('experience').length,4);assert.equal(A.list('portrait').length,6);
  assert.deepEqual(new Set(A.catalog.map(a=>a.id)),new Set(manifest.items.map(a=>a.id)));
  let files=0,total=0;
  for(const asset of A.catalog){const row=manifest.items.find(x=>x.id===asset.id);assert.equal(row.generation,'built-in image_gen');assert.ok(row.prompt.length>200);assert.match(row.sourceSha256,/^[a-f0-9]{64}$/);assert.ok(asset.description.length>20);
    for(const width of asset.widths){const variant=row.variants.find(v=>v.width===width);assert.ok(variant);const relative=A.url(asset.id,width),file=path.resolve(root,relative);assert.ok(file.startsWith(path.join(root,'assets','multiverse')+path.sep));const data=fs.readFileSync(file);assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');assert.equal(data.length,variant.bytes);assert.ok(data.length<500000);assert.ok(variant.height>0);files++;total+=data.length;}
  }
  assert.equal(files,55);assert.ok(total<6500000);assert.doesNotMatch(JSON.stringify(manifest),/C:\\Users|OPENAI_API_KEY|data:image/);
});
test('world art follows the premise and remains stable across timeline and branches without changing data',()=>{
  for(const sample of E.SAMPLES){const world=E.create(sample[1]),before=JSON.stringify(world),art=A.forWorld(world);assert.equal(art.id,sample[0]);assert.equal(A.forWorld(E.advance(world,3650)).id,art.id);assert.equal(A.forWorld(E.fork(world,'Alternate')).id,art.id);assert.equal(JSON.stringify(world),before);}
  assert.equal(A.forWorld({premise:'An unfamiliar new premise'}).id,'hero');
});
test('asset URLs cannot be supplied by imported worlds, arbitrary paths or external services',()=>{
  for(const id of ['__proto__','constructor','../../config','https://evil.example/image','data:image/png'])assert.throws(()=>A.url(id,640));
  assert.throws(()=>A.url('hero',100000));assert.equal(A.find('__proto__'),null);assert.equal(A.forWorld({premise:'Two moons',image:'https://evil.example'}).id,'moons');
});
test('portrait assignment is deterministic, distinct for the six default citizens, and independent of future events',()=>{const w=E.create(E.SAMPLES[2][1],{complexity:'rich'}),future=E.advance(w,36500),ids=w.blueprint.characters.map(c=>A.forCharacter(w,c.id).id);assert.equal(new Set(ids).size,6);assert.deepEqual(future.blueprint.characters.map(c=>A.forCharacter(future,c.id).id),ids);});
test('visual preferences partition accounts, normalize defaults and protect corrupt/future versions',()=>{assert.notEqual(A.preferenceKey({id:'a'}),A.preferenceKey({id:'b'}));assert.match(A.preferenceKey({id:'a'}),/^hh\.multiverse\.visual\.v1:/);for(const palette of A.palettes){const prefs={version:1,palette:palette.id,compact:true};assert.deepEqual(A.preferences(JSON.parse(JSON.stringify(prefs))),prefs);}for(const raw of [{version:2,palette:'prism',compact:false},{version:1,palette:'javascript:bad',compact:false},{version:1,palette:'aurora',compact:'false'},[],'invalid'])assert.throws(()=>A.preferences(raw));assert.equal(A.preferences().palette,'prism');});
