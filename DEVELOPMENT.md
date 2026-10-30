# Development notes

## Checkout workflow

Python 3.10+, WPS Slides, TeX Live (`standalone`, `amsmath`, `amssymb`),
dvisvgm, and Poppler are required. No Python/Node packages are needed at runtime.
Node.js is used for the simulated WPS tests.

```bash
./texkoi                        # serve/register TeXKoi Dev on 127.0.0.1:3899
./texkoi --dev                  # include the native Undo diagnostics panel
./texkoi doctor --render-check
./texkoi install                # register only the Dev profile
./texkoi uninstall              # remove only the Dev profile
```

The Dev process needs its terminal; the installed product does not. Restart
WPS after ribbon or registration changes. Never close user presentations or
modify unrelated add-ins/OEM settings automatically.

```bash
python -m unittest discover -s tests -p 'test_*.py'
node tests/editor.cjs
node tests/code-editor.cjs
node tests/vim.cjs
node tests/vim-clipboard.cjs
node tests/vim-default.cjs
node tests/editor-settings.cjs
node tests/preamble.cjs
node tests/preamble-actions.cjs
node tests/history.cjs
node tests/ribbon.cjs
node tests/connection.cjs
python scripts/build_release.py
```

The release builder writes a deterministic Linux tarball, its SHA256SUMS, and
an internal file manifest under ignored `dist/releases`. It bundles an explicit
list of runtime scripts and add-in files, excluding diagnostics, probe code,
user credentials and generated renders. VERSION and packaging/package.json
must agree. Building does not tag, publish, install, or change a running instance.

## Installed runtime

See [INSTALL.md](INSTALL.md) for commands. The installer manages the local
`TeXKoi_<version>` WPS folder, regular TeXKoi registration, copied runtime and
XDG desktop application/autostart entries. TeXKoi Dev has a separate ribbon tab,
port and session-history key. Installation preserves other add-ins; uninstall
restores the prior regular TeXKoi entries while retaining changes to unrelated
entries made after installation. Installation/upgrade failure restores the
previous runtime, files and registration. The initial prototype state can be
upgraded without changing its access token.

The companion opens only 127.0.0.1:3901. The local add-in profile opens an editor
served under an installation-specific 256-bit token path. Editor, compiler API,
images and theme CSS use the same origin. Requests must have the expected Host;
compiler POSTs require X-TeXKoi and reject foreign Origin headers. Tokens are
not logged. Do not share config.json, profile.js or installation.json. The
renderer is for the user's own TeX, not adversarial input.

Linux startup uses an XDG autostart desktop entry, with no systemd dependency.
The core HTTP/rendering code has no startup-service dependency. Windows/macOS
installation and native WPS behavior remain unimplemented and untested.

## Rendering and editor

SVG uses latex → DVI → dvisvgm with outlined glyphs; PNG uses pdflatex and
pdftocairo at 300 DPI. TeX runs with shell escape disabled, restricted file
access and a 30-second limit per command. Each job has its own temporary folder;
render files last for the companion session and are embedded into slides.

Source is stored as UTF-16 hex in shape tags, alongside format and nominal and
natural dimensions. Updates preserve position, rotation, layer order and manual
horizontal/vertical scale, but not animations, crop or custom picture effects.
The editor has only preview and render/insert-or-update actions. Successful
insertion/update closes it; errors leave it open. Ctrl+Enter inserts/updates,
Ctrl+Shift+Enter previews, and Escape closes while idle. User preferences and custom preambles are described in
[CONFIGURATION.md](CONFIGURATION.md); further editor options are deferred.

Theme CSS reads the saved WPS Linux skin in the user's Kingsoft/Office.conf,
without returning or modifying its contents. Unknown/follow-system settings
fall back to prefers-color-scheme. The equation preview remains white. Ribbon
icons use bundled PNGs; GetRibbonImage must return relative paths because WPS
prepends the add-in URL. Original SVG sources stay in the repository.

Selection callbacks activate the equation tab immediately and at frame-sized
intervals through 96 ms, rechecking selection each time. This reduces the native
Graphics Tools tab flash, but a completely flash-free transition is not assured.

## Undo/redo workaround

On WPS Linux 12.1.2.29183 an update requires two native undos/redos. One undo
can leave both old and new equations visible. This is consistent with separate
paste/delete records, but the exact cause is unconfirmed. StartNewUndoEntry
boundaries did not group the full operation; tested application objects did not
expose UndoRecord, BeginUndoGroup, or BeginTransaction. SetUndoText availability
does not establish grouping support.

Prepare the image, metadata and geometry in a hidden staging presentation with
matching dimensions. Mark only that temporary deck Saved=msoTrue and close it
before activating the target. Native paste overwrites the clipboard. Delete the
original only after checking pasted source and geometry. Direct AddPicture on
the target and Fill.UserPicture did not solve the tested native behavior.

Dedicated history buttons track only the latest successful update in shared
PluginStorage. They snapshot deck shape IDs, types, geometry, names, text and
tags, then check state between native ExecuteMso Undo/Redo calls. Stop after
one if it reaches the expected state; issue a second only for the expected
old/new overlap. Unexpected states invalidate the record without repair.

