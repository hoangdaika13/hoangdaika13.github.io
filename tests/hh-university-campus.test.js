'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const P = require('../hh-university-campus'), E = require('../hh-university-experience-core');
const root = path.resolve(__dirname, '..'), directory = require('../data/hh-university/directory.json');
const manifest = require('../assets/university/campus-photos-v1.json'), selected = require('../docs/university/campus-photo-selections-v1.json');

test('real photographs bind only reviewed exact school IDs, including a clearly historical college record', () => {
  assert.equal(P.VERSION, 1); assert.equal(P.catalog.length, 30); assert.equal(manifest.photos.length, selected.selections.length);
  assert.equal(new Set(P.catalog.map(photo => photo.schoolId)).size, P.catalog.length);
  assert.ok(Object.isFrozen(P.catalog)); assert.ok(Object.isFrozen(P.catalog[0].assets));
  for (const photo of P.catalog) {
    const school = directory.schools.find(row => row.id === photo.schoolId), original = manifest.photos.find(row => row.schoolId === photo.schoolId), selection = selected.selections.find(row => row.schoolId === photo.schoolId);
    assert.ok(school); assert.equal(photo.schoolName, school.name); assert.equal(original.fileTitle, 'File:' + selection.file);
    assert.ok(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(photo.sourceUrl));
    assert.equal(new URL(original.originalUrl).hostname, 'upload.wikimedia.org');
    assert.match(original.sourceSha1, /^[a-f0-9]{40}$/); assert.match(original.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(original.sourceDescription.length); assert.ok(original.sourceRevisionAt); assert.ok(original.identityEvidenceUrl);
  }
  const college = P.catalog.find(photo => directory.schools.find(s => s.id === photo.schoolId).level === 'college');
  assert.ok(college); assert.match(college.identityNote, /tên cũ/); assert.match(college.capturedAt, /2012/);
  assert.equal(P.find('vn-ts-1476'), null, 'Do not silently attach the old-college photo to another institution record');
  assert.equal(P.find('vn-ts-422'), null, 'Thuyloi Hanoi photograph must not become a photograph of its southern campus');
});

test('every distributed photograph has plain-text author, open licence, source and declared changes', () => {
  for (const photo of P.catalog) {
    assert.match(photo.license, /^(CC BY(?:-SA)? [1-4]\.0|CC0|Public domain)$/);
    assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org');
    assert.ok(photo.photographer.trim()); assert.doesNotMatch(photo.photographer, /<[^>]+>/);
    const html = P.credit(photo);
    assert.ok(html.includes(photo.license)); assert.match(html, /Wikimedia Commons/); assert.match(html, /WebP/);
    assert.match(html, /rel="noopener noreferrer"/);
  }
  assert.equal(P.credit({sourceUrl:'javascript:alert(1)',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'}), '');
});

test('all 90 local variants match pinned checksums and retain proportional dimensions without upscaling', () => {
  let variants = 0, bytes = 0;
  for (const photo of P.catalog) {
    assert.equal(photo.assets.length, 3);
    let previous = 0;
    for (const asset of photo.assets) {
      assert.ok(asset.width > previous && asset.width <= 1280); previous = asset.width;
      assert.ok(Math.abs(asset.height / asset.width - photo.assets[0].height / photo.assets[0].width) < .006);
      assert.equal(P.url(photo.schoolId, asset.width), asset.url);
      const binary = fs.readFileSync(path.join(root, asset.url));
      assert.equal(binary.subarray(0,4).toString(), 'RIFF'); assert.equal(binary.subarray(8,12).toString(), 'WEBP');
      assert.equal(binary.length, asset.bytes); assert.equal(crypto.createHash('sha256').update(binary).digest('hex'), asset.sha256);
      variants++; bytes += binary.length;
    }
  }
  assert.equal(variants, 90); assert.ok(bytes < 8 * 1024 * 1024);
  for (const [id, width] of [['../outside',768],['vn-ts-302',123],['https://evil.example/photo',768]]) assert.throws(() => P.url(id,width));
});

test('responsive pictures have exact campus alt text, local lazy images, accessible source and honest fallback', () => {
  const school = directory.schools.find(s => s.id === 'vn-ts-302'), html = P.picture(school,{variant:'profile',link:true});
  assert.match(html, /loading="lazy"/); assert.match(html, /decoding="async"/); assert.match(html, /srcset=/);
  assert.match(html, /alt="Khuôn viên Đại học Bách khoa Hà Nội"/); assert.match(html, /Nguồn ảnh/);
  assert.doesNotMatch(html, /src="https?:/); assert.match(html, /href="#\/university\/school\/vn-ts-302"/);
  const missing = P.picture({id:'unverified',name:'<img src=x onerror=1>',code:'<HH>'});
  assert.doesNotMatch(missing, /<img/); assert.match(missing, /Chưa có ảnh được xác minh/); assert.match(missing, /&lt;img/); assert.match(missing, /Ảnh trường đang được bổ sung/);
  assert.equal(P.initials({name:'Trường Đại học Công nghệ Thông tin'}), 'CNT');
});

test('school-only photo filters survive saved search normalization and share links without polluting major search', () => {
  const f = E.filters({q:'Đà Lạt',photos:'verified',private:'secret'});
  assert.equal(f.photos,'verified'); assert.equal(E.filters({photos:'https://evil.example'}).photos,undefined);
  assert.match(E.searchURL(f,'schools'), /photos=verified/); assert.doesNotMatch(E.searchURL(f,'majors'), /photos=/);
  const state = E.normalize({...E.defaults(),schoolSearches:[{id:'campus-search',name:'Ảnh Đà Lạt',filters:f}]});
  assert.equal(state.schoolSearches[0].filters.photos,'verified'); assert.doesNotMatch(JSON.stringify(state),/secret/);
});
