"""Embed the supplied transit artwork for standalone diagram SVGs."""
import base64
import json
from pathlib import Path
import re
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SVG = 'http://www.w3.org/2000/svg'
XLINK = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XLINK)
FILES = {
    'amtrak': 'Amtrak_Square.svg',
    'dart': 'Dallas_Area_Rapid_Transit_logo.svg',
    'dcta': 'DCTA_Square.svg',
    'flixbus': 'FlixBus_Square.svg',
    'greyhound': 'Greyhound_Square.svg',
    'm-line': 'M_Line_Trolley_Square.svg',
    'redcoach': 'RedCoach_Square.svg',
    'star-transit': 'STAR_Transit_Square.svg',
    'tre': 'TRE_Square.svg',
    'trinity-metro': 'Trinity_Metro_Square.svg',
    'vonlane': 'Vonlane_Stacked.svg',
}
LIMIT = 8 * 1024 * 1024
cache = {}


def fetch(url):
    if urlparse(url).hostname not in {'upload.wikimedia.org', 'commons.wikimedia.org'}:
        raise ValueError(f'Unsupported linked artwork host: {url}')
    if url not in cache:
        request = Request(url, headers={'User-Agent': 'DallasUrbanists-ImprovementMap-PoC/1.0'})
        for attempt in range(3):
            try:
                with urlopen(request, timeout=40) as response:
                    content = response.read(LIMIT + 1)
                    if len(content) > LIMIT:
                        raise ValueError('Linked artwork exceeds size limit')
                    cache[url] = content
                break
            except OSError:
                if attempt == 2:
                    raise
                time.sleep(2)
    return cache[url]


def local_name(element):
    return element.tag.rsplit('}', 1)[-1] if isinstance(element.tag, str) else ''


def embed_images(root, depth=0):
    if depth > 4:
        raise ValueError('Too many nested artwork links')
    for parent in list(root.iter()):
        for image in list(parent):
            if local_name(image) != 'image':
                continue
            url = image.get('href') or image.get(f'{{{XLINK}}}href')
            if not url or url.startswith('data:'):
                continue
            content = fetch(url)
            if content.startswith(b'\x89PNG\r\n\x1a\n'):
                image.set('href', 'data:image/png;base64,' + base64.b64encode(content).decode('ascii'))
                image.attrib.pop(f'{{{XLINK}}}href', None)
            else:
                artwork = ET.fromstring(content)
                if local_name(artwork) != 'svg':
                    raise ValueError(f'Linked artwork is not SVG or PNG: {url}')
                embed_images(artwork, depth + 1)
                if 'viewBox' not in artwork.attrib:
                    dimensions = [re.match(r'[\d.]+', artwork.get(attr, '')) for attr in ('width', 'height')]
                    if not all(dimensions):
                        raise ValueError(f'Artwork has no dimensions: {url}')
                    artwork.set('viewBox', f'0 0 {dimensions[0].group()} {dimensions[1].group()}')
                for attr in ('x', 'y', 'width', 'height', 'filter', 'preserveAspectRatio'):
                    if attr in image.attrib:
                        artwork.set(attr, image.get(attr))
                parent.insert(list(parent).index(image), artwork)
                parent.remove(image)


def prepare(agency, filename):
    root = ET.fromstring((ROOT / 'public' / 'icons' / 'transit_logos' / filename).read_bytes())
    embed_images(root)
    for element in root.iter():
        if local_name(element) in {'script', 'foreignObject'}:
            raise ValueError(f'Unsupported SVG element in {filename}')
        for name, value in list(element.attrib.items()):
            if name.lower().startswith('on'):
                raise ValueError(f'Event attribute in {filename}')
            if name.rsplit('}', 1)[-1] == 'href' and not value.startswith(('#', 'data:')):
                raise ValueError(f'Unembedded link in {filename}')
    view_box = root.get('viewBox') or f'0 0 {root.get("width")} {root.get("height")}'
    markup = ''.join(ET.tostring(child, encoding='unicode') for child in root)
    for identifier in set(re.findall(r'\bid="([^"]+)"', markup)):
        prefix = f'{agency}-{identifier}'
        markup = markup.replace(f'id="{identifier}"', f'id="{prefix}"')
        markup = markup.replace(f'url(#{identifier})', f'url(#{prefix})')
        markup = markup.replace(f'href="#{identifier}"', f'href="#{prefix}"')
    return {'file': filename, 'viewBox': view_box, 'markup': markup}


if __name__ == '__main__':
    logos = {agency: prepare(agency, filename) for agency, filename in FILES.items()}
    output = ROOT / 'src' / 'data' / 'transitAgencyLogos.js'
    output.write_text('export default ' + json.dumps(logos, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'Embedded {len(logos)} agency logos in {output.name}')
