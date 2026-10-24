# TeXKoi

Editable LaTeX equations for **WPS Presentation on Linux**, inspired by
[IguanaTex](https://github.com/Jonathan-LeRoux/IguanaTex).

Write an equation, preview it, and insert it as an SVG or transparent PNG. The
LaTeX source stays attached to the equation in your presentation, so you can
select it later and edit it. TeXKoi renders locally through a small companion
that starts when you log in. It needs no Internet connection during use and
no terminal left open.

The editor includes size/format controls, keyboard shortcuts, WPS light/dark
theme adaptation, and equation update actions. SVG output uses outlined glyphs.
The initial release targets Linux; Windows and macOS are future work.

## Installation

1. Install **WPS Presentation with JavaScript add-in support**, **Python 3.10+**,
   **TeX Live**, **dvisvgm**, and **Poppler** using your distribution's package
   manager. TeX Live must include `standalone`, `amsmath`, and `amssymb`; the
   required commands are `wpp`, `latex`, `pdflatex`, `kpsewhich`, `dvisvgm`, and
   `pdftocairo`. Package names vary by distribution.
2. Download and extract the source archive, or clone this repository. Open a
   terminal in the extracted project folder containing `install`.
3. Check dependencies and install for your user:

   ```bash
   python3 install doctor --render-check
   python3 install
   ```

4. Restart WPS Presentation, open the **TeXKoi** tab, and choose **New equation**.
   Enter math without `$` delimiters, then click **Render & insert**. Select an
   equation and choose **Edit equation** to change it later.

Installation needs no sudo, Node.js, npm, or systemd. It copies the companion
and add-in into your user directories, starts the companion, and enables desktop
login startup. You can close the terminal and move or remove the downloaded
project folder afterward. WPS and the TeX dependencies must remain installed.
The tested setup is Arch Linux with `wps-office-cn 12.1.2.29183-1`.

To control or remove TeXKoi, run these from a project/release folder containing
`install` (download it again if necessary):

```bash
python3 install status
python3 install stop
python3 install start
python3 install uninstall
```

Uninstall preserves other WPS add-ins and equations already in your slides.
See [installation details](INSTALL.md) for paths, troubleshooting and limitations,
and [changes](CHANGELOG.md) for v0.1.0.

## Undo and redo

On the tested WPS build, a complete equation update takes **Ctrl+Z twice** to
undo and **Ctrl+Y twice** to redo. TeXKoi provides **Undo update** and **Redo
update** as a guarded workaround. Use them immediately after updating, before
unrelated edits. Updates also overwrite the clipboard.

## AI disclosure

TeXKoi is being developed with AI assistance from OpenAI Codex, using GPT-6.1 Sol.
AI assistance has been used for research, implementation, and documentation.
The project author tests the WPS workflows; automated tests cover the renderer,
installer, and simulated host behavior.

## License

[MIT](LICENSE). IguanaTex is credited as inspiration; TeXKoi does not include
its source code or assets.
