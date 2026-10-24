import contextlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from launcher import dependency_errors, main
from register import register

class SetupTests(unittest.TestCase):
    def test_registration_preserves_other_addins_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            path = Path(directory) / "publish.xml"
            original = b'<jsplugins><jspluginonline name="Other" url="https://example.org"/><jsplugin name="TeXKoi" url="file:///installed/TeXKoi_0.1.0/"/><jspluginonline name="TexKoi" url="http://127.0.0.1:3899/"/></jsplugins>'
            path.write_bytes(original)
            self.assertTrue(register("install", path))
            installed = path.read_bytes()
            self.assertFalse(register("install", path))
            self.assertEqual(path.read_bytes(), installed)
            backups = list(path.parent.glob("*.bak"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), original)
            self.assertTrue(register("uninstall", path))
            self.assertEqual([x.get("name") for x in ET.parse(path).getroot()], ["Other", "TeXKoi"])
            self.assertFalse(register("uninstall", path))

    def test_malformed_configuration_is_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "publish.xml"
            for content in (b'<broken', b'<unexpected/>'):
                path.write_bytes(content)
                with self.assertRaises((ValueError, ET.ParseError)):
                    register("install", path)
                self.assertEqual(path.read_bytes(), content)

    def test_missing_dependencies_are_reported_before_startup(self):
        with patch("launcher.shutil.which", return_value=None), patch("launcher.run") as run:
            errors = dependency_errors()
            self.assertTrue(any("latex" in item for item in errors))
            self.assertTrue(any("wpp" in item for item in errors))
            with contextlib.redirect_stderr(io.StringIO()) as output:
                self.assertEqual(main([]), 1)
            self.assertIn("Missing executable", output.getvalue())
            run.assert_not_called()

if __name__ == "__main__":
    unittest.main()
