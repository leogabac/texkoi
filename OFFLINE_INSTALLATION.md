# Offline installation investigation

The intended installed product is **TeXKoi**. The current localhost development
profile is **TeXKoi Dev**. The regular offline product is not implemented or
validated yet; it must not silently depend on the Dev server.

## WPS package installation

WPS recommends `wpsjs publish`, which produces a publication/install page and
supports an offline package. The page uses WPS's add-in manager to install or
enable the add-in and create `publish.xml`. On Linux the registration directory
is `~/.local/share/Kingsoft/wps/jsaddons`. This is distinct from installing a
systemd service. See the [official deployment guide](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/wps-addin-development-instructions).

For a local Linux installer, investigate copying a versioned bundle into that
directory and registering it as a local `jsplugin` (rather than the current
`jspluginonline`). Existing implementations use a local directory/URI, but the
exact naming and URL form must be tested on our WPS build before adopting it.
Do not modify OEM settings or replace unrelated add-in registrations.

## Investigated rendering without a service (not working on this build)

WPS documents [OAAssist.ShellExecute](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/OAAssist/member/ShellExecute)
for launching an external process with parameters. It also documents
[FileSystem](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/FileSystem/obj)
for temporary directories and file I/O, including
[writeFileString](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/FileSystem/member/writeFileString).
These suggested the following server-free native bridge. The launch proof below failed on the tested build, so this remains an unimplemented design:

1. WPS loads the installed HTML, JavaScript, icons, and ribbon locally.
2. The editor writes a JSON render request to an owned temporary directory.
3. ShellExecute starts a bundled Python helper with only the request-file path.
   LaTeX source stays in the request file, never in shell arguments.
4. The helper reuses the existing renderer and writes an atomic JSON result
   containing image path, dimensions, or compiler error, then exits.
5. The editor polls that result through FileSystem and previews the local image.
   The tested paste-based insertion/update and guarded undo actions stay intact.

No always-running server, open terminal, systemd unit, or online connection is
needed **if these APIs work for the locally installed add-in on this build**.
TeX Live, Python, and image converters remain external dependencies. WPS may
request permission to launch the helper; investigate normal authorization,
without disabling WPS security protections.

## Proof required before packaging

First make an isolated local add-in that loads with the Dev server stopped.
Its button should launch a tiny helper that writes a marker; read the marker
back using FileSystem. This proves both local loading and native process/file
access, which online documentation alone does not establish for this edition.

Then implement and test the JSON worker handoff, timeout/errors, paths with
spaces, non-ASCII source, SVG/PNG local previews, source persistence, and the
undo workaround. Replace HTTP render calls, absolute dialog URLs, theme HTTP
requests, and Dev-only profiles in the installed bundle. Resolve theme settings
through local file access or a worker result. Check that Dev and regular
registrations can coexist without tab/history collisions.

Only after these pass should an installer produce a versioned offline archive
with assets, helper, license, dependency checks, and reversible registration.
An AUR package can later install the chosen runtime and add-in bundle; the runtime architecture remains to be implemented.

## Current evidence

- TeXKoi Dev works with WPS Linux 12.1.2.29183.
- Server and source profiles are separated in code; the regular name is reserved.
- Local package loading from `file:` is confirmed interactively.
- `mkdtempSync` creates temporary directories. `writeFileString` rejects the
  tested absolute file paths. Other filesystem writes remain unverified.
- Both parameterized Python and direct executable helper launches returned null
  without producing entry/result markers. Native helper launching is not working
  through these calls on this build. The reason is not established.
- The full offline rendering product is not implemented or validated.

## Official publish proof prepared (2026-10-24)

Downloaded the official npm `wpsjs@2.2.3` tarball and installed the tool in
`/tmp/texkoi-wpsjs-source/tool` with npm lifecycle scripts disabled. No global
Node installation was changed. The package's Linux 7za binary needed its
executable bit restored because its lifecycle scripts were skipped.

