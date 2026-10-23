"""Serve the development add-in and local TeX renderer on loopback only."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import tempfile
import xml.etree.ElementTree as ET
from render import render
from theme import theme_css

ADDIN = Path(__file__).resolve().parents[1] / "addin"
ORIGIN = "http://127.0.0.1:3899"
ET.register_namespace("", "http://schemas.microsoft.com/office/2006/01/customui")

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/wps-theme.css":
            payload = theme_css().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/css")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if self.path.split("?", 1)[0] == "/ribbon.xml" and self.server.development:
            root = ET.parse(ADDIN / "ribbon.xml").getroot()
            ns = "{http://schemas.microsoft.com/office/2006/01/customui}"
            tab = root.find(".//" + ns + "tab")
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
        if self.path != "/render":
            self.send_error(404)
            return
        # Cross-origin webpages must not be able to invoke the local compiler.
        if self.headers.get("Origin") not in (None, ORIGIN) or self.headers.get("X-TeXKoi") != "render":
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 100000:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(length))
            result = render(data.get("source"), self.server.render_root, data.get("format", "svg"))
            status = 200
        except (ValueError, TypeError, AttributeError) as error:
            result, status = {"error": str(error)}, 400
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
            print("TeXKoi: " + ORIGIN, flush=True)
            print("Leave this terminal running. Open WPS Presentation; restart WPS if the ribbon changed. Ctrl+C stops TeXKoi.", flush=True)
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()

if __name__ == "__main__":
    run()
