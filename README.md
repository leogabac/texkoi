# TexKoi

TexKoi is a project to bring editable LaTeX equations to **WPS Presentation on
Linux**, inspired by [IguanaTex](https://github.com/Jonathan-LeRoux/IguanaTex).

The aim is to write LaTeX, render it locally, and insert the result into a slide
while keeping the source attached to the equation. Selecting an equation should
let you edit and regenerate it without rebuilding it from scratch.

TexKoi is in early development. The current prototype includes a LaTeX source
editor, local compilation, and insertion of SVG or PNG equations with their
source attached. The workflow has been tested interactively in WPS on Linux.
Editing existing equations is planned.

See [development notes](DEVELOPMENT.md) for setup, the tested WPS build, and
implementation details.

## AI disclosure

TexKoi is being developed with AI assistance from OpenAI Codex, using GPT-6.1 Sol.
AI assistance has been used for research, implementation, and documentation.
Everything was carefully tested by the project author.


## License

[MIT](LICENSE). IguanaTex is credited as inspiration; this implementation does
not include its source code or assets.
