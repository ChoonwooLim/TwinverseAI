"""Regression checks for stale browser chunks and safe SPA fallback."""
import os
from pathlib import Path
import tempfile
import time
import unittest

from frontend_static import FrontendStatic


class FrontendStaticTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.static = self.root / "static"
        self.assets = self.static / "assets"
        self.assets.mkdir(parents=True)
        (self.static / "index.html").write_text("<html>app</html>")
        (self.assets / "index-abcdefgh.js").write_text("export const current = 1;")
        self.archive = self.root / "uploads" / ".frontend-assets"
        self.frontend = FrontendStatic(self.static, self.archive)

    def test_missing_script_is_not_spa_html_and_cannot_be_cached(self):
        for path in ("assets/index-missing1.js", "assets/missing.css", "missing.js", "api/missing"):
            with self.subTest(path=path):
                result = self.frontend.resolve(path)
                self.assertIsNone(result.path)
                self.assertIn("no-store", result.cache_control)

    def test_html_and_spa_routes_are_never_cached(self):
        for path in ("", "index.html", "admin/openclaw", "twinversedesk/plan"):
            with self.subTest(path=path):
                result = self.frontend.resolve(path)
                self.assertEqual(result.path, self.static / "index.html")
                self.assertIn("no-store", result.cache_control)
                self.assertIn("no-cache", result.cache_control)

    def test_only_content_hashed_assets_get_immutable_caching(self):
        (self.assets / "runtime.js").write_text("unhashed")
        (self.static / "favicon.svg").write_text("<svg/>")
        hashed = self.frontend.resolve("assets/index-abcdefgh.js")
        self.assertEqual(hashed.path.read_text(), "export const current = 1;")
        self.assertIn("immutable", hashed.cache_control)
        for path in ("assets/runtime.js", "favicon.svg"):
            self.assertNotIn("immutable", self.frontend.resolve(path).cache_control)

    def test_previous_deployment_chunk_survives_current_build_replacement(self):
        self.frontend.archive_current_assets()
        (self.assets / "index-abcdefgh.js").unlink()
        (self.assets / "index-ijklmnop.js").write_text("new build")
        self.frontend.archive_current_assets()
        result = self.frontend.resolve("assets/index-abcdefgh.js")
        self.assertEqual(result.path, self.archive / "index-abcdefgh.js")
        self.assertEqual(result.path.read_text(), "export const current = 1;")
        self.assertIn("immutable", result.cache_control)

    def test_nested_release_assets_keep_their_url_path_after_deployment(self):
        release = self.assets / "releases-v2"
        release.mkdir()
        chunk = release / "AdminOpenClawOverview-D064W-Nw.js"
        chunk.write_text("export default 'old release';")
        self.frontend.archive_current_assets()
        chunk.unlink()
        result = self.frontend.resolve("assets/releases-v2/AdminOpenClawOverview-D064W-Nw.js")
        self.assertEqual(result.path, self.archive / "releases-v2" / chunk.name)
        self.assertEqual(result.path.read_text(), "export default 'old release';")

    def test_current_build_takes_priority_over_archived_asset(self):
        self.frontend.archive_current_assets()
        (self.assets / "index-abcdefgh.js").write_text("current build")
        result = self.frontend.resolve("assets/index-abcdefgh.js")
        self.assertEqual(result.path, self.assets / "index-abcdefgh.js")
        self.assertEqual(result.path.read_text(), "current build")

    def test_archive_copies_only_hashed_build_assets_and_refreshes_age(self):
        (self.assets / "runtime.js").write_text("unhashed")
        (self.assets / "index-abcdefgh.js.map").write_text("source map")
        (self.assets / "page-abcdefgh.html").write_text("html")
        old = time.time() - 40 * 86400
        os.utime(self.assets / "index-abcdefgh.js", (old, old))
        self.frontend.archive_current_assets()
        self.assertEqual({p.name for p in self.archive.iterdir()}, {"index-abcdefgh.js"})
        self.assertGreater((self.archive / "index-abcdefgh.js").stat().st_mtime, old)

    def test_expired_archive_is_not_served_and_is_pruned_without_touching_uploads(self):
        self.archive.mkdir(parents=True)
        expired = self.archive / "index-oldhash1.js"
        expired.write_text("expired")
        old = time.time() - 31 * 86400
        os.utime(expired, (old, old))
        upload = self.archive.parent / "photo.jpg"
        upload.write_text("user upload")
        self.assertIsNone(self.frontend.resolve("assets/index-oldhash1.js").path)
        self.frontend.archive_current_assets()
        self.assertFalse(expired.exists())
        self.assertEqual(upload.read_text(), "user upload")

    def test_paths_cannot_escape_static_roots_or_expose_hidden_files(self):
        (self.root / "secret.txt").write_text("secret")
        (self.static / ".env").write_text("secret")
        for path in ("../secret.txt", "assets/../../secret.txt", "/secret.txt", "assets\\..\\secret.txt", ".env", "assets/.hidden.js", "C:/secret.txt"):
            with self.subTest(path=path):
                self.assertIsNone(self.frontend.resolve(path).path)

    def test_symlink_outside_static_root_is_not_served_or_archived(self):
        secret = self.root / "secret.js"
        secret.write_text("secret")
        link = self.assets / "outside-abcdefgh.js"
        try:
            link.symlink_to(secret)
        except OSError:
            self.skipTest("Creating symlinks is not permitted on this host")
        self.assertIsNone(self.frontend.resolve("assets/outside-abcdefgh.js").path)
        self.frontend.archive_current_assets()
        self.assertFalse((self.archive / link.name).exists())

    def test_archive_directory_symlink_cannot_read_or_write_outside_archive(self):
        outside = self.root / "outside"
        outside.mkdir()
        (outside / "index-oldhash1.js").write_text("outside archive")
        self.archive.parent.mkdir()
        try:
            self.archive.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("Creating symlinks is not permitted on this host")
        self.assertIsNone(self.frontend.resolve("assets/index-oldhash1.js").path)
        with self.assertRaises(ValueError):
            self.frontend.archive_current_assets()
        self.assertFalse((outside / "index-abcdefgh.js").exists())


if __name__ == "__main__":
    unittest.main()
