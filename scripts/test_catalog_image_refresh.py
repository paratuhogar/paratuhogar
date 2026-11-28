"""Exercise refresh end to end from local catalog/tree fixtures, without network."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

from test_image_variants import ImageFixture

REFRESH = Path(__file__).with_name("refresh_catalog_image_variants.py")


class CatalogImageRefreshTests(ImageFixture, unittest.TestCase):
    def run_refresh(self, rows):
        catalog = self.root / "catalog.json"
        catalog.write_text(json.dumps(rows))
        return subprocess.run([sys.executable, str(REFRESH), "--catalog-json", str(catalog),
            "--source-dir", str(self.sources), "--source-tree", str(self.proof),
            "--output-dir", str(self.output), "--manifest", str(self.manifest),
            "--active-list", str(self.root / "active.txt"),
            "--proof-output", str(self.root / "published-proof.json")], capture_output=True, text=True)

    def test_refresh_covers_current_thumbnail_and_all_card_gallery_fields(self):
        self.verified(self.source(), self.source("second.png", "blue"), self.source("third.png", "green"))
        result = self.run_refresh([
            {"disponible": "SI", "thumbnail": "\u200ecurrent.png\u200f", "image1": "https://raw.githubusercontent.com/paratuhogar/paratuhogar-fotos/main/img_productos/second.png", "image2": "third.png", "image3": ""},
            {"disponible": "NO", "thumbnail": "unavailable.png"},
            {"disponible": "SI", "thumbnail": "null", "image1": "undefined"}])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(set(self.manifest_data()), {"current.png", "second.png", "third.png"})
        self.assertEqual((self.root / "active.txt").read_text(), "current.png\nsecond.png\nthird.png\n")
        self.assertEqual(json.loads((self.root / "published-proof.json").read_text())["commit"], "a" * 40)

    def test_unchanged_proven_sources_do_not_need_original_downloads(self):
        self.verified(self.source())
        rows = [{"disponible": "SI", "thumbnail": "current.png"}]
        first = self.run_refresh(rows)
        self.assertEqual(first.returncode, 0, first.stderr)
        before = {path.name: path.stat().st_mtime_ns for path in self.output.iterdir()}
        (self.sources / "current.png").unlink()
        result = self.run_refresh(rows)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual({path.name: path.stat().st_mtime_ns for path in self.output.iterdir()}, before)

    def test_canonical_public_filename_wins_over_legacy_spaced_alias(self):
        self.verified(self.source(), self.source("cur rent.png", "blue"), self.source("old name.png"), self.source("oldname.png"))
        result = self.run_refresh([{"disponible": "SI", "thumbnail": "current.png"}])
        self.assertEqual(result.returncode, 0, result.stderr)
        proof = json.loads((self.root / "published-proof.json").read_text())
        self.assertEqual([row["path"] for row in proof["tree"]], ["img_productos/current.png"])
        self.assertEqual(set(self.manifest_data()), {"current.png"})

    def test_unverifiable_catalog_source_cannot_publish_a_manifest_or_proof(self):
        self.verified(self.source())
        for value in ("https://untrusted.example/current.png", "../current.png", "current.png?token=private", "%2e%2e%2fcurrent.png"):
            with self.subTest(value=value):
                result = self.run_refresh([{"disponible": "SI", "thumbnail": value}])
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.manifest.exists())
                self.assertFalse((self.root / "active.txt").exists())
                self.assertFalse((self.root / "published-proof.json").exists())


if __name__ == "__main__":
    unittest.main()
