"""Build a reproducible Linux source/runtime bundle without user configuration."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ['companion.py', 'companion_install.py', 'local_registration.py',
           'launcher.py', 'register.py', 'render.py', 'serve.py', 'theme.py', 'settings.py']


def build(destination):
    version = (ROOT / 'VERSION').read_text().strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+', version): raise ValueError('Expected a semantic release version')
    metadata = json.loads((ROOT / 'packaging/package.json').read_text())
    if metadata != dict(name='TeXKoi', version=version, addonType='wpp'):
        raise ValueError('WPS metadata does not match VERSION')
    files = {name: (ROOT / name).read_bytes() for name in
             ['install', 'VERSION', 'README.md', 'INSTALL.md', 'CONFIGURATION.md', 'CHANGELOG.md', 'LICENSE', 'DEVELOPMENT.md', 'OFFLINE_INSTALLATION.md', 'docs/images/main-ss.png']}
    files.update({'scripts/' + name: (ROOT / 'scripts' / name).read_bytes() for name in SCRIPTS})
    files.update({str(p.relative_to(ROOT)): p.read_bytes() for p in (ROOT / 'addin').rglob('*')
                  if p.is_file() and not p.name.startswith('diagnostics') and p.suffix != '.svg'})
    files['packaging/package.json'] = (ROOT / 'packaging/package.json').read_bytes()
    manifest = {'name': 'TeXKoi', 'version': version, 'platform': 'linux',
                'sha256': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}}
    files['manifest.json'] = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
    destination = Path(destination); destination.mkdir(parents=True, exist_ok=True)
    archive = destination / ('TeXKoi-v' + version + '-linux.tar.gz')
    # Fixed metadata and ordering keep repeated builds byte-for-byte identical.
    with archive.open('wb') as stream, gzip.GzipFile(filename='', fileobj=stream, mode='wb', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as tar:
            for name, data in sorted(files.items()):
                entry = tarfile.TarInfo('TeXKoi-v' + version + '/' + name)
                entry.size = len(data); entry.mode = 0o755 if name == 'install' else 0o644
                tar.addfile(entry, io.BytesIO(data))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (destination / 'SHA256SUMS').write_text(digest + '  ' + archive.name + '\n')
    print(archive)
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/releases')
    build(parser.parse_args().output)
