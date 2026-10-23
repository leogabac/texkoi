# TeXKoi

TeXKoi is a project to bring editable LaTeX equations to **WPS Presentation on
Linux**, inspired by [IguanaTex](https://github.com/Jonathan-LeRoux/IguanaTex).

The aim is to write LaTeX, render it locally, and insert the result into a slide
while keeping the source attached to the equation. Selecting an equation should
let you edit and regenerate it without rebuilding it from scratch.

TeXKoi is in early development. The current prototype includes a LaTeX source
editor, local compilation, and insertion of SVG or PNG equations with their
source attached. The workflow has been tested interactively in WPS on Linux.
Selected equations can be reopened for editing and regenerated in place.
The edit/update workflow has also been tested interactively.

## Run

With WPS Presentation, Python 3.10+, TeX Live, dvisvgm, and Poppler installed:

```bash
./texkoi
```

This checks dependencies, registers the add-in, and starts its local server.
Leave the terminal running and open WPS Presentation. Restart WPS after first
registration or a ribbon change. Use `./texkoi doctor --render-check` to check
both SVG and PNG rendering.

See [development notes](DEVELOPMENT.md) for setup details and the tested build.

## Known undo/redo issue

On the tested WPS Linux build (`12.1.2.29183`), updating an equation requires
**Ctrl+Z twice** to fully undo and **Ctrl+Y twice** to fully redo. One undo can
leave both the old and new equations visible.

TeXKoi provides **Undo equation update** and **Redo equation update** as a
workaround. Use them immediately after updating, before unrelated edits. They
track only the latest update in the current add-in session and check state
between native commands. They do not replace WPS's keyboard shortcuts. See the
[development notes](DEVELOPMENT.md#undoredo-workaround) for the suspected cause,
guard limitations, and implementation details.

## AI disclosure

TeXKoi is being developed with AI assistance from OpenAI Codex, using GPT-6.1 Sol.
AI assistance has been used for research, implementation, and documentation.
Everything was carefully tested by the project author.


## License

[MIT](LICENSE). IguanaTex is credited as inspiration; this implementation does
not include its source code or assets.
