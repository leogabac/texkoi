"""Register/unregister TeXKoi without removing other add-ins."""
import argparse
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

NAMES = ("TeXKoi Dev", "TeXKoi", "TexKoi", "IguanaButtonProbe")
ATTRIBUTES = dict(name="TeXKoi Dev", type="wpp", url="http://127.0.0.1:3899/",
                  enable="enable_dev", debug="", install="null")

def register(action, path=None):
    path = Path(path) if path is not None else Path.home() / ".local/share/Kingsoft/wps/jsaddons/publish.xml"
    original = path.read_bytes() if path.exists() else None
    root = ET.fromstring(original) if original is not None else ET.Element("jsplugins")
    if root.tag != "jsplugins":
        raise ValueError("Unexpected publish.xml root; leaving it untouched")
    owned = [child for child in root if child.get("name") == "TeXKoi Dev" or (
        child.get("name") in NAMES and child.tag == "jspluginonline"
        and child.get("url") == ATTRIBUTES["url"])]
    if action == "install" and len(owned) == 1 and owned[0].tag == "jspluginonline" and owned[0].attrib == ATTRIBUTES:
        print("TeXKoi Dev is already registered.")
        return False
    if action == "uninstall" and not owned:
        print("TeXKoi Dev is not registered.")
        return False
    if action not in ("install", "uninstall"):
        raise ValueError("Choose install or uninstall")
    for child in owned:
        root.remove(child)
    if action == "install":
        ET.SubElement(root, "jspluginonline", ATTRIBUTES)
    path.parent.mkdir(parents=True, exist_ok=True)
    if original is not None:
        backup = path.with_name("publish.xml.texkoi-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f") + ".bak")
        backup.write_bytes(original)
        print("Backup:", backup)
    temporary = path.with_suffix(".xml.tmp")
    ET.ElementTree(root).write(temporary, encoding="utf-8", xml_declaration=True)
    temporary.replace(path)
    print("Updated:", path)
    print("Restart WPS to apply the change.")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("install", "uninstall"))
    register(parser.parse_args().action)