Probe source is in `packaging/offline-probe`; stage it once using
`python scripts/prepare_offline_probe.py`. The generated working project lives
in ignored `dist/offline-probe/project`. From that directory, the actual tool
commands used were:

```bash
node /tmp/texkoi-wpsjs-source/tool/node_modules/wpsjs/src/index.js build
# choose the second option: 离线插件 (offline add-in)
node /tmp/texkoi-wpsjs-source/tool/node_modules/wpsjs/src/index.js publish -s http://127.0.0.1:3990/
```

Build first, publish second. The archive is `wps-addon-build/TeXKoi.7z`; it
contains `TeXKoi_0.0.1/` with the test ribbon, JS, HTML, helper, and license.
Publish outputs `wps-addon-publish/publish.html` pointing to that archive with
`online: "false"`, `addonType: "wpp"`, and version `0.0.1`.

The tool ships a sample publication record named test123. Its temporary
`src/lib/publishlist.json` was cleared before republishing so the generated
page offers only the TeXKoi probe in addition to existing local registrations.
The distribution files and SHA-256 provenance are in `dist/offline-probe/site`.
A temporary loopback HTTP server on port 3990 serves that directory. This
server distributes the installation, not the runtime interface or compiler.
Keep it running through the first WPS restart/download; only then stop it to
test genuinely offline loading.

The page communicates with WPS's own installer relay on port 58890. Initially
that port was unavailable and the page displayed no add-in rows. We inspected
the Linux `/usr/bin/wps` protocol handling, then started the exact vendor relay:

```bash
/usr/lib/office6/wpscloudsvr /jsapihttpserver 'ksowpscloudsvr://start=RelayHttpServer'
```

After startup `/version` returned `1.0.3`, and the page populated. The generated
page uses a mixed-case scheme, whereas the installed launch script checks a
lowercase scheme; normal browser protocol launching needs further verification.
No OEM or security settings were changed to start the relay.

Install was clicked for TeXKoi only. WPS itself wrote a `jsplugin` entry with
archive URL, version, and install origin to publish.xml, and its native
`/publishlist` response reports TeXKoi offline while retaining TeXKoi Dev online.
After refreshing, the page shows TeXKoi as 卸载 (Uninstall), 状态 正常 (valid).
The package is registered, but extraction/loading has not yet been observed
because the existing WPS process has not been restarted.

Next: save work and restart WPS. Look for the regular **TeXKoi** tab with the
**Offline installation test** group. Click **Check offline package** and report
the displayed page URL and capabilities. **Test local helper** then tries to
launch bundled helper.py via ShellExecute and read its JSON marker. Direct
Python execution of the helper passed; WPS invocation is unverified. This is
a probe only; use TeXKoi Dev for the functional equation editor.

If the helper-path URL is not `file:`, or filesystem/process APIs fail, report
the exact output rather than switching silently back to the Dev server.

## First native helper test and diagnostic patch

The user confirmed the offline package loaded from a local file URL and all
tested filesystem/process API names are callable. Helper attempts timed out;
the created temporary directories were empty. Direct execution of the installed
helper passed, including under WPS's PATH/loader-variable values.

The test now uses `/usr/bin/python3` rather than a bare python3 command, writes
launch.json with the exact argument string and API return value, and writes
helper-started.json in the probe directory before inspecting Python arguments.
The installed probe main.js/helper.py were patched for diagnosis with backups
ending `.before-helper-diagnostics`; source in packaging/offline-probe matches.
The previously generated 0.0.1 archive is the original test, not this diagnostic
patch. A new official build/version will be needed before redistributing it.
No conclusion about native process support is established yet.

## Direct executable isolation test

The parameterized `/usr/bin/python3` launch returned null and no Python entry
marker appeared. `writeFileString` rejects the full diagnostic path with
`path cannot contains "/" or "\\"`; optional logging was removed from the
launch path. API presence and a null return do not establish process support.

