# Configuration and custom preambles

TeXKoi 0.2.0 lets you choose defaults for new equations and define your own
LaTeX packages and macros. An equation keeps its effective preamble when you
insert or update it, along with its source, size, and output format.

## User settings

Installation creates `~/.config/texkoi/settings.json` if it does not already
exist. When `XDG_CONFIG_HOME` is set, the directory is `$XDG_CONFIG_HOME/texkoi`.
This is separate from the companion's private `config.json`; do not edit that
runtime file to change equation preferences.

```json
{
  "default_size_pt": 28,
  "default_format": "svg",
  "preamble_file": "preamble.tex"
}
```

- `default_size_pt`: a number from 6 to 144, default 28.
- `default_format`: `svg` or `png`, default `svg`.
- `preamble_file`: an absolute path, a path beginning with `~`, or a path relative
  to the settings directory. Set it to `null` to use only the built-in preamble.

Optionally, set `editor_command` to an array of command arguments to override
which application opens the preamble file. The path is appended as the final
argument. For example, to open Neovim in Kitty:

```json
{
  "default_size_pt": 28,
  "default_format": "svg",
  "preamble_file": "preamble.tex",
  "editor_command": ["kitty", "-e", "nvim"]
}
```

When `editor_command` is omitted or `null`, TeXKoi uses your desktop's default
application for TeX files. An explicit terminal command is useful when your
preferred editor runs in a terminal. Arguments are passed directly, without a
shell.

All keys are optional; unknown keys are errors so typos do not silently change
behavior. JSON uses double quotes and does not allow comments or trailing commas.
If settings.json is absent, built-in defaults apply.

Open a new equation editor to pick up changed settings. No companion restart is
needed. If loading fails, fix the named file and click a render action to retry.
Your equation source stays in the editor. Changes to preferences apply to new
equations, not equations already saved in a presentation.

## A custom preamble

The installer creates `preamble.tex` beside settings.json if needed. Add extra
packages and macros there, for example:

```latex
\newcommand{\vect}[1]{\mathbf{#1}}
\newcommand{\avg}[1]{\left\langle #1 \right\rangle}
```

You can then enter an equation such as:

```latex
\avg{\vect{v}^{2}} = \frac{3 k_{\mathrm{B}} T}{m}
```

`amsmath` and `amssymb` are already loaded before this file. Additional
`\usepackage{...}` commands require those packages to be installed in your
TeX distribution. The file is a preamble fragment: omit `\documentclass`,
`\begin{document}`, and `\end{document}`. The equation itself is still a math
fragment without surrounding dollar signs.

To check your configuration and compile samples with this preamble:

```bash
python3 install doctor --render-check
```

## Changes for one equation

Expand **Preamble** in the equation editor, then choose **Edit custom preamble**
to edit the configured file in your preferred application. After saving there,
choose **Reload file into equation** to bring your changes into the open editor.
Reloading replaces the preamble shown for that equation; it does not change its
source, size, or format. If the file does not exist, an editor that can create
new files may create it when you save.

The Preamble section also shows the full effective preamble,
including the built-in packages. Edit it there to make changes for that equation
only. The editor does not write these changes back to your configuration file.

**Render & insert** or **Render & update** saves this text with the equation.
When you reopen that equation, TeXKoi restores the saved preamble even if you
have changed, moved, or removed the original file. Editing an existing equation
also keeps its saved size and format, regardless of today's defaults.

Equations from v0.1.x have no saved preamble. They continue to use the original
built-in `amsmath`/`amssymb` preamble. Updating one with v0.2.0 adds a snapshot;
your current custom file is not silently applied. You can add macros explicitly
in its Preamble section if you want to use them.

The snapshot stores preamble text, not TeX packages or fonts. Another computer
still needs the packages required by that preamble to regenerate the equation.
Already inserted equations remain embedded images in the presentation.

## Validation and limits

The full effective preamble is limited to 20,000 UTF-16 characters, including
the built-in packages. Unknown settings, invalid values, missing/unreadable
files, and document boundaries in a preamble produce an error. LaTeX compilation
errors retain expandable compiler output in the editor.

Preferences and preamble files are preserved on uninstall. Delete the settings
directory yourself if you want a reset; do not delete it if you keep other files
there. See [installation troubleshooting](INSTALL.md#troubleshooting) and the
[development notes](DEVELOPMENT.md#v020-preferences-and-preamble-snapshots).
