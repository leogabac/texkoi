# Installation design

TeXKoi uses a locally installed WPS add-in and a companion that serves its
editor and compiles equations on loopback. Linux desktop login startup uses
XDG autostart; systemd is not required. No Internet is needed during use.

The [WPS deployment documentation](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/wps-addin-development-instructions)
describes its add-in publishing system. We tested an offline archive built and
published with wpsjs 2.2.3. WPS downloaded and loaded the package from its local
jsaddons directory. The distribution server was only needed to deliver that
initial package, not for its local ribbon.

## Why a companion

WPS documents [ShellExecute](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/OAAssist/member/ShellExecute)
as a process/URL launch API. On the tested Linux build, the following did not
launch a marker-writing helper:

- Python with arguments, using both its command name and absolute path.
- A directly executable helper with a Python shebang and no arguments.
- A registered texkoi:// URI through ShellExecute and window.open.
- A normal URI link clicked directly in a WPS dialog.

The helper and desktop protocol association worked outside WPS. WPS returned
null without a marker or external-application prompt. writeFileString was
exposed but rejected tested absolute paths. These observations do not prove all
WPS editions lack these capabilities; their precise cause was not established.
No security policy or OEM settings were disabled to make the tests pass.

Systemd socket activation was considered, but not adopted. Instead the existing
renderer became a companion with desktop login startup. The installed add-in
opens its editor on the companion's private loopback endpoint. The user confirmed
that workflow and then confirmed it still worked following a fresh PC reboot.

## Release packaging

The v0.1.0 bundle's local installer copies assets into TeXKoi_0.1.0, registers
the regular TeXKoi entry, installs the companion and desktop startup entries,
and starts it. It does not need wpsjs, a publish webpage, a distribution server,
or the old probe installation. Unrelated WPS registrations are preserved.

The earlier probe implementation and detailed investigation are retained in Git
at commit 8aea5a3. Experimental runtime scripts are removed from the release.
The user confirmed the standalone v0.1.0 registration and WPS smoke test.
Windows/macOS can use the same companion protocol, but their installers,
autostart integration and WPS behavior still require implementation and testing.
