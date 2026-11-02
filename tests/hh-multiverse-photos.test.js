'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const P=require('../hh-multiverse-photos'),A=require('../hh-multiverse-art'),G=require('../hh-multiverse-gallery'),E=require('../hh-multiverse-engine'),M=require('../hh-multiverse-model'),I=require('../hh-multiverse-internet');
const ROOT=path.resolve(__dirname,'..'),hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
test('50 distinct reference photographs retain verified NASA sources, authors, use policy and separate nature/cosmos groups',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/multiverse/photos-manifest-v1.json'),'utf8'));
  assert.equal(P.catalog.length,50);assert.equal(P.THEMES.length,10);assert.equal(manifest.count,50);assert.equal(manifest.items.length,50);
  assert.equal(new Set(manifest.items.map(item=>item.nasaId)).size,50);assert.equal(new Set(manifest.items.map(item=>item.sourceSha256)).size,50);
  assert.equal(P.catalog.filter(item=>item.photoGroup==='nature').length,35);assert.equal(P.catalog.filter(item=>item.photoGroup==='cosmos').length,15);
  for(const item of P.catalog){
    assert.ok(Object.isFrozen(item));assert.equal(item.kind,'photo');assert.deepEqual(item.widths,[320,640,1280]);assert.match(item.caption,/Ảnh thực tế tham khảo/);
    assert.ok(item.author.length>3);assert.equal(item.license,'NASA Media Usage Guidelines');assert.equal(new URL(item.sourceURL).hostname,'images.nasa.gov');
    assert.equal(new URL(item.sourceImageURL).hostname,'images-assets.nasa.gov');assert.equal(item.licenseURL,'https://www.nasa.gov/nasa-brand-center/images-and-media/');
    assert.ok(!/ESA|Getty|Reuters/.test(item.author));assert.equal(P.find(item.id),item);assert.equal(A.find(item.id),item);
  }
  assert.doesNotMatch(JSON.stringify(manifest),/C:\\Users|\.study-local|OPENAI_API_KEY|data:image/);
});
test('150 local WebP photographs match provenance hashes, exact decoded dimensions and a bounded package without upscaling',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/multiverse/photos-manifest-v1.json'),'utf8'));let bytes=0,files=0;
  for(const item of manifest.items){
    assert.ok(item.sourceDimensions.width>=1280&&item.sourceDimensions.height>=720);assert.match(item.transform,/no generative editing/);assert.equal(item.variants.length,3);
    for(const variant of item.variants){
      const relative=P.url(item.id,variant.width);assert.equal(A.url(item.id,variant.width),relative);
      const file=path.resolve(ROOT,relative);assert.ok(file.startsWith(path.join(ROOT,'assets/multiverse/photos')+path.sep));
      const content=fs.readFileSync(file);assert.equal(content.toString('ascii',0,4),'RIFF');assert.equal(content.toString('ascii',8,12),'WEBP');assert.equal(content.length,variant.bytes);assert.equal(hash(content),variant.sha256);
      let frame=null;for(let offset=12;offset+8<=content.length;){const size=content.readUInt32LE(offset+4);assert.ok(offset+8+size<=content.length);if(content.toString('ascii',offset,offset+4)==='VP8 ')frame=content.subarray(offset+8,offset+8+size);offset+=8+size+size%2;}
      assert.ok(frame);assert.equal(frame.readUInt16LE(6)&0x3fff,variant.width);assert.equal(frame.readUInt16LE(8)&0x3fff,variant.height);assert.equal(variant.height,variant.width*9/16);bytes+=content.length;files++;
    }
  }
  assert.equal(files,150);assert.equal(bytes,manifest.totalBytes);assert.ok(bytes<14*1024*1024);
});
test('photo lookup never converts arbitrary source IDs or URLs into runtime image requests',()=>{
  for(const id of ['../../config','__proto__','constructor','https://images-assets.nasa.gov/evil.jpg','photo-051','photo-000']){assert.equal(P.find(id),null);assert.throws(()=>P.url(id,640));}
  for(const width of [-1,0,321,'640',Infinity])assert.throws(()=>P.url('photo-001',width));
  const world=E.create('Nếu Trái Đất có hai Mặt Trăng?'),before=JSON.stringify(world);assert.equal(A.forWorld(world).kind,'world');assert.equal(A.forWorld({...world,id:'photo-001'}).kind,'world');assert.equal(JSON.stringify(world),before);
});
test('gallery separates real photographs from AI/code, filters both photographic collections and preserves source-aware search',()=>{
  assert.equal(G.filtered({galleryFilter:'photo'}).length,50);assert.equal(G.filtered({galleryFilter:'photo-nature'}).length,35);assert.equal(G.filtered({galleryFilter:'photo-cosmos'}).length,15);
  assert.equal(G.filtered({galleryFilter:'photo',gallery:{query:'bora bora'}})[0].id,'photo-010');
  for(const theme of P.THEMES){const rows=G.filtered({galleryFilter:'photo',gallery:{theme:theme.id}});assert.equal(rows.length,5);assert.ok(rows.every(item=>item.kind==='photo'));}
  const html=G.render({galleryFilter:'photo-nature'});assert.match(html,/Ảnh thực tế · NASA/);assert.match(html,/data-kind="photo-cosmos"/);assert.match(html,/data-kind="scene"/);assert.ok(G.CATEGORIES.includes('photo'));
  assert.ok(G.paginate({}).items.every(item=>item.kind==='photo'),'the first gallery page prioritizes the new real photographs');
});
test('photo viewer credits the actual photographer and NASA source while all world art remains explicitly illustrative',()=>{
  const root={HHMultiverseModel:M,HHMultiverseEngine:E,HHMultiverseInternet:I,HHMultiverseArt:A,HHMultiverseGallery:G,location:{href:'https://hoang8.com/'}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'hh-multiverse-views.js'),'utf8'),{globalThis:root,URL});
  const html=root.HHMultiverseViews.artworkViewer('photo-001',['photo-001','hero']);
  assert.match(html,/Terry Virts/);assert.match(html,/Nguồn ảnh và quyền sử dụng/);assert.match(html,/https:\/\/images.nasa.gov\/details\//);assert.match(html,/NASA Media Usage Guidelines/);assert.match(html,/không tái hiện thế giới hư cấu/);assert.match(html,/noopener noreferrer/);
  assert.doesNotMatch(html,/Minh họa AI|data-mv-action="art-create"/);
  assert.match(root.HHMultiverseViews.artworkViewer('hero',['hero']),/Tranh ý tưởng/);
});
