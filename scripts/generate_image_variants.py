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


def variant_name(content: bytes, size: int, extension: str) -> str:
    digest = hashlib.sha256(b"pth-thumbnails-v2-avif45-webp68:" + content).hexdigest()[:16]
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
    parser.add_argument("--source-tree", type=Path, required=True, help="Verified Git tree with path and blob SHA; no credentials")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_dir = args.source_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    # Content-addressed outputs are additive. Never delete originals/older releases.
    manifest: dict[str, dict] = {}
    proof = json.loads(args.source_tree.read_text(encoding="utf-8"))
    verified = {row["path"]: row["sha"] for row in proof["tree"]}
    generated_bytes = 0

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
        content = source.read_bytes()
        blob_sha = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
        if verified.get("img_productos/" + source.name) != blob_sha:
            raise SystemExit(f"Fuente no verificada: {source.name}")
        variants: dict = {"sourceBlob": blob_sha, "sourceBytes": len(content)}
        for size in SIZES:
            image = prepare_image(source, size)
            webp_name = variant_name(content, size, "webp")
            avif_name = variant_name(content, size, "avif")
            image.save(output_dir / webp_name, "WEBP", quality=68, method=6)
            image.save(output_dir / avif_name, "AVIF", quality=45, speed=7)
            generated_bytes += (output_dir / webp_name).stat().st_size + (output_dir / avif_name).stat().st_size
            variants[f"width{size}"] = image.width
            variants[f"height{size}"] = image.height
            variants[f"webp{size}"] = f"/img_productos/optimized/{webp_name}"
            variants[f"avif{size}"] = f"/img_productos/optimized/{avif_name}"
        manifest[key] = variants

    payload = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(
        "// Generado por scripts/generate_image_variants.py. No editar manualmente.\n"
        f"window.PTH_IMAGE_VARIANTS=Object.freeze({payload});\n"
        f"window.PTH_IMAGE_VARIANTS_SOURCE=Object.freeze({json.dumps({'repository':'paratuhogar/paratuhogar-fotos','commit':proof.get('commit',proof.get('sha'))})});\n",
        encoding="utf-8",
    )

    original_bytes = sum(path.stat().st_size for path in sources)
    variant_bytes = generated_bytes
    print(f"Fuentes: {len(sources)} ({original_bytes / 1024 / 1024:.2f} MiB)")
    print(f"Variantes: {len(sources) * len(SIZES) * 2} ({variant_bytes / 1024 / 1024:.2f} MiB)")
    print(f"Manifest: {args.manifest}")


if __name__ == "__main__":
    main()
