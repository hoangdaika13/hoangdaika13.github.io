"""Build local, attributed campus photographs from reviewed Commons selections.

Requires Pillow. No discovery or automatic school matching: edit/review the
selection file first. Original photographs are cached outside the release.
"""
import concurrent.futures
import hashlib
import html
import io
import json
import pathlib
import re
import time
import threading
import urllib.parse
import urllib.request
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[1]
SELECTION = ROOT / 'docs/university/campus-photo-selections-v1.json'
DEST = ROOT / 'assets/university'
CACHE = ROOT / '.study-local/university-photo-originals'
AGENT = 'Hoang8CampusPhotos/1.0 (https://hoang8.com; reviewed Commons photographs)'
WIDTHS = (384, 768, 1280)
MAX_BYTES = 25 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 100_000_000
DOWNLOAD_LOCK = threading.Lock()
last_download = 0
PUBLISHED_PATH = DEST / 'campus-photos-v1.json'
PUBLISHED = {photo['schoolId']: photo for photo in json.loads(PUBLISHED_PATH.read_text(encoding='utf-8'))['photos']} if PUBLISHED_PATH.exists() else {}


def retained(row):
    """Keep released variants byte-for-byte; never silently replace pinned work."""
    photo = PUBLISHED.get(row['schoolId'])
    if not photo:
        return None
    if photo['fileTitle'] != 'File:' + row['file'] or any(photo.get(key, '') != row.get(key, '') for key in ('campus','officialUrl','identityNote')):
        raise ValueError('Published photograph changed; use a new asset version: ' + row['schoolId'])
    for asset in photo['assets']:
        if not re.fullmatch(r'\./assets/university/' + re.escape(row['schoolId']) + r'-v1-[0-9]{2,4}\.webp', asset['url']):
            raise ValueError('Unapproved published asset path')
        target = ROOT / asset['url']
        if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError('Restore the pinned released asset before syncing: ' + asset['url'])
    return photo


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', str(value or '')))).strip()


def request(url, image=False):
    global last_download
    parsed = urllib.parse.urlsplit(url)
    allowed = {'upload.wikimedia.org'} if image else {'commons.wikimedia.org'}
    if parsed.scheme != 'https' or parsed.hostname not in allowed or parsed.username or parsed.password:
        raise ValueError('Unapproved source host')
    if image and not parsed.path.startswith('/wikipedia/commons/'):
        raise ValueError('Unapproved image path')
    for attempt in range(3):
        try:
            if image:
                with DOWNLOAD_LOCK:
                    time.sleep(max(0, 4 - (time.monotonic() - last_download)))
                    last_download = time.monotonic()
            req = urllib.request.Request(url, headers={'User-Agent': AGENT})
            with urllib.request.urlopen(req, timeout=45) as response:
                if urllib.parse.urlsplit(response.url).hostname not in allowed:
                    raise ValueError('Unapproved redirect')
                data = response.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise ValueError('Source exceeds image size limit')
                return data
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == 2:
                raise
            time.sleep(15 if getattr(error, 'code', None) == 429 else 1 + attempt)


