"""Register/unregister this development add-in without removing other add-ins."""
import argparse
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("action", choices=("install", "uninstall"))
args = parser.parse_args()
path = Path.home() / ".local/share/Kingsoft/wps/jsaddons/publish.xml"
if path.exists():
    root = ET.fromstring(path.read_bytes())
    if root.tag != "jsplugins":
        raise SystemExit("Unexpected publish.xml root; leaving it untouched")
    backup = path.with_name("publish.xml.texkoi-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f") + ".bak")
    backup.write_bytes(path.read_bytes())
    print("Backup:", backup)
else:
    root = ET.Element("jsplugins")
for child in list(root):
    if child.get("name") in ("TexKoi", "IguanaButtonProbe"):
        root.remove(child)
if args.action == "install":
    ET.SubElement(root, "jspluginonline", name="TexKoi", type="wpp",
                  url="http://127.0.0.1:3899/", enable="enable_dev", debug="", install="null")
path.parent.mkdir(parents=True, exist_ok=True)
temporary = path.with_suffix(".xml.tmp")
ET.ElementTree(root).write(temporary, encoding="utf-8", xml_declaration=True)
temporary.replace(path)
print("Updated:", path)
print("Restart WPS to apply the change.")
