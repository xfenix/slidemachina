# slidemachina

## Goal

We are building an engine for HTML presentations modeled on reveal.js. The name is `slidemachina`.
It should be simpler to use, more modern and better looking than reveal.js.

Today the talks are made with reveal.js 4:
- `~/web/private-presentations`
- `~/web/conference-presentations/revealjs`

They show which features are needed in practice: section slides, lists with fragments, full-slide pictures, code highlighting, speaker notes, breadcrumbs, printing to PDF.

## Stages

The final document is `docs/slidemachina.md` (in Russian).
The current stage has its own file: `docs/stage48.md`, then `docs/stage49.md` and so on.
The stage file says what was done, which decisions were made and why, and what remains.

When a stage is closed, its outcome moves to `docs/slidemachina.md` and the stage file is deleted.
The outcome is decisions and reasons. The search history and measurements stay out.
What was not done goes to the section about what remains.

Stages 1–44, 46 and 47 were closed on October 28, 2026, including the second 36 (line breaks) and 37 (hidden slides). Their outcome is condensed in `docs/slidemachina.md`.

A new stage starts with a clean context.
Everything needed for the work comes from the project files: `AGENTS.md`, `docs/slidemachina.md`, the current stage file, the code.
So before moving to a new stage, finish the current stage file: whatever is not in the files is lost.

## Code

The rules of this section and of "Tests" are mandatory. No exceptions.

Modules are small. Each one does one thing.
Keep folder nesting as shallow as possible.
Remove an extra level if the logic and order of the project do not suffer.
Code is clear without comments: names explain everything.
Write a comment only when the code cannot be understood without it.

Names are long and descriptive, at least 8 characters. This applies to everything: variables, functions, classes, files.
No generic names like `data`, `user`, `item`, `result`.
A name says what is inside: not `data` but `parsedSlideMarkup`.
Function names are always verbs.
Constants, types and interfaces are grouped at the top of the file.
Declarations of one kind go in a row without blank lines between them: constants, types, interfaces.
Magic numbers are forbidden: always use constants with meaningful names.

## Tests

No unit tests.
As few tests as possible.
Write integration tests. Start with the ones that cover the most in one run.
Tests are high level: they check what the user sees, the page, the build output, the command output, not internal functions.
Tests generate their data: the test itself creates the presentation, slides, texts and pictures. Use ready examples only when generating them costs more than the check is worth.

## Texts

Every text for people goes through the `humanizer`, `humanizer-ru` and `infostyle` skills.
This covers documentation, README, engine messages and the text of demo slides.
The goal: common terms and plain language.
Write `AGENTS.md` in English. When the owner adds a rule in Russian, translate it to English here.
