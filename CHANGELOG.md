# Changelog

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
