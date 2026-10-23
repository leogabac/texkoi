# Development notes

A LaTeX extension for WPS Presentation on Linux, inspired by
[IguanaTex](https://github.com/Jonathan-LeRoux/IguanaTex).

This is an early LaTeX rendering prototype. The initial test image and probe
handlers have been retired. The original probe was tested interactively on Arch Linux with `wps-office-cn 12.1.2.29183-1`:
the ribbon callback, image insertion, and source recovery after saving/reopening
`.pptx` all worked. The repository version was subsequently confirmed working by the user as well.

## Running from a checkout

Use Python 3.10 or newer. No Python or Node packages are needed for normal use.
Required executables: `wpp`, `latex`, `pdflatex`, `dvisvgm`, `pdftocairo`, and
`kpsewhich`. The TeX installation must provide `standalone.cls`, `amsmath.sty`,
and `amssymb.sty`. Install TeX Live and Poppler with your distribution's package
manager; package splits vary. The launcher reports missing tools and TeX files.

From the checkout, run `./texkoi`. The launcher resolves its own location, so it
also works from another directory using an absolute path. Startup checks
requirements, binds the loopback server, and registers TeXKoi if needed. It
preserves unrelated WPS add-ins and backs up configuration before actual changes.
Repeated registration is a no-op. First registration requires a WPS restart.

```bash
./texkoi                         # check, register, serve
./texkoi doctor                  # check tools and TeX packages
./texkoi doctor --render-check   # also compile SVG and PNG samples
./texkoi install                 # register without starting the server
./texkoi uninstall               # remove only TeXKoi registration
./texkoi --dev                   # serve with Undo diagnostics on the ribbon
```

Leave the terminal open while using the add-in. Ctrl+C stops the server; it
leaves registration installed for the next run. The server listens only on
`127.0.0.1:3899`. If another server owns that port, startup reports the conflict
before modifying registration. Stop the previous server in its terminal and
retry. Switching development mode requires restarting WPS to reload the ribbon.
No WPS windows are automatically closed or restarted.

The renderer and add-in no longer depend on a fixed checkout path. The retired
probe image and its handlers have been removed. Diagnostics remain accessible
at `/diagnostics.html` for development, but the normal ribbon hides them.
The server sends no-store headers to avoid stale development assets.

Run `python -m unittest discover -s tests -p 'test_*.py'` for setup checks, and
`node tests/editor.cjs`, `node tests/history.cjs`, and `node tests/ribbon.cjs`
for simulated-host checks. Native WPS behavior still needs interactive tests.

## Validation baseline

On Arch Linux with `wps-office-cn 12.1.2.29183-1`, the user confirmed SVG/PNG
rendering, insertion, editing, source/settings persistence after save/reopen,
the dedicated undo/redo workaround, and automatic ribbon focus. The launcher
and removal of development controls are a subsequent setup change.

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

The normal ribbon includes **New equation**, **Edit equation**, and dedicated
equation history actions. Development diagnostics require `./texkoi --dev`.

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

The **Undo diagnostics** development panel is available in `--dev` mode for
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

## Automatic ribbon focus

The add-in listens for WindowSelectionChange and activates the TeXKoi tab
when a selected shape carries TeXKoi (or legacy probe) source tags. Activation runs immediately and repeats at 16 ms intervals through 96 ms.
The earlier 80/300 ms retries caused a visible picture-tab flash; replacing them
with a single zero-delay recheck lost to WPS's later Graphics Tools activation.
The short retry burst is intended to reclaim focus promptly after that native
activation, but a completely flash-free switch is not established.
The callback rechecks current selection, so selecting another object cancels
the queued activation. The listener is registered once per ribbon context.
After insertion/update the result is selected and the TeXKoi tab activated
outside the completed undo entry. Manual tab choices are not continuously
overridden. `node tests/ribbon.cjs` verifies selection behavior with a mock host;
actual WPS tab timing and the existing undo workaround still need a live check.

The original delayed activation worked in WPS, but flashed; the zero-delay
version failed to retain the tab. The user accepted the frame-spaced version as good enough in live WPS testing.

Launcher verification: setup regression checks and all three JavaScript checks
passed. `doctor --render-check` found all tools/packages and compiled both SVG
and PNG. Live loopback HTTP checks confirmed normal/development ribbon modes,
no-store headers, and SVG rendering/delivery. An occupied-port test failed with
a clear error before writing registration. The live service was then restarted
through `./texkoi`; WPS must be restarted to see the normal ribbon.

## v0.1 editor scope

The editor uses a compact source area, inline size/format controls, a centered
preview, and a sticky footer containing only Render preview and Render & insert
(or Render & update). Preview width reflects the chosen point size, fitting
within the available width. Changed source/format dims the old preview until
rendering again. During rendering controls are disabled and the action displays
progress. Errors show a concise summary with expandable compiler output.

Ctrl+Enter renders and inserts/updates; Ctrl+Shift+Enter previews; Escape closes
when idle. Source is focused on opening. Preambles, installation packaging, and
additional equation options remain deferred. This does not constitute a v0.1
release or claim native offline installation is complete.

Existing editor/history/ribbon/setup checks pass with the revised UI. A browser
inspection confirmed labels and layout; the ordinary browser correctly shows
an unavailable-host message and disables rendering because it is outside WPS.
The revised layout and shortcuts still need a live WPS check.

## Editor theme integration

The helper serves `/wps-theme.css` from the current user's WPS Linux skin
preference in `$XDG_CONFIG_HOME/Kingsoft/Office.conf` (with lowercase filename
fallback). It reads only the current skin and follow-system keys; it does not
modify WPS configuration or return its contents. Known dark/light skin names
select corresponding UI colors. Unknown, unavailable, or follow-system settings
fall back to `prefers-color-scheme`. The stylesheet loads before first paint and
refreshes every two seconds while visible and on focus. It follows the saved
preference; changes held only in WPS memory cannot be detected this way.

This is a compatibility implementation based on inspected configuration, not a
documented WPS theme API. Controls and surfaces adapt; the equation preview
remains white to display black TeX output without changing inserted equations.
Dark/light and system-fallback config checks passed; live WPS switching still
needs verification.

## Ribbon icons

The four main actions use original blue outline icons: sigma-plus, sigma-pencil,
and matching undo/redo arrows. Editable SVG sources live in `addin/icons/`;
64-pixel transparent PNGs are served through the GetRibbonImage callback for
WPS ribbon compatibility. All four buttons use large sizing; history labels
are shortened to Undo update / Redo update with explanatory tooltips. The icon
color was checked on light and dark backgrounds. Assets are bundled, without
external fonts or icon libraries; `rsvg-convert` was used during authoring only
and is not a runtime dependency. Native ribbon display needs a WPS restart.

Ribbon icon URL correction: WPS prepends its add-in base URL to the string
returned by GetRibbonImage. Returning an absolute HTTP URL produced live
requests for `/http://127.0.0.1:3899/icons/...` and 404 placeholders. The callback
now returns relative `icons/<name>.png` paths; regression checks enforce this.

The user confirmed the corrected relative icon paths render correctly in WPS.
The polished editor and WPS-config theme adaptation were also accepted in live use.
