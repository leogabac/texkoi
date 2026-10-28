"""Dependency checks and the TeXKoi command line."""
import argparse
import errno
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from register import register
from render import render
from settings import load_settings
from serve import run

TOOLS = ("wpp", "latex", "pdflatex", "dvisvgm", "pdftocairo", "kpsewhich")
TEX_FILES = ("standalone.cls", "amsmath.sty", "amssymb.sty")

def dependency_errors():
    errors = []
    if sys.version_info < (3, 10):
        errors.append("Python 3.10 or newer is required.")
    for tool in TOOLS:
        if shutil.which(tool) is None:
            errors.append("Missing executable: " + tool)
    if shutil.which("kpsewhich"):
        for name in TEX_FILES:
            try:
                result = subprocess.run(["kpsewhich", name], capture_output=True, text=True, timeout=10)
                if result.returncode or not result.stdout.strip():
                    errors.append("Missing TeX package file: " + name)
            except (OSError, subprocess.TimeoutExpired) as error:
                errors.append("Could not check " + name + ": " + str(error))
    return errors

def main(argv=None):
    parser = argparse.ArgumentParser(description="TeXKoi Dev: server-backed development add-in for WPS Presentation")
    parser.add_argument("command", nargs="?", default="start", choices=("start", "doctor", "install", "uninstall"))
    parser.add_argument("--dev", action="store_true", help="show development diagnostics in the ribbon")
    parser.add_argument("--render-check", action="store_true", help="doctor: compile a sample in SVG and PNG")
    args = parser.parse_args(argv)
    if args.dev and args.command != "start":
        parser.error("--dev is only available with start")
    if args.render_check and args.command != "doctor":
        parser.error("--render-check is only available with doctor")
    try:
        if args.command in ("install", "uninstall"):
            register(args.command)
            return 0
        errors = dependency_errors()
        if errors:
            print("TeXKoi cannot start:" if args.command == "start" else "Dependency check failed:", file=sys.stderr)
            for error in errors:
                print("  - " + error, file=sys.stderr)
            print("Install WPS Presentation, TeX Live (including standalone, amsmath and amssymb), dvisvgm and Poppler; then rerun ./texkoi doctor.", file=sys.stderr)
            return 1
        if args.command == "doctor":
            settings = load_settings()
            print("Settings:", settings["settings_path"])
            if settings["preamble_path"]:
                print("Preamble:", settings["preamble_path"])
            print("All required executables and TeX packages are available.")
            if args.render_check:
                with tempfile.TemporaryDirectory(prefix="texkoi-doctor-") as directory:
                    for fmt in ("svg", "png"):
                        result = render(r"\frac{\alpha}{\beta} = \int_0^1 x^2\,dx", directory, fmt, preamble=settings["preamble"])
                        if result["width"] <= 0 or result["height"] <= 0:
                            raise ValueError("Render check returned invalid image dimensions")
                        print(fmt.upper() + " render check passed.")
            return 0
        run(development=args.dev, on_ready=lambda: register("install"))
        return 0
    except (OSError, ValueError, ET.ParseError) as error:
        if isinstance(error, OSError) and error.errno == errno.EADDRINUSE:
            print("TeXKoi could not start: port 3899 is already in use. Stop the previous TeXKoi server (Ctrl+C in its terminal), then retry.", file=sys.stderr)
        else:
            print("TeXKoi: " + str(error), file=sys.stderr)
        return 1