The next installed/source probe executes helper.py directly, with a Python
shebang and executable permission, and passes no arguments. It performs no WPS
file writes. Python writes its result next to the probe; the reader requires a
fresh timestamp, so stale results cannot report success. This isolates process
launching from parameter parsing. Its WPS result is pending. No security policy
settings were changed. The distribution archive remains the older probe.

## Outcome and recommended next implementation

The user also tested the argument-free executable helper: null return, no
fresh result. Its shebang and executable permissions were checked, and a copied
helper executed directly outside WPS produced valid JSON. Stop treating
ShellExecute as a usable rendering bridge for this build. These tests do not
prove that all WPS Linux versions lack process support, nor distinguish an
unsupported implementation from an authorization problem.

Recommended fallback: install the WPS add-in locally and package a separate
per-user renderer, automatically started by a systemd socket on loopback.
[systemd socket activation](https://www.freedesktop.org/software/systemd/man/latest/systemd.socket.html)
starts a matching service on incoming traffic. The renderer must explicitly
accept the inherited listening socket; the current development HTTP server
does not do so. This still uses a local HTTP service, but needs neither an
open terminal nor a manual startup and requires no Internet for rendering.

Before adopting it, prove a request from the installed WPS file page can reach
the loopback renderer with appropriate CORS and per-install authorization.
Use a separate port/profile from TeXKoi Dev, retain the existing cross-origin
compiler protection, and give installation a reversible uninstall path. Check
restart/login behavior and rendering with both development and distribution
servers stopped. No service or automatic startup has been installed yet.

## Custom URI launch probe

The next experiment uses an OS protocol handler, not a systemd service.
`scripts/install_protocol_probe.py` registers a per-user `texkoi://` handler,
copies the strict probe worker into the user data directory, and patches the
installed test add-in with separate **Test URI via WPS** and **Test URI via
browser** actions. The installer records previous files and MIME association;
`python scripts/install_protocol_probe.py --remove` restores them. No handler
was previously registered on the tested machine.

The worker accepts only `texkoi://probe?token=<32 lowercase hex digits>` and
writes a marker under the user's cache directory. It accepts no commands or
output paths. Each WPS test uses a fresh token. Linux `xdg-open` successfully
launched the installed worker and produced a matching JSON marker; invalid URI
checks passed. WPS launch and WPS marker-reading results remain pending.

The probe is a Linux installation experiment, not the final cross-platform
installer. Windows/macOS registration and WPS compatibility require their own
implementations/tests. A successful URI launch would establish only launching,
not the full editor/renderer request and response transport.

The native and window.open URI attempts from ribbon callbacks both timed out.
Direct inspection found no matching marker files, so this is a launch failure,
not merely WPS failing to read a successful result. The OS protocol association
remains registered. The browser probe now opens a WPS dialog with a real anchor
link, clicked directly by the user. This isolates browser user-activation rules
from native ribbon callbacks. Its result remains pending; protocol dispatch
from WPS is still unproven.

## Companion route implemented for testing

The direct link in the WPS dialog also produced no marker or external-application
prompt, according to the user. The temporary protocol handler has been removed
using its restoration script. No custom URL handler is required by the current
companion.

The implementation is in scripts/companion.py and scripts/companion_install.py.
It installs a copied runtime, Linux desktop login autostart/application entries,
and the regular add-in assets into the existing WPS-installed local package.
The local ribbon's profile redirects its editor dialog to the private loopback
companion on port 3901. It is intentionally distinct from TeXKoi Dev on 3899.
No publish.xml edits or systemd units were needed.

The copied installed runtime has passed actual SVG/PNG rendering and image
retrieval with the Dev and distribution servers absent. The full automated suite
passes; actual WPS integration and real desktop login startup remain pending.
See DEVELOPMENT.md for controls, restoration and limitations of this interim
installer. This supersedes the earlier recommended systemd fallback.
