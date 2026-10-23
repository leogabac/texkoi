from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from theme import wps_mode, theme_css

class ThemeTests(unittest.TestCase):
    def test_wps_skin_and_system_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "Kingsoft" / "Office.conf"
            config.parent.mkdir()
            for skin, expected in (("2018white_dark", "dark"), ("2019white", "light")):
                config.write_text("[6.0]\nplugins\\kskincenter\\users\\curId=default\nplugins\\kskincenter\\users\\default\\wpsoffice\\lastSkin=" + skin)
                self.assertEqual(wps_mode(directory), expected)
                self.assertIn("color-scheme:" + expected, theme_css(directory))
            config.write_text("[6.0]\nplugins\\kskincenter\\followSystem=true\n")
            self.assertIn("prefers-color-scheme:dark", theme_css(directory))
            config.write_text("[invalid")
            self.assertIsNone(wps_mode(directory))
