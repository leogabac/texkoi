"""Install/remove the temporary Linux URI probe; preserve prior registrations."""
from pathlib import Path
import base64
import json
import os
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share')))
CACHE = Path(os.environ.get('XDG_CACHE_HOME', str(Path.home() / '.cache')))
OWN = DATA / 'texkoi/protocol-probe'
STATE = OWN / 'installation.json'
DESKTOP_NAME = 'texkoi-protocol-probe.desktop'
DESKTOP = DATA / 'applications' / DESKTOP_NAME
PACKAGE = Path.home() / '.local/share/Kingsoft/wps/jsaddons/TeXKoi_0.0.1'
MIME = 'x-scheme-handler/texkoi'


def mime(*args):
    return subprocess.run(['xdg-mime', *args], check=True, capture_output=True, text=True).stdout.strip()


def main():
    if sys.argv[1:] == ['--remove']:
        state = json.loads(STATE.read_text())
        current_handler = mime('query', 'default', MIME)
        for name, previous in state['files'].items():
            p = Path(name)
            if previous is None:
                p.unlink(missing_ok=True)
            else:
                p.write_bytes(base64.b64decode(previous['data']))
                p.chmod(previous['mode'])
        if current_handler == DESKTOP_NAME:
            if state['previous_handler']:
                mime('default', state['previous_handler'], MIME)
            else:
                # Remove only our association, retaining all unrelated MIME settings.
                import configparser
                for path in [Path.home()/'.config/mimeapps.list', DATA/'applications/mimeapps.list']:
                    if not path.exists(): continue
                    c = configparser.ConfigParser(interpolation=None, strict=False)
                    c.optionxform = str
                    c.read(path)
                    changed = False
                    for section in c.sections():
                        if c.has_option(section, MIME):
                            values = [v for v in c.get(section, MIME).split(';') if v and v != DESKTOP_NAME]
                            if values: c.set(section, MIME, ';'.join(values)+';')
                            else: c.remove_option(section, MIME)
                            changed = True
                    if changed:
                        with path.open('w') as f: c.write(f)
        shutil.rmtree(OWN)
        print('Protocol probe removed; prior WPS files restored.')
        return
    if sys.argv[1:]: raise SystemExit('Usage: install_protocol_probe.py [--remove]')
    if STATE.exists(): raise SystemExit('Probe already installed; remove it before reinstalling.')
    if not PACKAGE.is_dir(): raise SystemExit('Install the WPS offline probe 0.0.1 first.')
    handler = OWN/'handler.py'
    config = 'var texkoiProtocolProbeDirectory = ' + json.dumps(str(CACHE/'texkoi/protocol-probe')) + ';\n'
    def desktop_quote(s):
        for char in ['\\', '"', '`', '$']: s = s.replace(char, '\\'+char)
        return '"'+s.replace('%','%%')+'"'
    desktop = '[Desktop Entry]\nType=Application\nName=TeXKoi Protocol Probe\nNoDisplay=true\nTerminal=false\nExec=/usr/bin/python3 ' + desktop_quote(str(handler)) + ' %u\nMimeType=' + MIME + ';\n'
    files = {DESKTOP: desktop.encode(), handler: (ROOT/'scripts/protocol_probe.py').read_bytes(), PACKAGE/'protocol-probe-config.js': config.encode()}
    for name in ['index.html', 'main.js', 'ribbon.xml', 'protocol-dialog.html']:
        files[PACKAGE/name] = (ROOT/'packaging/offline-probe'/name).read_bytes()
    previous = {str(p): {'data': base64.b64encode(p.read_bytes()).decode(), 'mode': p.stat().st_mode & 0o777} if p.exists() else None for p in files}
    old_handler = mime('query', 'default', MIME)
    OWN.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({'previous_handler': old_handler, 'files': previous}, indent=2))
    for p, content in files.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(content)
    handler.chmod(0o755)
    mime('default', DESKTOP_NAME, MIME)
    print('Registered texkoi:// probe. Previous handler: ' + (old_handler or '(none)'))
    print('Remove with: python scripts/install_protocol_probe.py --remove')

if __name__ == '__main__': main()
