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

Leave the server running, fully restart WPS, and open a presentation. The early probe used **Insert test image** and **Read source** buttons, now
removed from the ribbon. Its persistence check was: Save as `.pptx`, close and reopen,
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
and replaces the temporary `IguanaButtonProbe` entry. To remove TeXKoi:

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
is attached using the same tags as the persistence probe. Existing equations can be reopened using **Edit equation**.

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

## Editing equations

Select one ungrouped TeXKoi equation and click **Edit equation**. The editor
restores its source, nominal size, and format. **Render & update** creates a
replacement before deleting the original. It preserves top/left position,
rotation, layer order, and manual horizontal/vertical scale. A longer equation
therefore grows in width at the existing scale rather than being squeezed into
the old bounding box. Changing the size control scales relative to that state.
Older equations without natural-size tags are compiled once more to recover
the original dimensions.

The ribbon includes **New equation**, **Edit equation**, and dedicated equation
history actions. The development diagnostics are temporarily exposed; early
probe helpers remain in the code for reference.

Run `node tests/editor.cjs` for simulated-host checks of source restoration,
manual scaling, successful replacement, and original preservation on compiler
or metadata failure. These checks passed, as did syntax/XML checks. The user confirmed WPS editing and save/reopen after an update work, including
restored source, size, format, position, and another successful update. Replacement
does not currently carry over animations, crop, or custom picture effects.

## Undo/redo workaround

On WPS Linux `12.1.2.29183`, the user confirmed that an equation update needs
**Ctrl+Z twice** for a complete undo and **Ctrl+Y twice** for a complete redo.
After only one undo both equations can be visible. Complete the pair before
making another edit. This is an observed workaround on the tested build, not a
guarantee for other versions or more complex slides. Do not automatically issue
two undos: intervening user actions may occupy the undo stack.

The behavior is consistent with paste and original deletion being separate undo
records, but the precise cause is unconfirmed. `StartNewUndoEntry` is callable
on Application, wps, and WppApplication(); explicit boundaries did not produce
a single-step update in the full workflow. No tested application object exposes
UndoRecord, BeginUndoGroup, or BeginTransaction. ActivePresentation exposes
SetUndoText, whose availability does not establish grouping support.

The current implementation prepares a complete image with tags and geometry in
a hidden staging presentation with matching slide dimensions, then copies it.
It marks only that temporary deck Saved=msoTrue and closes it before activating
the target. The user confirmed the temporary save prompt is resolved. Target
insertion uses native paste, checks metadata and geometry, adjusts layer order,
and deletes the original only after those checks. This overwrites the clipboard.

Simulated checks cover insertion/update, source and geometry fidelity, staging
cleanup, and original preservation on compilation/preparation/paste/delete
failures. They do not simulate WPS's undo stack. Run `node tests/editor.cjs`.
The user confirmed save/reopen after an update preserves source, size, format,
and position, and editing/updating works again. Both dedicated undo/redo actions
also passed interactive testing. Simulated tests remain separate from these
user-reported WPS results.

Investigation history:

- Isolated paste-only and paste/delete probes passed native undo/redo, but the
  integrated update still requires two steps.
- Fill.UserPicture changed source tags without changing the visible picture;
  that approach was removed. An equation touched by that experiment may need
  regeneration from its checked source to restore image/source agreement.
- Direct AddPicture on the target was replaced with staging and native paste.

The temporary **Undo diagnostics** development panel remains available for
API reports and disposable-slide paste tests. These tests overwrite the clipboard.

### Why dedicated equation history buttons exist

Native undo could not be made into a single update operation using the tested
API boundaries. Globally doubling Ctrl+Z/Ctrl+Y would also affect unrelated WPS
edits, and no supported Presentation interception/ownership mechanism was
established. Dedicated buttons keep the workaround explicit and allow checking
the expected old/new equation states before issuing the second native command.
They are a compatibility workaround, not a fix to WPS undo grouping.

### Dedicated equation history buttons (experimental)

**Undo equation update** / **Redo equation update** use native ExecuteMso Undo
or Redo, checking state before each command. Only the most recent successful
update is tracked, in shared PluginStorage for this add-in session. A new
insertion/update attempt invalidates the previous record. Native shortcuts
are untouched. Restart WPS and make a fresh update to populate this history.

Use these buttons immediately after updating, without unrelated edits. The
guard snapshots slide/shape IDs, names, types, geometry, text, and tags across
the active deck. It does not inspect animations, fills, other picture content,
or the host's undo stack, so matching snapshots cannot prove undo ownership.
If the first command reaches the expected final state, it stops after one.
Otherwise it issues a second only if the state matches the expected overlap
of old and new equations. Unexpected states invalidate the record and stop;
no automatic repair commands are attempted. The user confirmed both dedicated history buttons pass in WPS 12.1.2.29183.
The guards remain best-effort because WPS undo-stack ownership is not exposed.

`node tests/history.cjs` checks paired and single-entry transitions, refusal
after a changed snapshot, and stopping after an unexpected first transition.
