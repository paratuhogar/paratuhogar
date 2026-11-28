#!/usr/bin/env python3
"""Refresh public card thumbnails; originals stay in a temporary download directory.

Online: python3 scripts/refresh_catalog_image_variants.py
Offline: add --catalog-json catalog.json --source-tree tree.json --source-dir DIR.
Only the anonymous public productos projection and public photo repository are read.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from generate_image_variants import MANIFEST_PATH, OUTPUT_DIR, REPOSITORY, ROOT, SUPPORTED_SUFFIXES, normalized_key, read_manifest, write_manifest

AVAILABLE = {"SI", "SÍ", "YES", "TRUE", "1", "DISPONIBLE", "EN STOCK"}
FIELDS = ("thumbnail", "image1", "image2", "image3")
MAX_SOURCE_BYTES = 32 * 1024 * 1024


def request_json(url: str, *, payload: dict | None = None, headers: dict | None = None):
    request = Request(url, data=json.dumps(payload).encode() if payload else None,
        headers={"User-Agent": "paratuhogar-catalog-thumbnails", **(headers or {})})
    with urlopen(request, timeout=45) as response:
        return json.load(response)


def public_catalog() -> list[dict]:
    # Reuse only the publishable browser configuration; never environment secrets/sessions.
    config = (ROOT / "js" / "public-catalog-api.js").read_text(encoding="utf-8")
    endpoint = re.search(r"root\.fetch\('(https://[a-z]+\.supabase\.co/functions/v1/secure-data)'", config)
    key = re.search(r"apikey:'(sb_publishable_[A-Za-z0-9_-]+)'", config)
    if not endpoint or not key:
        raise ValueError("No se encontró la configuración pública existente")
    rows = []
    for offset in range(0, 5000, 1000):
        result = request_json(endpoint[1], payload={"action": "query", "table": "productos", "op": "select",
            "columns": "id,disponible,thumbnail,image1,image2,image3", "orders": [{"column": "id", "ascending": True}],
            "range": [offset, offset + 999]}, headers={"apikey": key[1], "Content-Type": "application/json"})
        if result.get("error") or not isinstance(result.get("data"), list):
            raise ValueError("Falló la lectura del catálogo público")
        rows.extend(result["data"])
        if len(result["data"]) < 1000:
            return rows
    raise ValueError("El catálogo público supera el límite seguro de 5000 productos")


def catalog_names(rows: list[dict]) -> list[str]:
    names = set()
    for row in rows:
        if str(row.get("disponible", "")).strip().upper() not in AVAILABLE:
            continue
        for field in FIELDS:
            value = row.get(field)
            if not value:
                continue
            if not isinstance(value, str):
                raise ValueError(f"Fuente inválida en {field}")
            parsed = urlparse(value.strip())
            if parsed.scheme or parsed.netloc:
                if (parsed.scheme != "https" or parsed.netloc != "raw.githubusercontent.com"
                        or not parsed.path.startswith(f"/{REPOSITORY}/") or parsed.query or parsed.fragment):
                    raise ValueError("Fuente externa no verificable en el repositorio público")
                parts = parsed.path.split("/")
                if len(parts) != 6 or parts[-2] != "img_productos":
                    raise ValueError("Ruta de imagen pública inválida")
            elif parsed.query or parsed.fragment or ("/" in parsed.path and not re.fullmatch(r"/?img_productos/[^/]+", parsed.path)):
                raise ValueError("Ruta de imagen inválida")
            name = normalized_key(parsed.path.rsplit("/", 1)[-1])
            if name in {"null", "undefined"}:
                continue
            if (not name or any(char in name for char in "/\\\0") or name in {".", ".."}
                    or Path(name).suffix.lower() not in SUPPORTED_SUFFIXES):
                raise ValueError("Nombre de imagen inválido")
            names.add(name)
    if not names:
        raise ValueError("El catálogo no contiene fotos públicas disponibles; se conserva lo publicado")
    return sorted(names)


def photo_proof() -> dict:
    commit = request_json(f"https://api.github.com/repos/{REPOSITORY}/commits/main")
    sha = commit["sha"]
    tree = request_json(f"https://api.github.com/repos/{REPOSITORY}/git/trees/{commit['commit']['tree']['sha']}?recursive=1")
    if tree.get("truncated"):
        raise ValueError("Árbol Git incompleto; no se actualizarán miniaturas")
    return {"repository": REPOSITORY, "commit": sha, "tree": [row for row in tree["tree"]
        if row["type"] == "blob" and row["path"].startswith("img_productos/") and row["path"].count("/") == 1]}


def select_sources(names: list[str], proof: dict) -> list[dict]:
    if not re.fullmatch(r"[a-f0-9]{40}", str(proof.get("commit", ""))):
        raise ValueError("Commit Git de fuentes inválido")
    index = {}
    requested = set(names)
    for row in proof["tree"]:
        path = row.get("path", "")
        if row.get("type") != "blob" or not path.startswith("img_productos/") or path.count("/") != 1:
            continue
        filename = path.split("/", 1)[1]
        if any(char in filename for char in "\\\0") or filename in {".", ".."} or not re.fullmatch(r"[a-f0-9]{40}", row.get("sha", "")):
            raise ValueError("Entrada de árbol Git inválida")
        key = normalized_key(filename)
        if key in requested:
            index.setdefault(key, []).append(row)
    missing = set(names) - index.keys()
    if missing:
        raise ValueError(f"Fuentes no presentes en el árbol Git: {', '.join(sorted(missing))}")
    selected = []
    for name in names:
        candidates = index[name]
        exact = [row for row in candidates if row["path"] == f"img_productos/{name}"]
        if len(exact) == 1:
            selected.append(exact[0])
        elif len(candidates) == 1:
            selected.append(candidates[0])
        else:
            raise ValueError(f"Colisión de fuentes públicas solicitadas: {name}")
    return selected


def download_sources(rows: list[dict], commit: str, destination: Path) -> None:
    for row in rows:
        url = f"https://raw.githubusercontent.com/{REPOSITORY}/{commit}/{quote(row['path'])}"
        with urlopen(Request(url, headers={"User-Agent": "paratuhogar-catalog-thumbnails"}), timeout=45) as response:
            content = response.read(MAX_SOURCE_BYTES + 1)
        if len(content) > MAX_SOURCE_BYTES:
            raise ValueError("Fuente supera 32 MiB")
        blob = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
        if blob != row["sha"]:
            raise ValueError(f"Fuente descargada no coincide con blob Git: {row['path']}")
        (destination / row["path"].split("/", 1)[1]).write_bytes(content)


def needs_refresh(row: dict, manifest: dict, output: Path) -> bool:
    previous = manifest.get(normalized_key(row["path"].split("/", 1)[1]), {})
    if previous.get("sourceBlob") != row["sha"]:
        return True
    for format_ in ("webp", "avif"):
        for size in (360, 720):
            path = previous.get(f"{format_}{size}", "")
            if not re.fullmatch(rf"/img_productos/optimized/[a-f0-9]{{16}}-{size}\.{format_}", path):
                return True
            if not (output / path.rsplit("/", 1)[1]).is_file():
                return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog-json", type=Path, help="Fixture pública local; evita consulta del catálogo")
    parser.add_argument("--source-tree", type=Path)
    parser.add_argument("--source-dir", type=Path, help="Fuentes locales verificables; evita descargas")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--active-list", type=Path, default=ROOT / "scripts" / "active-catalog-images.txt")
    parser.add_argument("--proof-output", type=Path, default=ROOT / "scripts" / "catalog-image-sources.json")
    args = parser.parse_args()
    catalog = json.loads(args.catalog_json.read_text()) if args.catalog_json else public_catalog()
    if not isinstance(catalog, list):
        raise ValueError("Catálogo público inválido")
    names = catalog_names(catalog)
    proof = json.loads(args.source_tree.read_text()) if args.source_tree else photo_proof()
    selected = select_sources(names, proof)
    selected_proof = {"repository": REPOSITORY, "commit": proof["commit"], "tree": selected}
    manifest, metadata = read_manifest(args.manifest)
    changed = [row for row in selected if needs_refresh(row, manifest, args.output_dir)]
    with tempfile.TemporaryDirectory(prefix="pth-public-image-sources-") as temporary:
        temp = Path(temporary)
        sources = temp / "sources"
        sources.mkdir()
        if args.source_dir is None:
            download_sources(changed, proof["commit"], sources)
        else:
            # Stage only the selected original; unrelated legacy aliases remain untouched.
            for row in changed:
                name = row["path"].split("/", 1)[1]
                shutil.copyfile(args.source_dir / name, sources / name)
        active_file = temp / "active.txt"
        active_file.write_text("\n".join(names) + "\n", encoding="utf-8")
        proof_file = temp / "proof.json"
        proof_file.write_text(json.dumps(selected_proof), encoding="utf-8")
        if changed:
            changed_list = temp / "changed.txt"
            changed_list.write_text("\n".join(normalized_key(row["path"].split("/", 1)[1]) for row in changed) + "\n", encoding="utf-8")
            subprocess.run([sys.executable, str(ROOT / "scripts" / "generate_image_variants.py"),
                "--source-dir", str(sources), "--source-tree", str(proof_file), "--only-list", str(changed_list),
                "--output-dir", str(args.output_dir), "--manifest", str(args.manifest)], check=True)
        else:
            for row in manifest.values():
                if metadata.get("commit"):
                    row.setdefault("sourceCommit", metadata["commit"])
            write_manifest(args.manifest, manifest, {"repository": REPOSITORY, "commit": proof["commit"]})
        # Publish evidence/list only after the generator validates and succeeds.
        args.active_list.write_text(active_file.read_text(encoding="utf-8"), encoding="utf-8")
        args.proof_output.write_text(json.dumps(selected_proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Catálogo: {len(catalog)} productos públicos; {len(names)} fotos disponibles verificadas")
    print(f"Fuentes nuevas/modificadas: {len(changed)}; descargas omitidas: {len(selected) - len(changed)}")


if __name__ == "__main__":
    main()
