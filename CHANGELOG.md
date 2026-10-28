# Changelog

## 0.2.0 — Unreleased

- Add user configuration for the default equation size and output format, plus
  a custom preamble file with packages and macros. New equations reload these
  settings without restarting the companion.
- Add a collapsible Preamble section for per-equation changes, with buttons to
  edit the custom file in your preferred editor and reload it. Configure an
  explicit editor command when the desktop default is unsuitable.
- Save the effective preamble with each equation and verify its metadata after
  paste before replacing an original. Editing uses this saved snapshot even
  after the user configuration or preamble file changes.
- Preserve the original built-in preamble and saved size/format for v0.1.x
  equations instead of applying new configuration to them.
- Refresh an existing installation of the same version with `install --refresh`,
  preserving user configuration.
- Validate configuration and preambles with actionable errors; doctor checks
  configured preambles when compiling samples. User configuration is retained
  across uninstall/reinstall.

## 0.1.1 — 2026-10-28

- Show a local connection screen with Retry when the companion cannot be
  reached, rather than opening an unavailable editor page.
- Preserve editable source and show actionable messages for render connection,
  authorization, and unexpected-response errors.
- Report obsolete TeXKoi trust records in doctor and provide `repair-trust`.
  Repair backs up the trust file, requires WPS document hosts to be closed,
  and leaves current/other add-in approvals to WPS.
- Ignore surrounding whitespace in equation input so trailing editor newlines
  do not cause a spurious “Missing $ inserted” compilation error, including
  when retrying after a failed compile.

## 0.1.0 — 2026-10-24

Initial Linux version for editable LaTeX equations in WPS Slides.

- Local SVG and transparent PNG rendering, with source and settings saved in
  the presentation.
- Equation insertion and updates that preserve position, rotation, layer order,
  and manual scale.
- Compact editor with preview, keyboard shortcuts, WPS theme adaptation, and
  automatic closing after insertion/update.
- Ribbon icons, equation selection focus, and guarded undo/redo compatibility
  actions for the tested WPS build.
- Installed companion with desktop login startup, independent of systemd.
- Per-user versioned installer, dependency checks, removal/restoration, and
  a separate TeXKoi Dev profile for checkout development.

The companion workflow and reboot startup were confirmed on Arch Linux with
WPS `12.1.2.29183`. The user also confirmed the standalone v0.1.0 installation
after restarting WPS. No release tag or published release has been created.
