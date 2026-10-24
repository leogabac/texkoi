import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import companion
import companion_install as installer

ROOT = Path(__file__).resolve().parents[1]


class CompanionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.token = 'a' * 64
        cls.server = companion.make_server({'token': cls.token, 'port': 0}, ROOT / 'addin', cls.temp.name)
        cls.origin = cls.server.origin
        cls.base = cls.origin + '/' + cls.token
        cls.worker = threading.Thread(target=cls.server.serve_forever)
        cls.worker.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.worker.join(); cls.server.server_close(); cls.temp.cleanup()

    def get(self, url, **headers):
        return urlopen(Request(url, headers=headers), timeout=40)

    def test_private_routes_host_and_origin_checks(self):
        for url, headers, code in [
            (self.origin + '/health', {}, 404),
            (self.origin + '/' + 'b'*64 + '/health', {}, 404),
            (self.base + '/health', {'Host': 'attacker.example'}, 403),
        ]:
            with self.assertRaises(HTTPError) as caught: self.get(url, **headers)
            self.assertEqual(caught.exception.code, code)
        for headers in [{'X-TeXKoi': 'render', 'Origin': 'https://attacker.example'}, {}]:
            with self.assertRaises(HTTPError) as caught:
                urlopen(Request(self.base + '/render', data=b'{}', headers=headers), timeout=3)
            self.assertEqual(caught.exception.code, 403)
        with self.get(self.base + '/health') as response:
            self.assertTrue(json.load(response)['ok'])

    def test_installed_editor_and_profile(self):
        with self.get(self.base + '/profile.js') as response:
            profile = response.read().decode()
            self.assertIn('"mode": "companion"', profile)
            self.assertNotIn('TeXKoi Dev', profile)
        with self.get(self.base + '/editor.html') as response:
            self.assertIn(b'href="wps-theme.css"', response.read())

    def test_real_render_and_image_fetch(self):
        for fmt in ['svg', 'png']:
            payload = json.dumps({'source': r'\frac{\alpha}{2} = x^2', 'format': fmt}).encode()
            req = Request(self.base + '/render', data=payload,
                          headers={'X-TeXKoi': 'render', 'Content-Type': 'application/json', 'Origin': self.origin})
            with urlopen(req, timeout=40) as response: result = json.load(response)
            self.assertGreater(result['width'], 0)
            self.assertGreater(result['height'], 0)
            self.assertTrue(result['url'].startswith('/' + self.token + '/renders/'))
            with self.get(self.origin + result['url']) as response:
                content = response.read()
                self.assertTrue(content.startswith(b'\x89PNG') if fmt == 'png' else b'<svg' in content)
            self.assertTrue(Path(result['path']).is_file())


class InstallerTests(unittest.TestCase):
    def test_install_and_restore_preserve_original_files(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root = Path(directory)
            home = root / 'companion'
            package = root / 'package'; package.mkdir()
            (package / 'main.js').write_text('original probe')
            (package / 'unrelated.txt').write_text('keep')
            app = root / 'apps/companion.desktop'; app.parent.mkdir()
            app.write_text('original application entry')
            with patch.multiple(installer, DATA=root/'data', HOME=home, CONFIG=home/'config.json',
                                STATE=home/'installation.json', APP=app, AUTOSTART=root/'autostart/companion.desktop'), \
                 patch.object(installer, 'installed_package', return_value=package), \
                 patch.object(installer, 'dependency_errors', return_value=[]), \
                 patch.object(installer, 'start'):
                installer.install()
                self.assertIn('editorBase', (package / 'profile.js').read_text())
                self.assertIn('Exec=', app.read_text())
                self.assertEqual((home/'config.json').stat().st_mode & 0o777, 0o600)
                installer.restore()
                self.assertEqual((package/'main.js').read_text(), 'original probe')
                self.assertEqual((package/'unrelated.txt').read_text(), 'keep')
                self.assertFalse((package/'profile.js').exists())
                self.assertEqual(app.read_text(), 'original application entry')


if __name__ == '__main__': unittest.main()
