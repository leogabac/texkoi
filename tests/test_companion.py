from contextlib import ExitStack
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
        cls.server.settings_root = Path(cls.temp.name)/'settings'
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
            caught.exception.close()
        for headers in [{'X-TeXKoi': 'render', 'Origin': 'https://attacker.example'}, {}]:
            with self.assertRaises(HTTPError) as caught:
                urlopen(Request(self.base + '/render', data=b'{}', headers=headers), timeout=3)
            self.assertEqual(caught.exception.code, 403)
            caught.exception.close()
        with self.get(self.base + '/health') as response:
            self.assertTrue(json.load(response)['ok'])

    def test_open_preamble_rejects_foreign_origin_and_client_supplied_path(self):
        with patch('serve.open_preamble',return_value={'ok':True}) as opener:
            for headers,data in [({'X-TeXKoi':'open-preamble','Origin':'https://foreign.example'},b''),
                                 ({},b''),({'X-TeXKoi':'open-preamble'},b'{"path":"/other"}')]:
                with self.assertRaises(HTTPError) as caught:
                    urlopen(Request(self.base+'/open-preamble',data=data,headers=headers),timeout=3)
                self.assertIn(caught.exception.code,(400,403));caught.exception.close()
            opener.assert_not_called()
            with urlopen(Request(self.base+'/open-preamble',data=b'',headers={'X-TeXKoi':'open-preamble','Origin':self.origin}),timeout=3) as response:
                self.assertTrue(json.load(response)['ok'])
            opener.assert_called_once_with(self.server.settings_root)

    def test_clipboard_read_requires_authorization_and_empty_body(self):
        with patch('serve.read_system_clipboard', return_value='external text') as reader:
            for headers, data in [({'X-TeXKoi':'clipboard-read','Origin':'https://foreign.example'}, b''),
                                  ({}, b''), ({'X-TeXKoi':'clipboard-read'}, b'body')]:
                with self.assertRaises(HTTPError) as caught:
                    urlopen(Request(self.base+'/clipboard-read', data=data, headers=headers), timeout=3)
                self.assertIn(caught.exception.code, (400,403)); caught.exception.close()
            reader.assert_not_called()
            with urlopen(Request(self.base+'/clipboard-read', data=b'',
                    headers={'X-TeXKoi':'clipboard-read','Origin':self.origin}), timeout=3) as response:
                self.assertEqual(json.load(response)['text'], 'external text')
            reader.assert_called_once_with()

    def test_installed_editor_and_profile(self):
        with self.get(self.base + '/profile.js') as response:
            profile = response.read().decode()
            self.assertIn('"mode": "companion"', profile)
            self.assertNotIn('TeXKoi Dev', profile)
        with self.get(self.base + '/editor.html') as response:
            html = response.read()
            self.assertIn(b'href="wps-theme.css"', html)
            self.assertIn(b'aria-describedby="source-hint"></textarea>', html)

    def test_custom_preamble_snapshot_survives_changed_or_broken_user_configuration(self):
        from render import DEFAULT_PREAMBLE
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory)
            self.server.settings_root = settings
            try:
                (settings/'settings.json').write_text(json.dumps({'default_size_pt':32, 'default_format':'png', 'preamble_file':'custom.tex'}))
                original = r'\newcommand{\myvector}{\mathbf{v}}'
                (settings/'custom.tex').write_text(original)
                with self.get(self.base+'/settings') as response: configuration = json.load(response)
                self.assertEqual(configuration['default_size_pt'],32)
                self.assertEqual(configuration['default_format'],'png')
                saved = configuration['preamble']
                self.assertEqual(saved,DEFAULT_PREAMBLE+original)
                (settings/'custom.tex').write_text(r'\newcommand{\myvector}{\mathbf{w}}')
                for fmt in ['svg','png']:
                    data=json.dumps({'source':r'\myvector', 'format':fmt, 'preamble':saved}).encode()
                    with urlopen(Request(self.base+'/render',data=data,headers={'X-TeXKoi':'render'}),timeout=40) as response: result=json.load(response)
                    self.assertEqual(result['preamble'],saved)
                    self.assertIn(original,Path(result['path']).with_suffix('.tex').read_text())
                (settings/'settings.json').write_text('{broken')
                with self.assertRaises(HTTPError) as caught: self.get(self.base+'/settings')
                self.assertEqual(caught.exception.code,400);caught.exception.close()
                # Old equations must still render with their saved preamble even
                # when today's preferences are invalid or the file is missing.
                data=json.dumps({'source':r'\myvector','preamble':saved}).encode()
                with urlopen(Request(self.base+'/render',data=data,headers={'X-TeXKoi':'render'}),timeout=40) as response:
                    self.assertEqual(json.load(response)['preamble'],saved)
                data=json.dumps({'source':r'\alpha','preamble':DEFAULT_PREAMBLE}).encode()
                with urlopen(Request(self.base+'/render',data=data,headers={'X-TeXKoi':'render'}),timeout=40) as response:
                    self.assertEqual(json.load(response)['preamble'],DEFAULT_PREAMBLE)
            finally:
                self.server.settings_root=Path(self.temp.name)/'settings'

    def test_corrected_source_with_trailing_newlines_after_compile_failure(self):
        source = r"F_t(x)=\int_{-\infty}^x p_t(x')dx'."
        for fmt in ['svg', 'png']:
            def compile(fragment):
                payload = json.dumps({'source': fragment, 'format': fmt}).encode()
                return urlopen(Request(self.base + '/render', data=payload,
                    headers={'X-TeXKoi': 'render', 'Content-Type': 'application/json'}), timeout=40)
            with self.assertRaises(HTTPError) as caught:
                compile(r'\undefinedTeXKoiCommand')
            self.assertEqual(caught.exception.code, 400)
            self.assertIn('Undefined control sequence', json.load(caught.exception)['error'])
            caught.exception.close()
            with compile('\n  ' + source + '\n\n \t') as response:
                result = json.load(response)
            self.assertGreater(result['width'], 0)
            document = Path(result['path']).with_suffix('.tex').read_text()
            self.assertIn(source + '\n$\n', document)
            self.assertNotIn(source + '\n\n', document)

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
    def environment(self, root):
        home = root / 'companion'
        wps = root / 'wps'; wps.mkdir()
        publish = wps / 'publish.xml'
        publish.write_text('<jsplugins><jspluginonline name="Other" url="https://example.org"/><jspluginonline name="TeXKoi Dev" url="http://127.0.0.1:3899/"/></jsplugins>')
        app = root / 'apps/companion.desktop'; app.parent.mkdir()
        app.write_text('original application entry')
        stack = ExitStack()
        stack.enter_context(patch.multiple(installer, DATA=root/'data', HOME=home, CONFIG=home/'config.json',
                            STATE=home/'installation.json', APP=app, AUTOSTART=root/'autostart/companion.desktop',
                            WPS=wps, PUBLISH=publish))
        stack.enter_context(patch.object(installer, 'dependency_errors', return_value=[]))
        stack.enter_context(patch.object(installer, 'ensure_settings'))
        stack.enter_context(patch.object(installer, 'running', return_value=False))
        stack.enter_context(patch.object(installer, 'stop'))
        return stack, home, wps, publish, app

    def test_fresh_install_idempotence_and_restore_preserve_other_addins(self):
        import xml.etree.ElementTree as ET
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            stack, home, wps, publish, app = self.environment(Path(directory))
            with stack, patch.object(installer, 'start'):
                installer.install()
                package = wps / ('TeXKoi_' + installer.VERSION)
                self.assertIn('editorBase', (package/'profile.js').read_text())
                self.assertEqual((home/'config.json').stat().st_mode & 0o777, 0o600)
                before = publish.read_bytes()
                installer.install()
                self.assertEqual(before, publish.read_bytes())
                root = ET.parse(publish).getroot()
                ET.SubElement(root, 'jspluginonline', name='Added later', url='https://later.example')
                ET.ElementTree(root).write(publish)
                (package/'user-file.txt').write_text('keep')
                installer.restore()
                self.assertEqual([e.get('name') for e in ET.parse(publish).getroot()],
                                 ['Other', 'TeXKoi Dev', 'Added later'])
                self.assertFalse((package/'profile.js').exists())
                self.assertEqual((package/'user-file.txt').read_text(), 'keep')
                self.assertEqual(app.read_text(), 'original application entry')

    def test_user_configuration_survives_install_reinstall_and_uninstall(self):
        from settings import ensure_settings
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root=Path(directory)
            stack,home,wps,publish,app=self.environment(root)
            preferences=root/'preferences'
            with stack, patch.object(installer,'start'), patch.object(installer,'ensure_settings',side_effect=lambda:ensure_settings(preferences)):
                installer.install()
                (preferences/'preamble.tex').write_text(r'\newcommand{\custom}{x}')
                installer.install()
                self.assertEqual((preferences/'preamble.tex').read_text(),r'\newcommand{\custom}{x}')
                self.assertTrue((home/'scripts/settings.py').is_file())
                with patch.object(sys,'argv',['install','uninstall']):
                    self.assertEqual(installer.main(),0)
                self.assertFalse(home.exists())
                self.assertEqual((preferences/'preamble.tex').read_text(),r'\newcommand{\custom}{x}')
                self.assertTrue((preferences/'settings.json').is_file())

    def test_refresh_updates_same_version_and_preserves_uninstall_baseline(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            stack,home,wps,publish,app=self.environment(Path(directory))
            with stack,patch.object(installer,'start'):
                installer.install()
                package=wps/('TeXKoi_'+installer.VERSION)
                original_state=json.loads(installer.STATE.read_text())
                (package/'main.js').write_text('outdated')
                installer.install()
                self.assertEqual((package/'main.js').read_text(),'outdated')
                installer.install(refresh=True)
                self.assertEqual((package/'main.js').read_text(),(ROOT/'addin/main.js').read_text())
                self.assertEqual(json.loads(installer.STATE.read_text())['files'],original_state['files'])
                installer.restore()
                self.assertFalse((package/'main.js').exists())
                self.assertEqual(app.read_text(),'original application entry')

    def test_failed_start_rolls_back_without_registration_or_autostart_changes(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            stack, home, wps, publish, app = self.environment(Path(directory))
            with stack, patch.object(installer, 'start', side_effect=RuntimeError('occupied port')):
                before = publish.read_bytes()
                with self.assertRaisesRegex(RuntimeError, 'occupied port'): installer.install()
                self.assertEqual(before, publish.read_bytes())
                self.assertFalse(home.exists())
                self.assertFalse(installer.AUTOSTART.exists())
                self.assertEqual(app.read_text(), 'original application entry')

    def test_upgrade_from_prototype_keeps_token_and_original_backups(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            stack, home, wps, publish, app = self.environment(Path(directory))
            with stack, patch.object(installer, 'start'):
                home.mkdir()
                token = 'c'*64
                installer.CONFIG.write_text(json.dumps({'token': token, 'port': 3901}))
                old = wps/'TeXKoi_0.0.1'; old.mkdir()
                (old/'main.js').write_text('working prototype')
                baseline = installer.snapshot(old/'main.js')
                installer.STATE.write_text(json.dumps({'package':str(old), 'files':{str(old/'main.js'):baseline}}))
                installer.install()
                self.assertEqual(json.loads(installer.CONFIG.read_text())['token'], token)
                state = json.loads(installer.STATE.read_text())
                self.assertEqual(state['files'][str(old/'main.js')], baseline)
                self.assertEqual(state['version'], installer.VERSION)

    def test_malformed_publish_file_is_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            stack, home, wps, publish, app = self.environment(Path(directory))
            with stack, patch.object(installer, 'start') as start:
                publish.write_text('<broken')
                import xml.etree.ElementTree as ET
                with self.assertRaises(ET.ParseError): installer.install()
                self.assertEqual(publish.read_text(), '<broken')
                start.assert_not_called()
                self.assertFalse(home.exists())


if __name__ == '__main__': unittest.main()
