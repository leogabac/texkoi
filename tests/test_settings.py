import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch, Mock
import subprocess
import time

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from settings import ensure_settings, load_settings, open_preamble
from render import DEFAULT_PREAMBLE, validate_preamble


class SettingsTests(unittest.TestCase):
    def test_missing_settings_keep_legacy_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            settings=load_settings(directory)
            self.assertEqual(settings['default_size_pt'],28)
            self.assertEqual(settings['default_format'],'svg')
            self.assertFalse(settings['vim_mode'])
            self.assertEqual(settings['preamble'],DEFAULT_PREAMBLE)
            self.assertEqual(list(Path(directory).iterdir()),[])

    def test_initialization_and_user_files_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            ensure_settings(root)
            custom={'default_size_pt':36.5,'default_format':'png','preamble_file':'preamble.tex','vim_mode':True}
            (root/'settings.json').write_text(json.dumps(custom))
            macro=r'\newcommand{\vect}[1]{\mathbf{#1}}'
            (root/'preamble.tex').write_text(macro)
            self.assertEqual(ensure_settings(root)['preamble'],DEFAULT_PREAMBLE+macro)
            self.assertTrue(load_settings(root)['vim_mode'])
            self.assertEqual(json.loads((root/'settings.json').read_text()),custom)
            (root/'preamble.tex').write_text('% changed file\n'+macro)
            self.assertIn('% changed file',load_settings(root)['preamble'])

    def test_invalid_settings_and_missing_file_have_clear_errors(self):
        invalid=[([], 'JSON object'),({'unknown':True},'Unknown'),({'default_size_pt':True},'default_size_pt'),
                 ({'default_size_pt':150},'default_size_pt'),({'default_size_pt':10**1000},'default_size_pt'),({'default_size_pt':float('nan')},'default_size_pt'),
                 ({'default_format':'pdf'},'default_format'),({'vim_mode':'true'},'vim_mode'),({'preamble_file':''},'preamble_file'),
                 ({'preamble_file':'missing.tex'},'Cannot read TeXKoi preamble')]
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for data,message in invalid:
                (root/'settings.json').write_text(json.dumps(data))
                with self.subTest(data=data),self.assertRaisesRegex(ValueError,message): load_settings(root)
            (root/'settings.json').write_text('{broken')
            with self.assertRaisesRegex(ValueError,'Cannot read TeXKoi settings'):load_settings(root)

    def test_open_preamble_uses_desktop_default_or_configured_argument_array(self):
        with tempfile.TemporaryDirectory(prefix='tex koi ') as directory:
            root=Path(directory);preamble=root/'custom file.tex'
            # An invalid LaTeX preamble must still be openable for correction.
            preamble.write_text(r'\begin{document}')
            config={'preamble_file':preamble.name}
            (root/'settings.json').write_text(json.dumps(config))
            process=Mock();process.wait.return_value=0
            with patch('settings.subprocess.Popen',return_value=process) as launch:
                self.assertEqual(open_preamble(root),{'ok':True})
                self.assertEqual(launch.call_args.args[0],['xdg-open',str(preamble)])
                config['editor_command']=['kitty','-e','nvim','--nofork']
                (root/'settings.json').write_text(json.dumps(config))
                open_preamble(root)
                self.assertEqual(launch.call_args.args[0],['kitty','-e','nvim','--nofork',str(preamble)])
                self.assertTrue(launch.call_args.kwargs['start_new_session'])
                self.assertNotIn('shell',launch.call_args.kwargs)

    def test_open_preamble_starts_the_real_configured_process_with_exact_path(self):
        with tempfile.TemporaryDirectory(prefix='tex koi ') as directory:
            root=Path(directory); preamble=root/'preamble; example.tex'
            preamble.write_text('% example')
            marker=root/'opened.txt'; editor=root/'editor.py'
            editor.write_text('import pathlib,sys\npathlib.Path(sys.argv[1]).write_text(sys.argv[2])\n')
            (root/'settings.json').write_text(json.dumps({'preamble_file':preamble.name,
                'editor_command':[sys.executable,str(editor),str(marker)]}))
            self.assertEqual(open_preamble(root),{'ok':True})
            for _ in range(20):
                if marker.exists():break
                time.sleep(.05)
            self.assertEqual(marker.read_text(),str(preamble))

    def test_open_preamble_errors_are_reported_without_running_another_command(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);path=root/'settings.json'
            cases=[({'preamble_file':None},'No preamble file'),
                   ({'preamble_file':'missing-dir/a.tex'},'directory does not exist'),
                   ({'preamble_file':'p.tex','editor_command':'nvim'},'editor_command'),
                   ({'preamble_file':'p.tex','editor_command':[]},'editor_command'),
                   ({'preamble_file':'p.tex','editor_command':['bad\x00command']},'editor_command')]
            for config,message in cases:
                path.write_text(json.dumps(config))
                with patch('settings.subprocess.Popen') as launch:
                    with self.assertRaisesRegex(ValueError,message):open_preamble(root)
                    launch.assert_not_called()
            path.write_text(json.dumps({'preamble_file':'p.tex'}))
            with patch('settings.subprocess.Popen',side_effect=FileNotFoundError('missing opener')):
                with self.assertRaisesRegex(ValueError,'Could not start the editor'):open_preamble(root)
            process=Mock();process.wait.return_value=2
            with patch('settings.subprocess.Popen',return_value=process):
                with self.assertRaisesRegex(ValueError,'exit 2'):open_preamble(root)
            process.wait.side_effect=subprocess.TimeoutExpired('editor',0.25)
            with patch('settings.subprocess.Popen',return_value=process):
                self.assertEqual(open_preamble(root),{'ok':True})

    def test_preamble_validation_checks_document_boundaries_and_utf16_limit(self):
        for preamble in [None,'a'*20001,'😀'*10001,r'\documentclass{article}',r'\begin{document}',r'\end{document}']:
            with self.subTest(preamble=str(preamble)[:30]),self.assertRaises(ValueError):validate_preamble(preamble)
        self.assertEqual(validate_preamble('% \\documentclass{article}\n'+DEFAULT_PREAMBLE), '% \\documentclass{article}\n'+DEFAULT_PREAMBLE)
        self.assertEqual(validate_preamble(''), '')


if __name__=='__main__':unittest.main()
