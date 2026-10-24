"""Local TeXKoi companion. Portable HTTP/rendering core; no desktop-service dependency."""
import argparse
from functools import partial
import hmac
from http.server import ThreadingHTTPServer
import json
import logging
from pathlib import Path
import re
import tempfile
import threading
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from serve import Handler as DevelopmentHandler

PROFILE = dict(name='TeXKoi', tabId='texkoiTab', id='texkoi', mode='companion')


def load_config(path):
    config = json.loads(Path(path).read_text())
    if not re.fullmatch(r'[a-f0-9]{64}', config.get('token', '')):
        raise ValueError('Invalid companion access token')
    port = config.get('port')
    if type(port) is not int or not 1024 <= port <= 65535:
        raise ValueError('Invalid companion port')
    return config


def base_url(config):
    return 'http://127.0.0.1:' + str(config['port']) + '/' + config['token'] + '/'


def request(config, path='health', method='GET'):
    req = Request(base_url(config) + path, method=method, headers={'X-TeXKoi': 'control'})
    with urlopen(req, timeout=3) as response:
        return json.load(response)


class Handler(DevelopmentHandler):
    def log_message(self, fmt, *args):
        # Request paths contain the private token. Keep them out of logs.
        return

    def authorize(self):
        if self.headers.get('Host') != self.server.origin.removeprefix('http://'):
            self.send_error(403)
            return False
        incoming = urlsplit(self.path).path.split('/', 2)
        if len(incoming) < 3 or not hmac.compare_digest(incoming[1].encode('utf-8'), self.server.token.encode('ascii')):
            self.send_error(404)
            return False
        self.path = '/' + self.path.split('/', 2)[2]
        return True

    def send_json(self, result):
        payload = json.dumps(result).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_HEAD(self):
        if self.authorize():
            super().do_HEAD()

    def do_GET(self):
        if not self.authorize(): return
        path = self.path.split('?', 1)[0]
        if path == '/health':
            self.send_json({'app': 'TeXKoi', 'mode': 'companion', 'ok': True})
        elif path == '/profile.js':
            payload = ('var texkoiProfile = ' + json.dumps(PROFILE) + ';').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        elif path == '/ribbon.xml':
            payload = (self.server.addin / 'ribbon.xml').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        else:
            super().do_GET()

    def do_POST(self):
        if not self.authorize(): return
        if self.path == '/shutdown':
            if (self.headers.get('X-TeXKoi') != 'control'
                    or self.headers.get('Origin') not in (None, self.server.origin)):
                self.send_error(403)
                return
            self.send_json({'ok': True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        else:
            super().do_POST()


def make_server(config, addin, render_root):
    addin = Path(addin).resolve()
    server = ThreadingHTTPServer(('127.0.0.1', config['port']), partial(Handler, directory=str(addin)))
    server.token = config['token']
    server.origin = 'http://127.0.0.1:' + str(server.server_port)
    server.public_base = '/' + config['token']
    server.addin = addin
    server.render_root = Path(render_root).resolve()
    server.development = False
    return server


def run(config, addin):
    try:
        existing = request(config)
    except (OSError, ValueError):
        existing = None
    if existing == {'app': 'TeXKoi', 'mode': 'companion', 'ok': True}:
        logging.info('Companion is already running')
        return
    with tempfile.TemporaryDirectory(prefix='texkoi-companion-') as temporary:
        server = make_server(config, addin, temporary)
        logging.info('TeXKoi companion listening on loopback port %d', config['port'])
        try:
            server.serve_forever()
        finally:
            server.server_close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    args = parser.parse_args()
    config = load_config(args.config)
    logging.basicConfig(filename=args.config.parent / 'companion.log', level=logging.INFO,
                        format='%(asctime)s %(levelname)s %(message)s')
    try:
        run(config, args.config.parent / 'addin')
    except Exception:
        logging.exception('Companion stopped unexpectedly')
        raise


if __name__ == '__main__': main()
