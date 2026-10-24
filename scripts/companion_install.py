"""Install and control the per-user TeXKoi Linux companion and local WPS add-in."""
import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET

from companion import base_url, load_config, request
from launcher import dependency_errors, main as development_main
import local_registration

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share')))
CONFIG_HOME = Path(os.environ.get('XDG_CONFIG_HOME', str(Path.home() / '.config')))
HOME = DATA / 'texkoi/companion'
CONFIG = HOME / 'config.json'
STATE = HOME / 'installation.json'
AUTOSTART = CONFIG_HOME / 'autostart/texkoi-companion.desktop'
APP = DATA / 'applications/texkoi-companion.desktop'
WPS = Path.home() / '.local/share/Kingsoft/wps/jsaddons'
PUBLISH = WPS / 'publish.xml'
VERSION = (ROOT / 'VERSION').read_text().strip()


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



def snapshot(path):
    if not path.exists(): return None
    return {'bytes': base64.b64encode(path.read_bytes()).decode(), 'mode': path.stat().st_mode & 0o777}


def restore_files(files):
    for name, original in files.items():
        path = Path(name)
        if original is None:
            path.unlink(missing_ok=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(base64.b64decode(original['bytes']))
            path.chmod(original['mode'])


def restore():
    state = json.loads(STATE.read_text())
    restore_files(state['files'])
    if 'registration_before' in state:
        local_registration.replace(PUBLISH, state['registration_before'])
    # Remove only empty generated directories, preserving unexpected user files.
    for name, previous in state['files'].items():
        if previous is not None: continue
        parent = Path(name).parent
        while parent.is_relative_to(WPS) and parent != WPS:
            try: parent.rmdir()
            except OSError: break
            parent = parent.parent


def install():
    if not VERSION or any(c not in '0123456789.' for c in VERSION):
        raise ValueError('Invalid release version')
    errors = dependency_errors()
    if errors: raise ValueError('\n'.join(errors))
    previous_state = json.loads(STATE.read_text()) if STATE.exists() else None
    if CONFIG.exists() and previous_state is None:
        raise ValueError('Existing companion configuration has no installation record')
    if previous_state and previous_state.get('version') == VERSION:
        start()
        print('TeXKoi ' + VERSION + ' is already installed and running.')
        return
    registration_before = local_registration.entries(PUBLISH)
    config = load_config(CONFIG) if CONFIG.exists() else {'token': secrets.token_hex(32), 'port': 3901}
    package = WPS / ('TeXKoi_' + VERSION)
    profile = dict(name='TeXKoi', tabId='texkoiTab', id='texkoi', mode='companion',
                   version=VERSION, editorBase=base_url(config))
    files = {package / p.relative_to(ROOT / 'addin'): p.read_bytes()
             for p in (ROOT / 'addin').rglob('*') if p.is_file() and not p.name.startswith('diagnostics')}
    files[package / 'profile.js'] = ('var texkoiProfile = ' + json.dumps(profile) + ';\n').encode()
    files[package / 'package.json'] = json.dumps(dict(name='TeXKoi', version=VERSION, addonType='wpp')).encode()
    files[package / 'LICENSE'] = (ROOT / 'LICENSE').read_bytes()
    desktop = '[Desktop Entry]\nType=Application\nName=TeXKoi Companion\nComment=Local equation renderer for WPS Presentation\nTerminal=false\nExec=' + ' '.join(desktop_quote(arg) for arg in command()) + '\n'
    files[AUTOSTART] = desktop.encode()
    files[APP] = desktop.encode()
    attempt_files = {str(p): snapshot(p) for p in files}
    baseline = dict(attempt_files)
    if previous_state:
        baseline.update(previous_state['files'])
    state = {'version': VERSION, 'package': str(package), 'files': baseline,
             'registration_before': previous_state.get('registration_before', registration_before)
                                    if previous_state else registration_before}
    HOME.parent.mkdir(parents=True, exist_ok=True)
    # Keep the previous runtime outside HOME until the upgrade is complete.
    with tempfile.TemporaryDirectory(prefix='texkoi-install-', dir=HOME.parent) as temporary:
        backup = Path(temporary) / 'runtime'
        was_running = running()
        if previous_state: stop()
        if HOME.exists(): shutil.copytree(HOME, backup)
        try:
            HOME.mkdir(mode=0o700, parents=True, exist_ok=True)
            HOME.chmod(0o700)
            shutil.copytree(ROOT / 'addin', HOME / 'addin', dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns('diagnostics*'))
            (HOME / 'scripts').mkdir(exist_ok=True)
            for name in ['companion.py', 'serve.py', 'render.py', 'theme.py']:
                shutil.copy2(ROOT / 'scripts' / name, HOME / 'scripts' / name)
            CONFIG.write_text(json.dumps(config))
            CONFIG.chmod(0o600)
            STATE.write_text(json.dumps(state, indent=2))
            STATE.chmod(0o600)
            start()
            for path, content in files.items():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            (package / 'profile.js').chmod(0o600)
            local_registration.install(PUBLISH, package, VERSION)
        except Exception:
            stop()
            restore_files(attempt_files)
            local_registration.replace(PUBLISH, registration_before)
            if HOME.exists(): shutil.rmtree(HOME)
            if backup.exists(): shutil.copytree(backup, HOME)
            if was_running: start()
            raise
    print('TeXKoi ' + VERSION + ' installed. Companion running; desktop login startup enabled.')
    print('Restart WPS Presentation to load the versioned TeXKoi add-in.')



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', nargs='?', default='install', choices=['install', 'start', 'stop', 'status', 'uninstall', 'doctor'])
    parser.add_argument('--render-check', action='store_true', help='doctor: compile SVG and PNG samples')
    args = parser.parse_args()
    if sys.platform != 'linux': raise SystemExit('This installer currently supports Linux. The companion core is independent of login startup.')
    if args.render_check and args.action != 'doctor': parser.error('--render-check requires doctor')
    try:
        if args.action == 'doctor': return development_main(['doctor'] + (['--render-check'] if args.render_check else []))
        if args.action == 'install': install()
        elif args.action == 'start': start(); print('Companion running.')
        elif args.action == 'stop': stop(); print('Companion stopped.')
        elif args.action == 'status':
            active = running()
            print('Companion running.' if active else 'Companion stopped.')
            return 0 if active else 1
        elif args.action == 'uninstall':
            if not STATE.exists():
                print('TeXKoi is not installed.')
                return 0
            stop()
            restore()
            shutil.rmtree(HOME)
            print('Companion removed; previous WPS package files and desktop entries restored.')
    except (OSError, ValueError, RuntimeError, ET.ParseError) as error:
        print('TeXKoi: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__': raise SystemExit(main())
