"""Package 50 verified NASA photographs, preserving source, credit and usage provenance.

Only resize, center crop to 16:9 and WebP encode; no AI generation or scene retouching.
Downloads and full source metadata remain in ignored .study-local/. Runtime uses local assets.
"""
import concurrent.futures
import hashlib
import io
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'scripts/multiverse-photo-sources.json'
DEST = ROOT / 'assets/multiverse/photos'
CACHE = ROOT / '.study-local/multiverse-photo-originals'
MANIFEST = ROOT / 'assets/multiverse/photos-manifest-v1.json'
POLICY = 'https://www.nasa.gov/nasa-brand-center/images-and-media/'
HOSTS = {'images-api.nasa.gov', 'images-assets.nasa.gov', 'images.nasa.gov', 'www.nasa.gov'}
THEMES = [('aurora', 'Cực quang'), ('reef', 'Rạn san hô'), ('desert', 'Sa mạc'), ('volcano', 'Núi lửa'), ('forest', 'Rừng và sông'), ('nightcity', 'Thành phố về đêm'), ('island', 'Biển đảo'), ('mountain', 'Núi và hồ'), ('moon', 'Mặt Trăng và Trái Đất'), ('launch', 'Hành trình không gian')]


def fetch(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in HOSTS or parsed.username or parsed.password:
        raise ValueError('Unapproved source URL')
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'HH-Multiverse-Photo-Catalog/1.0'})
            with urllib.request.urlopen(request, timeout=45) as response:
                if urllib.parse.urlsplit(response.url).hostname not in HOSTS:
                    raise ValueError('Unapproved source redirect')
                data = response.read(30 * 1024 * 1024 + 1)
                if len(data) > 30 * 1024 * 1024:
                    raise ValueError('Photo exceeds bounded source download size')
                return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def process(item):
    asset_id, nasa_id = item['id'], item['nasaId']
    if not re.fullmatch(r'photo-\d{3}', asset_id) or not re.fullmatch(r'[a-zA-Z0-9_-]{2,150}', nasa_id):
        raise ValueError('Invalid curated ID')
    cache_json, cache_image = CACHE / (asset_id + '.json'), CACHE / (asset_id + '.jpg')
    if cache_json.exists() and cache_image.exists():
        cached = json.loads(cache_json.read_text(encoding='utf-8'))
        record, metadata, source_url = cached['record'], cached['metadata'], cached['imageURL']
        original = cache_image.read_bytes()
    else:
        search_url = 'https://images-api.nasa.gov/search?' + urllib.parse.urlencode({'nasa_id': nasa_id, 'media_type': 'image'})
        rows = json.loads(fetch(search_url))['collection']['items']
        record = next(row for row in rows if row['data'][0]['nasa_id'] == nasa_id)
        candidates = [link for link in record['links'] if link.get('render') == 'image' and link.get('width', 0) >= 1280 and link.get('href', '').lower().endswith(('.jpg', '.jpeg', '.png'))]
        if not candidates:
            raise ValueError('No real photo of sufficient resolution: ' + nasa_id)
        # NASA's 1920px alternate preserves enough source pixels without downloading archival TIFFs.
        choice = min(candidates, key=lambda link: abs(link['width'] - 1920))
        source_url = choice['href']
        metadata = json.loads(fetch('https://images-assets.nasa.gov/image/' + nasa_id + '/metadata.json'))
        original = fetch(source_url)
        cache_image.write_bytes(original)
        cache_json.write_text(json.dumps({'record': record, 'metadata': metadata, 'imageURL': source_url}, ensure_ascii=False), encoding='utf-8')
    data = record['data'][0]
    if data.get('center') not in {'JSC', 'KSC'}:
        raise ValueError('Only reviewed NASA/JSC and NASA/KSC photographs are included')
    rights_fields = {key: str(value) for key, value in metadata.items() if key in ['XMP:Rights', 'IPTC:CopyrightNotice', 'EXIF:Copyright', 'Photoshop:Credit', 'IPTC:Credit', 'AVAIL:Copyright', 'XMP:UsageTerms'] and value}
    credit = str(data.get('secondary_creator') or metadata.get('IPTC:Credit') or '')
    creator = metadata.get('XMP:Creator')
    full_author = ', '.join(str(value) for value in creator) if isinstance(creator, list) else creator if isinstance(creator, str) else ''
    # XMP often retains full names when the legacy IPTC/AVAIL photographer field is truncated.
    author = str(full_author or data.get('photographer') or metadata.get('AVAIL:Photographer') or credit or '')
    if any(word in (' '.join(rights_fields.values()) + ' ' + credit + ' ' + author).lower() for word in ['esa', 'getty', 'reuters', 'associated press', 'copyrighted']):
        raise ValueError('Third-party rights require a separate verified license: ' + nasa_id)
    if any(value and 'nasa' not in value.lower() and 'public domain' not in value.lower() for key, value in rights_fields.items() if 'copyright' in key.lower() or 'rights' in key.lower()):
        raise ValueError('Unverified copyright notice: ' + nasa_id)
    if re.search(r"artist.?s (?:concept|rendition)|illustration|computer.generated|simulated image|infographic", data['title'], re.I):
        raise ValueError('A photograph is required: ' + nasa_id)
    author = author or ('NASA / Johnson Space Center' if data['center'] == 'JSC' else 'NASA / Kennedy Space Center')
    with Image.open(io.BytesIO(original)) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        if image.width < 1280 or image.height < 720:
            raise ValueError('Do not upscale low-resolution images: ' + nasa_id)
        source_size = {'width': image.width, 'height': image.height}
        variants = []
        focal_point = tuple(item.get('focalPoint', [.5, .5]))
        if len(focal_point) != 2 or any(not isinstance(value, (int, float)) or not 0 <= value <= 1 for value in focal_point):
            raise ValueError('Invalid reviewed crop focal point')
        for width in [320, 640, 1280]:
            height = width * 9 // 16
            crop = ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS, centering=focal_point)
            filename = asset_id + '-v1-' + str(width) + '.webp'
            target = DEST / filename
            crop.save(target, 'WEBP', quality=78 if width < 1000 else 80, method=6)
            content = target.read_bytes()
            variants.append({'file': filename, 'width': width, 'height': height, 'bytes': len(content), 'sha256': digest(content)})
    return {key: item[key] for key in ['id', 'nasaId', 'theme', 'group', 'tone', 'title', 'description']} | {
        'sourceTitle': data['title'], 'sourceURL': 'https://images.nasa.gov/details/' + nasa_id,
        'sourceImageURL': source_url, 'metadataURL': 'https://images-assets.nasa.gov/image/' + nasa_id + '/metadata.json',
        'author': author, 'credit': credit or 'NASA', 'center': data['center'], 'captured': data.get('date_created', '')[:10],
        'license': 'NASA Media Usage Guidelines', 'licenseURL': POLICY,
        'rightsReview': 'NASA-origin photograph; no third-party copyright identified in official record; NASA attribution required; no endorsement implied.',
        'sourceSha256': digest(original), 'sourceDimensions': source_size,
        'transform': 'Reviewed 16:9 crop, downsample and WebP encoding only; no generative editing.', 'focalPoint': focal_point, 'variants': variants
    }


