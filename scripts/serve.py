"""Serve the development add-in and local TeX renderer on loopback only."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import os
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from render import render, CompileError
from settings import load_settings, open_preamble
from theme import theme_css

ADDIN = Path(__file__).resolve().parents[1] / "addin"
ORIGIN = "http://127.0.0.1:3899"
ET.register_namespace("", "http://schemas.microsoft.com/office/2006/01/customui")

def read_system_clipboard():
    # Access the desktop clipboard only after an authenticated editor request.
    if os.environ.get('WAYLAND_DISPLAY') and shutil.which('wl-paste'):
        command = ['wl-paste', '--no-newline']
    elif os.environ.get('DISPLAY') and shutil.which('xclip'):
        command = ['xclip', '-selection', 'clipboard', '-out']
    elif os.environ.get('DISPLAY') and shutil.which('xsel'):
        command = ['xsel', '--clipboard', '--output']
    else:
        raise ValueError('Clipboard reader unavailable. Install wl-clipboard, xclip, or xsel.')
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5, check=True)
        if len(result.stdout) > 80000: raise ValueError('Clipboard text exceeds 80 KiB.')
        return result.stdout.decode('utf-8')
    except (OSError, subprocess.SubprocessError, UnicodeDecodeError) as error:
        raise ValueError('Could not read text from the desktop clipboard.') from error


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/settings":
            try:
                result = load_settings(getattr(self.server, 'settings_root', None))
                status = 200
            except ValueError as error:
                result, status = {'error': str(error)}, 400
            payload = json.dumps(result).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if self.path.split("?", 1)[0] == "/wps-theme.css":
            payload = theme_css().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/css")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if self.path.split("?", 1)[0] == "/profile.js":
            payload = b"var texkoiProfile = {name:'TeXKoi Dev', tabId:'texkoiDevTab', id:'texkoi-dev', mode:'server'};"
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if self.path.split("?", 1)[0] == "/ribbon.xml":
            root = ET.parse(ADDIN / "ribbon.xml").getroot()
            ns = "{http://schemas.microsoft.com/office/2006/01/customui}"
            tab = root.find(".//" + ns + "tab")
            tab.set("label", "TeXKoi Dev")
            tab.set("id", "texkoiDevTab")
            if self.server.development:
                group = ET.SubElement(tab, ns + "group", id="diagnostics", label="Development")
                ET.SubElement(group, ns + "button", id="undoDiagnostics", label="Undo diagnostics", onAction="OnUndoDiagnostics")
            payload = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            self.send_response(200)
            self.send_header("Content-Type", "application/xml")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if self.path.startswith("/renders/"):
            relative = self.path[len("/renders/"):]
            target = (self.server.render_root / relative).resolve()
            if not target.is_relative_to(self.server.render_root) or not target.is_file():
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml" if target.suffix == ".svg" else "image/png")
            self.end_headers()
            self.wfile.write(target.read_bytes())
            return
        super().do_GET()

    def do_POST(self):
        if self.path not in ("/render", "/open-preamble", "/clipboard-read"):
            self.send_error(404)
            return
        action = self.path[1:]
        # Cross-origin webpages must not be able to invoke local actions.
        if self.headers.get("Origin") not in (None, getattr(self.server, "origin", ORIGIN)) or self.headers.get("X-TeXKoi") != action:
            self.send_error(403)
            return
        if action in ("open-preamble", "clipboard-read"):
            try:
                if self.headers.get('Content-Length', '0') != '0': raise ValueError('Unexpected request body.')
                result = (open_preamble(getattr(self.server, 'settings_root', None))
                          if action == 'open-preamble' else {'text': read_system_clipboard()})
                status = 200
            except (ValueError, OSError) as error:
                result, status = {'error': str(error)}, 400
            payload = json.dumps(result).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 300000:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(length))
            preamble = data['preamble'] if 'preamble' in data else load_settings(getattr(self.server, 'settings_root', None))['preamble']
            result = render(data.get("source"), self.server.render_root, data.get("format", "svg"), preamble=preamble)
            result["url"] = getattr(self.server, "public_base", "") + result["url"]
            status = 200
        except (ValueError, TypeError, AttributeError) as error:
            result, status = {"error": str(error)}, 400
            if isinstance(error, CompileError) and error.location:
                result["location"] = error.location
        payload = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

def run(development=False, on_ready=None):
    with tempfile.TemporaryDirectory(prefix="texkoi-") as temporary:
        server = ThreadingHTTPServer(("127.0.0.1", 3899), partial(Handler, directory=str(ADDIN)))
        server.render_root = Path(temporary).resolve()
        server.development = development
        try:
            if on_ready:
                on_ready()
            print("TeXKoi Dev: " + ORIGIN, flush=True)
            print("Leave this terminal running. Open WPS Presentation; restart WPS if the ribbon changed. Ctrl+C stops TeXKoi.", flush=True)
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()

if __name__ == "__main__":
    run()
