# Installing TeXKoi 0.3.0

This release targets Linux desktops and WPS Slides (also called WPS
Presentation). It uses a locally
installed add-in plus a companion that starts when you log in. Rendering works
offline; no terminal needs to stay open. Installation is per-user, without sudo
or systemd. Windows and macOS installers are not included.

## Requirements

- WPS Slides with JavaScript add-in support. Tested with Arch Linux's
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

Download and extract the source archive, clone the repository, or extract a
generated `TeXKoi-v0.3.0-linux.tar.gz` bundle. Open the project folder containing
`install` in a terminal, and run:

```bash
python3 install doctor --render-check
python3 install
```

Restart WPS Slides. Open the **TeXKoi** tab and choose **New equation**.
Enter a math fragment without `$` delimiters, then **Render & insert**.
Select a TeXKoi equation and choose **Edit equation** to update it.

The installer copies the runtime into `~/.local/share/texkoi/companion`, adds the
versioned local add-in under `~/.local/share/Kingsoft/wps/jsaddons`, and registers
only the regular TeXKoi entry in WPS's `publish.xml`. It preserves other add-ins,
including TeXKoi Dev. It starts the companion immediately and installs an entry
under `~/.config/autostart` for subsequent desktop logins. XDG overrides apply
to the companion and desktop entry locations; the WPS directory is WPS-specific.

The installer also creates user settings and a preamble file under
`~/.config/texkoi` if they do not exist. Existing preferences are preserved.
See [configuration and preambles](CONFIGURATION.md). These user files remain
after uninstall; remove them yourself if you want to reset preferences.

The release uses its own local installer; installation does not require the
experimental publish webpage or an already installed probe. The versioned
installation was confirmed in WPS on the tested build.

## Control and removal

From a project or release folder containing `install` (download it again if
you removed the original folder):

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
and reinstall to repair a damaged installation. To refresh an installed version
from an updated checkout while testing, run `python3 install --refresh`, then
restart WPS. The installer keeps your configuration and the original uninstall
backup.

## Troubleshooting

### The TeXKoi tab is missing

Restart WPS Slides after installing or removing the add-in. Check that
your WPS edition supports JavaScript add-ins. The tested build is listed above;
other editions may behave differently.

### The editor cannot connect or rendering does not start

Run `python3 install status`, then `python3 install start` if the companion is
stopped. The editor opening screen has a **Retry** button once the companion
is available. If it stops during editing, your source stays in the editor;
start the companion and render again. Run `python3 install doctor --render-check` to check the required tools
and compile a sample in both output formats. You can also start **TeXKoi
Companion** from your desktop application menu.

If another application occupies port 3901, installation fails rather than using
or terminating that application. Logs live in the companion directory as
`companion.log` and `startup.log`. Do not share `config.json`, the installed
`profile.js`, or `installation.json`: they contain local access credentials.

### WPS repeatedly says TeXKoi changed

One trust prompt after installing a new version is expected. If it repeats
without another update, run `python3 install doctor`. Old package trust records
can conflict with the currently installed version; this happened after the
original test package was replaced.

Save your work and fully quit all WPS document applications, then run:

```bash
python3 install repair-trust
```

This backs up `authaddin.json` and removes only obsolete regular TeXKoi entries.
It preserves the current version's trust decision, TeXKoi Dev, and other add-ins.
It does not approve or disable any security prompt. Open WPS and trust TeXKoi
normally if asked, then fully quit and reopen it. A cloud-browser background
process may remain; the command distinguishes that from document hosts.

If the prompt persists after reboot, report the exact message and the doctor
output. Do not repeatedly reinstall or edit approval flags manually. The repair
worked for reopening WPS on the tested machine; persistence after the following
reboot still needs confirmation.

### Settings or a custom preamble fail to load

Check the named file in the error message, correct it, and try rendering again.
New equations retry loading settings after a configuration error; reopening a
new editor also reloads them. Existing equations use their saved preamble and
can still be edited if the current configuration is invalid. Use
`python3 install doctor --render-check` to validate and compile your configured
preamble. See the [configuration guide](CONFIGURATION.md) for syntax and limits.

### Undo or redo leaves two equations visible

An equation update requires two native undo/redo steps on the tested WPS build.
Use **Undo update** and **Redo update** immediately after updating, before
unrelated edits. The dedicated history guards are best-effort and track only
the latest update in the current session. See the
[development explanation](DEVELOPMENT.md#undoredo-workaround) for the cause we
suspect, the alternative approaches tested, and the limits of the workaround.

## Limitations

Updating an equation uses the clipboard and does not preserve animations,
cropping, or custom picture effects.

Use your own LaTeX source. Shell escape is disabled and compiler timeouts/file
restrictions apply, but the renderer is not an isolation boundary for untrusted
TeX. Custom packages must be installed in your TeX distribution. Alternate
engines, full document input, and automatic package installation are not
provided.
