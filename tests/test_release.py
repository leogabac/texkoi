import contextlib
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_release import build


class ReleaseTests(unittest.TestCase):
    def test_reproducible_bundle_manifest_and_runtime_contents(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root = Path(directory)
            first, second = build(root/'first'), build(root/'second')
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with tarfile.open(first) as tar:
                members = tar.getmembers()
                self.assertTrue(all(m.isfile() and not m.issym() for m in members))
                files = {m.name.split('/',1)[1]: tar.extractfile(m).read() for m in members}
                manifest = json.loads(files['manifest.json'])
                for name, digest in manifest['sha256'].items():
                    self.assertEqual(hashlib.sha256(files[name]).hexdigest(), digest)
                self.assertEqual(set(files), set(manifest['sha256']) | {'manifest.json'})
                self.assertEqual(files['VERSION'].decode().strip(), (Path(__file__).resolve().parents[1]/'VERSION').read_text().strip())
                self.assertIn('scripts/local_registration.py', files)
                self.assertIn('install', files)
                self.assertFalse(any('probe' in name or 'diagnostics' in name or '__pycache__' in name for name in files))
                self.assertNotIn('config.json', files)
                self.assertNotIn('ROADMAP.local.md', files)
                self.assertIn('addin/connection.html', files)
                self.assertIn('addin/connection.js', files)
                install = next(m for m in members if m.name.endswith('/install'))
                self.assertEqual(install.mode, 0o755)


if __name__ == '__main__': unittest.main()
