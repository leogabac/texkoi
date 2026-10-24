"""Install/control the Linux desktop companion using an existing local WPS package.

This test installer reuses a package installed through WPS's publish page. It
never rewrites publish.xml. A distributable package/installer follows WPS testing.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

from companion import base_url, load_config, request
from launcher import dependency_errors

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share')))
CONFIG_HOME = Path(os.environ.get('XDG_CONFIG_HOME', str(Path.home() / '.config')))
HOME = DATA / 'texkoi/companion'
CONFIG = HOME / 'config.json'
STATE = HOME / 'installation.json'
AUTOSTART = CONFIG_HOME / 'autostart/texkoi-companion.desktop'
APP = DATA / 'applications/texkoi-companion.desktop'


def desktop_quote(value):
    if '\n' in value or '\r' in value: raise ValueError('Newlines are not allowed in installation paths')
    for char in ['\\', '"', '`', '$']: value = value.replace(char, '\\' + char)
    return '"' + value.replace('%', '%%') + '"'


def command():
    return [sys.executable, str(HOME / 'scripts/companion.py'), '--config', str(CONFIG)]


def running():
    try:
        return request(load_config(CONFIG)) == {'app': 'TeXKoi', 'mode': 'companion', 'ok': True}
    except (OSError, ValueError):
        return False


def start():
    if running(): return
    with (HOME / 'startup.log').open('ab') as log:
        child = subprocess.Popen(command(), stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                 start_new_session=True, cwd=HOME)
    for _ in range(40):
        if running(): return
        if child.poll() is not None: break
        time.sleep(0.1)
    raise RuntimeError('Companion failed to start; inspect ' + str(HOME / 'startup.log'))


def stop():
    if not running(): return
    request(load_config(CONFIG), 'shutdown', 'POST')
    for _ in range(40):
        if not running(): return
        time.sleep(0.1)
    raise RuntimeError('Companion did not stop; installation left intact')


def installed_package():
    # The folder convention was established by WPS's own offline installer.
    directory = Path.home() / '.local/share/Kingsoft/wps/jsaddons'
    root = ET.parse(directory / 'publish.xml').getroot()
    entries = [entry for entry in root if entry.tag == 'jsplugin' and entry.get('name') == 'TeXKoi']
    if len(entries) != 1: raise ValueError('Install the TeXKoi local WPS test package first')
    version = entries[0].get('version', '')
    if not version or any(c not in '0123456789.-' for c in version):
        raise ValueError('Unexpected local package version')
    package = directory / ('TeXKoi_' + version)
    if not (package / 'index.html').is_file(): raise ValueError('The local WPS package has not been downloaded yet')
    return package


def snapshot(path):
    if not path.exists(): return None
    return {'bytes': base64.b64encode(path.read_bytes()).decode(), 'mode': path.stat().st_mode & 0o777}


def restore():
    state = json.loads(STATE.read_text())
    for name, original in state['files'].items():
        path = Path(name)
        if original is None:
            path.unlink(missing_ok=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(base64.b64decode(original['bytes']))
            path.chmod(original['mode'])


def install():
    if STATE.exists():
        start()
        print('Companion already installed and running.')
        return
    if CONFIG.exists(): raise ValueError('Existing companion configuration has no installation record')
    protocol_state = DATA / 'texkoi/protocol-probe/installation.json'
    if protocol_state.exists():
        raise ValueError('Remove the temporary URI probe first: python scripts/install_protocol_probe.py --remove')
    errors = dependency_errors()
    if errors: raise ValueError('\n'.join(errors))
    package = installed_package()
    HOME.mkdir(mode=0o700, parents=True, exist_ok=True)
    HOME.chmod(0o700)
    config = {'token': secrets.token_hex(32), 'port': 3901}
    profile = dict(name='TeXKoi', tabId='texkoiTab', id='texkoi', mode='companion', editorBase=base_url(config))
    files = {package / p.relative_to(ROOT / 'addin'): p.read_bytes()
             for p in (ROOT / 'addin').rglob('*') if p.is_file()}
    files[package / 'profile.js'] = ('var texkoiProfile = ' + json.dumps(profile) + ';\n').encode()
    desktop = '[Desktop Entry]\nType=Application\nName=TeXKoi Companion\nComment=Local equation renderer for WPS Presentation\nTerminal=false\nExec=' + ' '.join(desktop_quote(arg) for arg in command()) + '\n'
    files[AUTOSTART] = desktop.encode()
    files[APP] = desktop.encode()
    STATE.write_text(json.dumps({'package': str(package), 'files': {str(p): snapshot(p) for p in files}}, indent=2))
    STATE.chmod(0o600)
    try:
        shutil.copytree(ROOT / 'addin', HOME / 'addin', dirs_exist_ok=True)
        (HOME / 'scripts').mkdir(exist_ok=True)
        for name in ['companion.py', 'serve.py', 'render.py', 'theme.py']:
            shutil.copy2(ROOT / 'scripts' / name, HOME / 'scripts' / name)
        CONFIG.write_text(json.dumps(config))
        CONFIG.chmod(0o600)
        # Verify startup before enabling login startup or changing the WPS UI.
        start()
        for path, content in files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        (package / 'profile.js').chmod(0o600)
    except Exception:
        stop()
        restore()
        shutil.rmtree(HOME)
        raise
    print('TeXKoi companion installed and running. Desktop login startup enabled.')
    print('Restart WPS and use the regular TeXKoi tab. TeXKoi Dev remains separate.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['install', 'start', 'stop', 'status', 'uninstall'])
    args = parser.parse_args()
    if sys.platform != 'linux': raise SystemExit('This installer currently supports Linux. The companion core is independent of login startup.')
    try:
        if args.action == 'install': install()
        elif args.action == 'start': start(); print('Companion running.')
        elif args.action == 'stop': stop(); print('Companion stopped.')
        elif args.action == 'status':
            print('Companion running.' if running() else 'Companion stopped.')
            return 0 if running() else 1
        elif args.action == 'uninstall':
            stop()
            restore()
            shutil.rmtree(HOME)
            print('Companion removed; previous WPS package files and desktop entries restored.')
    except (OSError, ValueError, RuntimeError, ET.ParseError) as error:
        print('TeXKoi: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__': raise SystemExit(main())