def build(row):
    school_id = row['schoolId']
    if not re.fullmatch(r'vn-[a-z0-9-]{1,65}', school_id):
        raise ValueError('Invalid school id')
    directory = json.loads((ROOT / 'data/hh-university/directory.json').read_text(encoding='utf-8'))
    school = next((s for s in directory['schools'] if s['id'] == school_id), None)
    if not school:
        raise ValueError('School is absent from directory: ' + school_id)
    old = retained(row)
    if old:
        return old
    params = {'action': 'query', 'format': 'json', 'titles': 'File:' + row['file'],
              'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size|sha1|timestamp'}
    data = json.loads(request('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)))
    page = next(iter(data['query']['pages'].values()))
    info = page['imageinfo'][0]
    meta = info['extmetadata']
    value = lambda key: plain(meta.get(key, {}).get('value', ''))
    licence = value('LicenseShortName')
    if not (re.fullmatch(r'CC BY(?:-SA)? [1-4]\.0', licence) or licence in ('CC0', 'Public domain')):
        raise ValueError('Licence needs manual review: ' + licence)
    if value('Restrictions'):
        raise ValueError('Source has restrictions needing manual review')
    licence_url = value('LicenseUrl').replace('http://', 'https://')
    if licence == 'Public domain' and not licence_url:
        licence_url = 'https://creativecommons.org/publicdomain/mark/1.0/'
    if licence == 'CC0' and not licence_url:
        licence_url = 'https://creativecommons.org/publicdomain/zero/1.0/'
    if urllib.parse.urlsplit(licence_url).hostname != 'creativecommons.org':
        raise ValueError('Unrecognized licence URL')
    if not value('Artist'):
        raise ValueError('Missing author credit')
    source = urllib.parse.urlunsplit(urllib.parse.urlsplit(info['url'])._replace(query=''))
    original_path = CACHE / (school_id + pathlib.Path(urllib.parse.urlsplit(source).path).suffix.lower())
    original = original_path.read_bytes() if original_path.exists() else request(source, image=True)
    if hashlib.sha1(original).hexdigest() != info['sha1']:
        original = request(source, image=True)
    if hashlib.sha1(original).hexdigest() != info['sha1']:
        raise ValueError('Original SHA1 differs from Commons imageinfo')
    original_path.write_bytes(original)
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(original))).convert('RGB')
    sizes = sorted(set(min(width, image.width) for width in WIDTHS))
    assets = []
    for width in sizes:
        height = round(image.height * width / image.width)
        target = DEST / (school_id + '-v1-' + str(width) + '.webp')
        image.resize((width, height), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=79, method=6)
        binary = target.read_bytes()
        assets.append({'width': width, 'height': height, 'url': './assets/university/' + target.name,
                       'bytes': len(binary), 'sha256': hashlib.sha256(binary).hexdigest()})
    return {'schoolId': school_id, 'schoolName': school['name'], 'campus': row['campus'], 'releaseAdded': 1082,
            'identityEvidenceUrl': row.get('identityEvidenceUrl', info['descriptionurl']), 'identityNote': row.get('identityNote', ''),
            'officialUrl': row['officialUrl'], 'fileTitle': page['title'], 'sourceUrl': info['descriptionurl'],
            'originalUrl': source, 'sourcePageId': page['pageid'], 'sourceRevisionAt': info['timestamp'],
            'sourceSha1': info['sha1'], 'sourceSha256': hashlib.sha256(original).hexdigest(),
            'photographer': value('Artist'), 'credit': value('Credit'), 'attribution': value('Attribution'),
            'license': licence, 'licenseUrl': licence_url, 'capturedAt': value('DateTimeOriginal'),
            'sourceDescription': value('ImageDescription'), 'sourceCategories': value('Categories'),
            'changes': 'Chuyển sang WebP, thu nhỏ; khung hiển thị có thể cắt ảnh. Giấy phép ảnh gốc tiếp tục áp dụng.',
            'assets': assets}


def main():
    curated = json.loads(SELECTION.read_text(encoding='utf-8'))
    if curated.get('version') != 1 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', curated.get('checkedAt', '')):
        raise ValueError('Unsupported selection version or review date')
    ids = [row['schoolId'] for row in curated['selections']]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate school selections')
    baseline = json.loads((ROOT / 'docs/university/campus-photo-baseline-1081.json').read_text(encoding='utf-8'))
    if not {row['schoolId'] for row in baseline['photos']}.issubset(ids):
        raise ValueError('The original 1081 photographs must remain selected')
    DEST.mkdir(exist_ok=True)
    CACHE.mkdir(exist_ok=True, parents=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        photos = list(pool.map(build, curated['selections']))
    manifest = {'version': 1, 'checkedAt': curated['checkedAt'], 'policy': curated['policy'], 'photos': photos}
    (DEST / 'campus-photos-v1.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    # The runtime catalogue deliberately contains plain text, never Commons HTML.
    compact = [{key: row[key] for key in ('schoolId','schoolName','campus','officialUrl','sourceUrl','photographer','attribution','license','licenseUrl','capturedAt','changes','identityEvidenceUrl','identityNote','assets')} for row in photos]
    template = (ROOT / 'scripts/hh-university-campus.template.js').read_text(encoding='utf-8')
    output = template.replace('/* CAMPUS_PHOTOS */[]', json.dumps(compact, ensure_ascii=False, separators=(',', ':')))
    (ROOT / 'hh-university-campus.js').write_text(output, encoding='utf-8', newline='\n')
    print(json.dumps({'schools': len(photos), 'variants': sum(len(p['assets']) for p in photos),
                      'bytes': sum(a['bytes'] for p in photos for a in p['assets']),
                      'licenses': sorted(set(p['license'] for p in photos))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
