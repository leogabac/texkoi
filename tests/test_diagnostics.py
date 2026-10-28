"""Verify line attribution against actual TeX compiler output."""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from render import CompileError, error_location, render

class DiagnosticTests(unittest.TestCase):
    def test_generated_and_external_diagnostics(self):
        self.assertIsNone(error_location('package.sty:2: Error', 'abc\n', 'x'))
        self.assertIsNone(error_location('./equation.tex:1: Error', 'abc\n', 'x'))

    def test_real_compiler_source_and_preamble(self):
        for source, preamble, expected in [
            ('\n\n x + \\badcommand', '\\usepackage{amsmath}\n', {'section': 'source', 'line': 3}),
            ('x', '\\usepackage{amsmath}\n\\badcommand\n', {'section': 'preamble', 'line': 2}),
        ]:
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as directory:
                try:
                    render(source, Path(directory), 'svg', preamble)
                except CompileError as error:
                    self.assertEqual(error.location, expected)
                else:
                    self.fail('Invalid LaTeX unexpectedly compiled')
