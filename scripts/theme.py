"""Read WPS Linux skin preference without modifying its configuration."""
import configparser
import os
from pathlib import Path

LIGHT = {"page":"#ffffff", "text":"#262626", "muted":"#707070", "border":"#d4d4d4", "field":"#f8f8f8", "hover":"#eeeeee", "accent":"#1e74ff", "accent-hover":"#1664df", "focus":"#90baff", "error":"#b33232", "error-bg":"#fff3f3"}
DARK = {"page":"#262626", "text":"#f5f5f5", "muted":"#b3b3b3", "border":"#505050", "field":"#333333", "hover":"#414141", "accent":"#1e74ff", "accent-hover":"#438aff", "focus":"#75aaff", "error":"#ffaaaa", "error-bg":"#442e2e"}

def wps_mode(config_root=None):
    root = Path(config_root) if config_root else Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    for filename in ("Office.conf", "office.conf"):
        parser = configparser.ConfigParser(interpolation=None, strict=False)
        parser.optionxform = str
        try:
            with (root / "Kingsoft" / filename).open() as stream:
                parser.read_file(stream)
            for section in parser.sections():
                values = parser[section]
                prefix = "plugins\\kskincenter\\"
                if values.get(prefix + "followSystem", "").lower() == "true":
                    return None
                user = values.get(prefix + "users\\curId", "default")
                for component in ("wpsoffice", "wpp"):
                    skin = values.get(prefix + "users\\" + user + "\\" + component + "\\lastSkin", "").lower()
                    if "dark" in skin: return "dark"
                    if "white" in skin or "light" in skin: return "light"
        except (OSError, configparser.Error, UnicodeError):
            continue
    return None

def variables(mode):
    colors = DARK if mode == "dark" else LIGHT
    return "color-scheme:" + mode + ";" + "".join("--" + key + ":" + value + ";" for key, value in colors.items())

def theme_css(config_root=None):
    mode = wps_mode(config_root)
    if mode:
        return ":root{" + variables(mode) + "}"
    return ":root{" + variables("light") + "}@media(prefers-color-scheme:dark){:root{" + variables("dark") + "}}"
