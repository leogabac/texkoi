# Development notes

A LaTeX extension for WPS Presentation on Linux, inspired by
[IguanaTex](https://github.com/Jonathan-LeRoux/IguanaTex).

This is an early LaTeX rendering prototype. It also retains the initial test
image and metadata controls for development. The original
probe was tested interactively on Arch Linux with `wps-office-cn 12.1.2.29183-1`:
the ribbon callback, image insertion, and source recovery after saving/reopening
`.pptx` all worked. The repository version was subsequently confirmed working by the user as well.

## Run the prototype

Requires Python 3 and a WPS Linux installation with JavaScript add-in support.
No Python packages or Node dependencies are needed.

```bash
cd /home/holo/projects/texkoi
python scripts/register.py install
python scripts/serve.py
```

Leave the server running, fully restart WPS, and open a presentation. In the
**TexKoi** tab, click **Insert test image**. Save as `.pptx`, close and reopen,
select the image, and click **Read source**. The expected source is:

```latex
\alpha + \beta = \Gamma
E = mc^{2}
```

The image is embedded, not linked. Source uses hex-encoded UTF-16 code units
because presentation tags may normalize case. Reading the original probe's tag
is also supported. This is a temporary metadata format.

The image path in `addin/main.js` currently points to this checkout. If you move
the repository, update that path. The server listens only on `127.0.0.1:3899`;
stop the old probe server before starting it.

Registration backs up an existing `publish.xml`, preserves unrelated add-ins,
and replaces the temporary `IguanaButtonProbe` entry. To remove TexKoi:

```bash
python scripts/register.py uninstall
```

Restart WPS and stop the server with Ctrl+C. Backups remain next to `publish.xml`.

## Next milestone

Edit and replace selected equations while preserving their position and size. Check vector image support, undo,
copy/paste, and metadata persistence before settling the document format.

## License

MIT; see [LICENSE](LICENSE). This implementation does not include IguanaTex
source code or assets.

## Equation rendering prototype

The **New equation** button opens a source editor. Enter a math fragment without
`$` delimiters, render a preview, then insert it into the current slide. Source
is attached using the same tags as the persistence probe. Existing equations
are not updated yet.

Requires `latex`, `dvisvgm`, `pdflatex`, the `standalone`, `amsmath`, and `amssymb` packages, and
`pdftocairo` (Poppler). SVG is now the default output, using `latex` → DVI → `dvisvgm` with outlined
glyphs and a tight bounding box. This avoids the installed Ghostscript PDF
conversion incompatibility. PNG at 300 DPI remains selectable. Both formats
scale from the TeX 10-point base to the requested size (28 pt by default).
The user confirmed SVG insertion, sizing, and save/reopen work in WPS.

The local server compiles in per-request temporary directories, disables shell
escape, restricts TeX file access, and imposes a 30-second timeout per command.
This is for the user's own LaTeX; it is not a sandbox for untrusted TeX.
Render files last for the server session and are embedded in the slide.

Validation: a fraction/integral example compiled with positive image dimensions;
invalid LaTeX returned its compiler error. JavaScript syntax and ribbon XML
checks passed. The user confirmed the PNG editor/preview/insertion workflow works in WPS.
The user also confirmed the SVG workflow and the revised two-action editor:
**Render preview** previews only; **Render & insert** compiles, inserts, and
automatically closes the editor on success. Errors keep the editor open.
