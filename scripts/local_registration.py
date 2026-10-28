"""Edit only the regular TeXKoi registration, preserving other WPS add-ins."""
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET
import json
import subprocess


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


def stale_trust_records(data, package):
    records = data.get('wpp', {})
    if not isinstance(records, dict): raise ValueError('Unexpected WPS trust record format')
    return [key for key, value in records.items()
            if isinstance(value, dict) and value.get('name') == 'TeXKoi'
            and value.get('path', '').rstrip('/') != str(package).rstrip('/')]


def trust_status(directory, package):
    path = Path(directory) / 'authaddin.json'
    if not path.exists(): return 0
    return len(stale_trust_records(json.loads(path.read_text()), package))


def document_hosts_running():
    processes = subprocess.check_output(['ps', '-eo', 'comm=,args='], text=True).splitlines()
    for process in processes:
        fields = process.strip().split(None, 1)
        if not fields: continue
        name, args = fields[0], fields[1] if len(fields) > 1 else ''
        # The qing cloud browser is independent of the WPS document hosts.
        cloud_browser = name == 'wpsoffice' and '/addons/kcef/libjsapibrowser.so' in args and '--from=qing' in args
        if name in {'wps', 'wpp', 'et', 'wpsoffice'} and not cloud_browser: return True
    return False


def repair_trust(directory, package):
    directory = Path(directory)
    path = directory / 'authaddin.json'
    if not path.exists(): return 0
    if document_hosts_running():
        raise ValueError('Save your work and fully quit WPS before running repair-trust. No trust records were changed.')
    original = path.read_bytes()
    data = json.loads(original)
    stale = stale_trust_records(data, package)
    if not stale: return 0
    records = data['wpp']
    for key in stale: del records[key]
    if isinstance(records.get('namelist'), str):
        records['namelist'] = ';'.join(key for key in records['namelist'].split(';') if key not in stale)
    if path.read_bytes() != original:
        raise ValueError('WPS trust records changed during inspection; try again with WPS closed.')
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup = path.with_name('authaddin.json.texkoi-' + stamp + '.bak')
    with backup.open('xb') as stream:
        backup.chmod(0o600)
        stream.write(original)
    temporary = path.with_name('authaddin.json.texkoi.tmp')
    with temporary.open('x') as stream:
        temporary.chmod(0o600)
        stream.write(json.dumps(data, indent=4) + '\n')
    temporary.replace(path)
    # Never manufacture enable flags, hashes, or approval for the current add-in.
    # WPS must request and persist its own approval when the user next opens it.
    return len(stale)
