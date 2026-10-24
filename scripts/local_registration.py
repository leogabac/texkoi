"""Edit only the regular TeXKoi registration, preserving other WPS add-ins."""
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET


def read(path):
    path = Path(path)
    root = ET.fromstring(path.read_bytes()) if path.exists() else ET.Element('jsplugins')
    if root.tag != 'jsplugins': raise ValueError('Unexpected publish.xml root; leaving it untouched')
    return root


def entries(path):
    return [ET.tostring(e, encoding='unicode') for e in read(path) if e.get('name') == 'TeXKoi']


def replace(path, records):
    path = Path(path)
    root = read(path)
    owned = [e for e in root if e.get('name') == 'TeXKoi']
    new = [ET.fromstring(record) for record in records]
    if any(e.get('name') != 'TeXKoi' for e in new): raise ValueError('Invalid TeXKoi registration record')
    if [ET.tostring(e) for e in owned] == [ET.tostring(e) for e in new]: return
    index = list(root).index(owned[0]) if owned else len(root)
    for e in owned: root.remove(e)
    for offset, e in enumerate(new): root.insert(index + offset, e)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        path.with_name('publish.xml.texkoi-' + stamp + '.bak').write_bytes(path.read_bytes())
    temporary = path.with_suffix('.xml.texkoi.tmp')
    ET.ElementTree(root).write(temporary, encoding='utf-8', xml_declaration=True)
    temporary.replace(path)


def install(path, package, version):
    entry = ET.Element('jsplugin', name='TeXKoi', type='wpp', version=version,
                       url=Path(package).resolve().as_uri() + '/', install='null',
                       versionUrl='', enable='enable_dev', customDomain='')
    replace(path, [ET.tostring(entry, encoding='unicode')])
