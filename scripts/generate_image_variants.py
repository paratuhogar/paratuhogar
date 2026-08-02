#!/usr/bin/env python3
"""Generate deterministic AVIF/WebP product thumbnails and their JS manifest."""

from __future__ import annotations

import hashlib
import json
import argparse
from pathlib import Path
from urllib.parse import unquote

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "img_productos" / "optimized"
MANIFEST_PATH = ROOT / "js" / "image-variants.js"
SIZES = (360, 720)
SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def normalized_key(filename: str) -> str:
    return "".join(unquote(filename).strip().replace("'", "").replace('"', "").split())


def variant_name(key: str, size: int, extension: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return f"{digest}-{size}.{extension}"


def prepare_image(source: Path, size: int) -> Image.Image:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        return image.copy()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=ROOT / "img_productos")
    parser.add_argument("--only-list", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_dir = args.source_dir.resolve()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for old_variant in OUTPUT_DIR.iterdir():
        if old_variant.is_file() and old_variant.suffix.lower() in {".webp", ".avif"}:
            old_variant.unlink()
    manifest: dict[str, dict[str, str]] = {}

    allowed_names = None
    if args.only_list:
        allowed_names = {
            normalized_key(line)
            for line in args.only_list.read_text(encoding="utf-8").splitlines()
            if line.strip()
        }

    candidates = sorted(
        path for path in source_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES
    )
    sources = [path for path in candidates if allowed_names is None or normalized_key(path.name) in allowed_names]
    if allowed_names is not None:
        missing = sorted(allowed_names - {normalized_key(path.name) for path in sources})
        if missing:
            raise SystemExit(f"Faltan {len(missing)} fuentes: {', '.join(missing)}")

    for source in sources:
        key = normalized_key(source.name)
        variants: dict[str, str] = {}
        for size in SIZES:
            image = prepare_image(source, size)
            webp_name = variant_name(key, size, "webp")
            avif_name = variant_name(key, size, "avif")
            image.save(OUTPUT_DIR / webp_name, "WEBP", quality=68, method=6)
            image.save(OUTPUT_DIR / avif_name, "AVIF", quality=45, speed=7)
            variants[f"webp{size}"] = f"/img_productos/optimized/{webp_name}"
            variants[f"avif{size}"] = f"/img_productos/optimized/{avif_name}"
        manifest[key] = variants

    payload = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    MANIFEST_PATH.write_text(
        "// Generado por scripts/generate_image_variants.py. No editar manualmente.\n"
        f"window.PTH_IMAGE_VARIANTS=Object.freeze({payload});\n",
        encoding="utf-8",
    )

    original_bytes = sum(path.stat().st_size for path in sources)
    variant_bytes = sum(path.stat().st_size for path in OUTPUT_DIR.iterdir() if path.is_file())
    print(f"Fuentes: {len(sources)} ({original_bytes / 1024 / 1024:.2f} MiB)")
    print(f"Variantes: {len(sources) * len(SIZES) * 2} ({variant_bytes / 1024 / 1024:.2f} MiB)")
    print(f"Manifest: {MANIFEST_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
