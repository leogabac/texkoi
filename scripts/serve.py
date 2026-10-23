"""Serve the development add-in and local TeX renderer on loopback only."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import tempfile
from render import render

ADDIN = Path(__file__).resolve().parents[1] / "addin"
ORIGIN = "http://127.0.0.1:3899"

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
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

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="texkoi-") as temporary:
        server = ThreadingHTTPServer(("127.0.0.1", 3899), partial(Handler, directory=str(ADDIN)))
        server.render_root = Path(temporary).resolve()
        print("TeXKoi: " + ORIGIN, flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
