# Installing TeXKoi 0.1.0

This release targets Linux desktops and WPS Presentation. It uses a locally
installed add-in plus a companion that starts when you log in. Rendering works
offline; no terminal needs to stay open. Installation is per-user, without sudo
or systemd. Windows and macOS installers are not included.

## Requirements

- WPS Presentation with JavaScript add-in support. Tested with Arch Linux's
  `wps-office-cn 12.1.2.29183-1`; other builds need verification.
- Python 3.10 or newer.
- TeX Live providing `latex`, `pdflatex`, `kpsewhich`, `standalone.cls`,
  `amsmath.sty`, and `amssymb.sty`.
- `dvisvgm` and Poppler's `pdftocairo`.
- A desktop environment supporting XDG application autostart.

Install dependencies using your distribution's package manager. Dependency
installation may need Internet access; normal equation rendering does not.
No Python packages, Node.js, or npm are required.

## Install

Extract `TeXKoi-v0.1.0-linux.tar.gz`, open its folder in a terminal, and run:

```bash
python3 install doctor --render-check
python3 install
```

Restart WPS Presentation. Open the **TeXKoi** tab and choose **New equation**.
Enter a math fragment without `$` delimiters, then **Render & insert**.
Select a TeXKoi equation and choose **Edit equation** to update it.

The installer copies the runtime into `~/.local/share/texkoi/companion`, adds the
versioned local add-in under `~/.local/share/Kingsoft/wps/jsaddons`, and registers
only the regular TeXKoi entry in WPS's `publish.xml`. It preserves other add-ins,
including TeXKoi Dev. It starts the companion immediately and installs an entry
under `~/.config/autostart` for subsequent desktop logins. XDG overrides apply
to the companion and desktop entry locations; the WPS directory is WPS-specific.

The release uses its own local installer; installation does not require the
experimental publish webpage or an already installed probe. The versioned
installation was confirmed in WPS on the tested build.

## Control and removal

From the extracted release folder:

```bash
python3 install status
python3 install stop
python3 install start
python3 install uninstall
```

You can also start **TeXKoi Companion** from your desktop's application menu.
Stopping it disables rendering until you start it again or log in next time.
Uninstall stops it, removes the installed runtime and its startup entries, and
restores files/TeXKoi registration replaced during installation. Other add-ins
and equations already embedded in presentations remain intact. Restart WPS
after uninstall. Repeating install at the same version is a no-op; uninstall
and reinstall to repair a damaged installation.

If another application occupies port 3901, installation fails rather than using
or terminating that application. Logs live in the companion directory as
`companion.log` and `startup.log`. Do not share `config.json`, the installed
`profile.js`, or `installation.json`: they contain local access credentials.

## Limitations

Updating an equation uses the clipboard and does not preserve animations,
cropping, or custom picture effects. On the tested WPS build, use **Undo update**
and **Redo update** immediately after updating; native Ctrl+Z/Ctrl+Y need two
steps. The dedicated history guards are best-effort and track only the latest
update in the current session. Avoid unrelated edits before using them.

Use your own LaTeX source. Shell escape is disabled and compiler timeouts/file
restrictions apply, but the renderer is not an isolation boundary for untrusted
TeX. Advanced preambles and additional packages are outside v0.1.0's scope.