Use them immediately after an update, without unrelated edits. Snapshots omit
animations, fills, some picture content and the actual undo stack: matching
state cannot prove undo ownership. These are best-effort compatibility guards.
Native keyboard shortcuts are untouched; globally doubling them would undo
unrelated work. The development diagnostics overwrite the clipboard and should
be used only with disposable slides.

## Validation and release status

The user confirmed rendering, insertion, editing, source/settings persistence
after save/reopen, dedicated history, theme/icons, ribbon focus and the installed
companion on Arch Linux with wps-office-cn 12.1.2.29183-1. They rebooted the PC,
opened WPS and confirmed it works without manually starting anything.

The standalone v0.1.0 installer changes the package folder and registration from
the original probe. Automated installation, restoration, rollback and release
bundle checks accompany it. The user confirmed the final WPS restart/smoke test for this versioned
installation. Simulated-host tests do not prove native undo behavior.
See [OFFLINE_INSTALLATION.md](OFFLINE_INSTALLATION.md) for why the companion
exists rather than calling a helper directly from WPS.

Release preparation checks: all 12 Python tests and three JavaScript suites
passed. Two builds produced identical archives and the internal SHA-256 manifest
matched every bundled file. The extracted release passed doctor with actual
SVG/PNG compilation, two real install/start/remove cycles in an isolated home
directory with an unrelated WPS add-in, and then upgraded the actual installed
prototype to 0.1.0. The companion is running and both regular TeXKoi 0.1.0 and
TeXKoi Dev registrations are present. The user subsequently confirmed the final
WPS restart and insertion/editing check. No tag or published release has been
created.

## v0.1.1 reliability changes

Trim surrounding equation whitespace before adding the math wrapper. This
prevents an editor's trailing newline becoming a paragraph inside math mode.
The stored equation source is unchanged. Regression coverage compiles invalid
input, then valid input with surrounding blank lines in both SVG and PNG.

Ribbon actions first open a local connection page, so failures before the
companion editor loads have a retryable message. A private, uncached image
request checks reachability without relaxing CORS; successful checks navigate
the same dialog to the existing companion editor. A timeout or image failure
leaves a Retry button. Render request failures preserve source and distinguish
network, authorization, invalid-response, and actual compiler errors. Native
WPS smoke testing of the v0.1.1 workflow was subsequently confirmed by the user.

`python3 install doctor` reports stale regular TeXKoi trust records. The manual
`repair-trust` command requires document hosts to be closed, backs up the JSON,
and removes only regular TeXKoi entries whose path differs from the installed
package. It never writes enable flags or invents hashes for trust approval.
The independent qing browser may remain resident. No WPS process is terminated
by this command. The original stale-record repair passed a reopen test; the
next real reboot check remains pending and must not be claimed as automated.

## v0.2.0 preferences and preamble snapshots

settings.py owns public user preferences under XDG_CONFIG_HOME/texkoi, entirely
separate from the companion's private runtime config.json. The JSON format
keeps Python 3.10 support without adding dependencies. Settings are read on
each new editor load; bad values return an explicit error rather than silently
falling back. Installation creates defaults only if absent; uninstall preserves
user configuration and preamble files.

The authenticated settings endpoint returns defaults and the effective preamble
(base amsmath/amssymb plus the configured file). The editor submits a text
snapshot, not a filename, and the renderer returns the exact effective text.
Explicit snapshots render independently of today's settings. Source, preamble
and generated document retain the existing no-shell-escape restrictions.

Preamble metadata uses UTF-16 hex in 240-character tag values, with part count
and original length. Read it once into a tag map, validate count/length/chunks,
and reject damaged snapshots rather than falling back to changed defaults.
Only absence of a snapshot selects the historical built-in v0.1.x preamble.
Preparation/paste fidelity checks include the complete preamble before deleting
the original equation. Natural-dimension recovery also renders the original
source using its original preamble. History snapshots already include all tags.

Automated tests cover settings validation and reloads; real macro compilation
in both formats; saved snapshots after settings changes and invalid config;
legacy defaults; UTF-16/chunk round trips; damaged metadata; and editor error
recovery. Actual WPS persistence across save/reopen, copying between decks,
and upgrades still needs interactive confirmation before release.

The v0.2.0 candidate passes 28 Python checks and seven JavaScript suites. An
extracted release runtime loaded isolated custom defaults and compiled a custom
macro to SVG and PNG using a saved preamble after its original file was deleted.
Install/reinstall/uninstall tests preserve user preferences. The release is
uncommitted/unpublished and has not been installed over the user's v0.1.x
runtime during development. Native preamble tag persistence is still pending.

The Preamble section can ask the companion to open the configured preamble
file via the desktop association or an explicit `editor_command` argument array.
The action takes no client-provided path or command and checks the same origin
and action header as rendering. Reload is explicit to avoid overwriting an
equation's stored or unsaved preamble; it leaves source, size, and format alone.
`python3 install --refresh` reinstalls the same version for development testing
without discarding the original uninstall baseline or user preferences.

## v0.2.1 editor verification

Automated checks cover editor interaction and compiler line mapping, including
real LaTeX failures. The user confirmed the v0.2.1 editor and connection theme
checks in WPS.