def module(items):
    rows = []
    labels = dict(THEMES)
    for item in items:
        row = {key: item[key] for key in ['id', 'title', 'description', 'tone', 'author', 'sourceTitle', 'sourceURL', 'sourceImageURL', 'license', 'licenseURL', 'captured']}
        row |= {'kind': 'photo', 'phototheme': item['theme'], 'theme': 'photo-' + item['theme'], 'themeLabel': labels[item['theme']], 'photoGroup': item['group']}
        rows.append(row)
    return '''/* Verified NASA photographs. Generated by scripts/build-multiverse-photos.py; see provenance manifest. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HHMultiversePhotos=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const WIDTHS=Object.freeze([320,640,1280]);
  const THEMES=Object.freeze(%s.map(([id,name])=>Object.freeze({id:'photo-'+id,name})));
  const catalog=Object.freeze(%s.map(item=>Object.freeze({...item,widths:WIDTHS,caption:'Ảnh thực tế tham khảo · không tái hiện thế giới hư cấu'})));
  const byId=new Map(catalog.map(item=>[item.id,item]));
  const find=id=>byId.get(id)||null;
  function url(id,width){const item=find(id);if(!item||!WIDTHS.includes(width))throw Error('Ảnh thực tế hoặc kích thước không có trong thư viện.');return './assets/multiverse/photos/'+item.id+'-v1-'+width+'.webp';}
  return Object.freeze({VERSION:1,THEMES,catalog,find,url});
});
''' % (json.dumps(THEMES, ensure_ascii=False, separators=(',', ':')), json.dumps(rows, ensure_ascii=False, separators=(',', ':')))


def main():
    data = json.loads(SOURCES.read_text(encoding='utf-8'))
    DEST.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    items, errors = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        pending = {pool.submit(process, item): item['id'] for item in data['items']}
        for future in concurrent.futures.as_completed(pending):
            try:
                items.append(future.result())
            except Exception as error:
                errors.append(pending[future] + ': ' + str(error))
    if errors:
        raise ValueError('\n'.join(errors))
    items.sort(key=lambda item: item['id'])
    if len({item['sourceSha256'] for item in items}) != len(items):
        raise ValueError('Duplicate source photographs must not inflate the catalog')
    total = sum(variant['bytes'] for item in items for variant in item['variants'])
    if total > 14 * 1024 * 1024:
        raise ValueError('Photo collection exceeds 14MiB budget')
    manifest = {'version': 1, 'reviewed': data['reviewed'], 'purpose': 'Actual reference photographs, not fictional world snapshots.', 'count': len(items), 'totalBytes': total, 'policyURL': POLICY, 'items': items}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'hh-multiverse-photos.js').write_text(module(items), encoding='utf-8')
    print(json.dumps({'photos': len(items), 'files': len(items) * 3, 'bytes': total}))


if __name__ == '__main__':
    main()
