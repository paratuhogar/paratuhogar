#!/usr/bin/env python3
"""Extract editable text and embedded screenshots without changing the approved PDF."""
import hashlib
import json
import os
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "guias/guia-gestores.pdf"
OUT = Path(os.environ.get("PTH_GUIDE_SOURCE_DIR", str(ROOT / "docs/guia-gestores/build/extracted")))
PDF_HASH = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "capturas").mkdir(exist_ok=True)
document = fitz.open(SOURCE)
content = {"source_pdf": "/guias/guia-gestores.pdf", "sha256": PDF_HASH,
           "editable_source": "Text and layout recovered from the approved PDF; not the original authoring document.",
           "pages": []}
inventory = {"source_pdf": content["source_pdf"], "sha256": PDF_HASH, "pages_with_images": 0, "images": []}
known_images = {}
for number, page in enumerate(document, 1):
    blocks = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        lines = [{"text": "".join(span["text"] for span in line["spans"]),
                  "spans": [{key: span[key] for key in ("text", "font", "size", "flags", "color", "bbox")}
                            for span in line["spans"]]} for line in block["lines"]]
        blocks.append({"text": "\n".join(line["text"] for line in lines), "bbox": block["bbox"], "lines": lines})
    content["pages"].append({"page": number, "width": page.rect.width, "height": page.rect.height, "blocks": blocks})
    images = page.get_images(full=True)
    if images:
        inventory["pages_with_images"] += 1
    for item in images:
        xref = item[0]
        if xref not in known_images:
            extracted = document.extract_image(xref)
            digest = hashlib.sha256(extracted["image"]).hexdigest()
            name = f"image-{digest[:20]}.{extracted['ext']}"
            (OUT / "capturas" / name).write_bytes(extracted["image"])
            known_images[xref] = {"file": "capturas/" + name, "sha256": digest,
                                  "bytes": len(extracted["image"]), "width": extracted["width"],
                                  "height": extracted["height"]}
        inventory["images"].append({"page": number, **known_images[xref],
                                    "placements": [list(rect) for rect in page.get_image_rects(xref)],
                                    "provenance": "Embedded in the approved final PDF; retain its captions and demonstration labels."})
for name, value in [("contenido-final.json", content), ("inventario-final-capturas.json", inventory)]:
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"pages": len(document), "pages_with_images": inventory["pages_with_images"],
                  "unique_images": len(known_images), "sha256": PDF_HASH, "output": str(OUT)}))
