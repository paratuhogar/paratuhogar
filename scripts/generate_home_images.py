#!/usr/bin/env python3
"""Resize the existing homepage photo/logo; never replace source photographs."""
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=1000&auto=format&fit=crop'


def main():
    with urlopen(Request(SOURCE, headers={'User-Agent': 'ParaTuHogar asset build'}), timeout=60) as response:
        original = response.read()
    with Image.open(io.BytesIO(original)) as opened:
        photo = ImageOps.exif_transpose(opened).convert('RGB')
    destination = ROOT / 'assets'
    destination.mkdir(exist_ok=True)
    outputs = {}
    for width in (360, 720, 1000):
        resized = photo.copy()
        resized.thumbnail((width, width), Image.Resampling.LANCZOS)
        for extension, options in [('avif', {'quality': 45, 'speed': 6}), ('webp', {'quality': 72, 'method': 6})]:
            target = destination / f'home-hero-{width}.{extension}'
            resized.save(target, **options)
            outputs[target.name] = {'width': resized.width, 'height': resized.height, 'bytes': target.stat().st_size}
    with Image.open(ROOT / 'icons/icon-192.png') as logo:
        resized_logo = ImageOps.exif_transpose(logo).convert('RGBA')
        resized_logo.thumbnail((96, 96), Image.Resampling.LANCZOS)
        resized_logo.save(destination / 'icon-logo-96.webp', quality=82, method=6)
    proof = {'source': SOURCE, 'source_sha256': hashlib.sha256(original).hexdigest(), 'original_size': list(photo.size), 'outputs': outputs}
    (destination / 'home-images.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(proof))


if __name__ == '__main__':
    main()
