"""Offline integration tests: real codecs/files, never production network requests."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

GENERATOR = Path(__file__).with_name("generate_image_variants.py")


class ImageFixture:
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sources = self.root / "sources"
        self.sources.mkdir()
        self.output = self.root / "optimized"
        self.manifest = self.root / "image-variants.js"
        self.proof = self.root / "tree.json"

    def source(self, name="current.png", color="red"):
        path = self.sources / name
        Image.new("RGB", (40, 20), color).save(path)
        return path

    def verified(self, *sources):
        rows = []
        for path in sources:
            content = path.read_bytes()
            sha = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
            rows.append({"path": "img_productos/" + path.name, "sha": sha, "type": "blob"})
        self.proof.write_text(json.dumps({"commit": "a" * 40, "tree": rows}))

    def run_generator(self):
        return subprocess.run([sys.executable, str(GENERATOR), "--source-dir", str(self.sources),
            "--source-tree", str(self.proof), "--output-dir", str(self.output),
            "--manifest", str(self.manifest)], capture_output=True, text=True)

    def manifest_data(self):
        return json.loads(re.search(r"PTH_IMAGE_VARIANTS=Object.freeze\((.*)\);", self.manifest.read_text())[1])


class ImageVariantsTests(ImageFixture, unittest.TestCase):
    def test_partial_refresh_preserves_previously_published_mapping(self):
        self.manifest.write_text('window.PTH_IMAGE_VARIANTS=Object.freeze({"retired.png":{"sourceBlob":"old","webp360":"/old.webp"}});\n')
        self.verified(self.source())
        result = self.run_generator()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("retired.png", self.manifest_data())
        self.assertEqual(self.manifest_data()["retired.png"]["webp360"], "/old.webp")
        self.assertIn("current.png", self.manifest_data())

    def test_unchanged_refresh_does_not_reencode_existing_variants(self):
        self.verified(self.source())
        self.assertEqual(self.run_generator().returncode, 0)
        before = {path.name: path.stat().st_mtime_ns for path in self.output.iterdir()}
        self.assertEqual(self.run_generator().returncode, 0)
        self.assertEqual({path.name: path.stat().st_mtime_ns for path in self.output.iterdir()}, before)

    def test_changed_source_gets_new_content_hash_and_keeps_previous_files(self):
        self.verified(self.source())
        self.assertEqual(self.run_generator().returncode, 0)
        previous = self.manifest_data()["current.png"]["webp360"]
        old_files = set(self.output.iterdir())
        self.verified(self.source(color="blue"))
        self.assertEqual(self.run_generator().returncode, 0)
        self.assertNotEqual(previous, self.manifest_data()["current.png"]["webp360"])
        self.assertTrue(all(path.exists() for path in old_files))
        self.assertEqual(len(list(self.output.iterdir())), 8)

    def test_unverified_source_aborts_before_writing_any_variant(self):
        self.verified(self.source("a-valid.png"))
        self.source("z-invalid.png")
        result = self.run_generator()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Fuente no verificada", result.stderr)
        self.assertFalse(self.manifest.exists())
        self.assertEqual(list(self.output.glob("*")), [])

    def test_normalized_filename_collision_aborts_without_a_manifest(self):
        self.verified(self.source("same.png"), self.source("sa me.png", "blue"))
        result = self.run_generator()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.manifest.exists())

    def test_verified_but_corrupt_image_aborts_before_writing_any_variant(self):
        valid = self.source("a-valid.png")
        corrupt = self.sources / "z-corrupt.png"
        corrupt.write_bytes(b"not an image")
        self.verified(valid, corrupt)
        result = self.run_generator()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(list(self.output.glob("*")), [])

    def test_malformed_existing_manifest_is_not_silently_replaced(self):
        self.manifest.write_text("unexpected existing content")
        self.verified(self.source())
        result = self.run_generator()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.manifest.read_text(), "unexpected existing content")


if __name__ == "__main__":
    unittest.main()
