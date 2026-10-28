"""Compile a math fragment into a cropped SVG or transparent PNG."""
from pathlib import Path
import os
import re
import struct
import xml.etree.ElementTree as ET
import subprocess
import tempfile


DEFAULT_PREAMBLE = "\\usepackage{amsmath,amssymb}\n"
MAX_PREAMBLE_UNITS = 20000


class CompileError(ValueError):
    def __init__(self, message, location=None):
        super().__init__(message)
        self.location = location


def error_location(log, preamble, original_source):
    # Only map diagnostics explicitly attributed to our generated document.
    match = re.search(r'(?m)^(?:\./)?equation\.tex:(\d+):', log)
    if not match: return None
    line = int(match.group(1))
    preamble_lines = (preamble + '\n').count('\n')
    if 2 <= line < 2 + preamble_lines:
        return {'section': 'preamble', 'line': line - 1}
    source_start = 2 + preamble_lines + 2
    source = original_source.strip()
    source_lines = source.count('\n') + 1
    if source_start <= line < source_start + source_lines:
        leading_lines = len(original_source) - len(original_source.lstrip())
        return {'section': 'source', 'line': line - source_start + 1 + original_source[:leading_lines].count('\n')}
    return None


def validate_preamble(preamble):
    if not isinstance(preamble, str) or len(preamble.encode('utf-16-le', errors='surrogatepass')) // 2 > MAX_PREAMBLE_UNITS:
        raise ValueError('Preamble must be text of at most 20,000 UTF-16 characters.')
    uncommented = re.sub(r'(?<!\\)%[^\n]*', '', preamble)
    if re.search(r'\\documentclass\b|\\(?:begin|end)\s*\{\s*document\s*\}', uncommented):
        raise ValueError('Preamble must contain packages and macros, without documentclass or document boundaries.')
    return preamble


def render(source, output_root, output_format="svg", preamble=DEFAULT_PREAMBLE):
    if output_format not in ("svg", "png"):
        raise ValueError("Choose SVG or PNG output.")
    if not isinstance(source, str) or not source.strip() or len(source) > 20000:
        raise ValueError("Enter a LaTeX math fragment (maximum 20,000 characters).")
    # The wrapper supplies its own line breaks. A trailing editor newline would
    # otherwise create a paragraph inside math mode and trigger Missing $ inserted.
    original_source = source
    source = source.strip()
    validate_preamble(preamble)
    job = Path(tempfile.mkdtemp(prefix="equation-", dir=output_root))
    document = (r"\documentclass[border=2pt]{standalone}" + '\n' + preamble + '\n'
                + r"\begin{document}" + '\n' + r"$\displaystyle" + '\n'
                + source + '\n$\n' + r"\end{document}" + '\n')
    (job / "equation.tex").write_text(document)
    env = dict(os.environ, openin_any="p", openout_any="p")
    commands = [
        ["latex" if output_format == "svg" else "pdflatex", "-no-shell-escape", "-file-line-error", "-interaction=nonstopmode", "-halt-on-error", "equation.tex"],
        (["dvisvgm", "--no-fonts=1", "--exact-bbox", "--bbox=2pt", "--output=equation.svg", "equation.dvi"]
         if output_format == "svg" else
         ["pdftocairo", "-png", "-singlefile", "-transp", "-r", "300", "equation.pdf", "equation"]),
    ]
    try:
        for command in commands:
            result = subprocess.run(command, cwd=job, env=env, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=30)
            if result.returncode:
                log = result.stdout.decode(errors="replace")
                raise CompileError(log[-6000:], error_location(log, preamble, original_source))
    except FileNotFoundError as error:
        raise ValueError("Missing tool: " + error.filename) from error
    except subprocess.TimeoutExpired as error:
        raise ValueError("Rendering exceeded the 30-second time limit.") from error
    image = job / ("equation." + output_format)
    if output_format == "svg":
        svg = ET.parse(image).getroot()
        # dvisvgm emits physical dimensions in PostScript points (72 per inch).
        width = float(svg.attrib["width"].removesuffix("pt"))
        height = float(svg.attrib["height"].removesuffix("pt"))
    else:
        pixels_x, pixels_y = struct.unpack(">II", image.read_bytes()[16:24])
        width, height = pixels_x * 72 / 300, pixels_y * 72 / 300
    return {"path": str(image), "url": "/renders/" + job.name + "/" + image.name,
            "width": width, "height": height, "format": output_format, "preamble": preamble}
