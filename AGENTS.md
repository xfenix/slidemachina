# slidemachina

## Goal

We are building an engine for HTML presentations modeled on reveal.js. The name is `slidemachina`.
It should be simpler to use, more modern and better looking than reveal.js.

Today the talks are made with reveal.js 4:
- `~/web/private-presentations`
- `~/web/conference-presentations/revealjs`

They show which features are needed in practice: section slides, lists with fragments, full-slide pictures, code highlighting, speaker notes, breadcrumbs, printing to PDF.

## Code

The rules of this section and of "Tests" are mandatory. No exceptions.

Modules are small. Each one does one thing.
Keep folder nesting as shallow as possible.
Remove an extra level if the logic and order of the project do not suffer.
Code is clear without comments: names explain everything.
Write a comment only when the code cannot be understood without it.
A comment says why, never what: delete a comment that restates the line below it.
One component does one thing: a component that renders two unrelated pieces of UI or keeps two unrelated states is two components, or a component plus a hook in its own module.
Code is written in clear plain English: names, comments and user-facing texts use common words, no invented terms or abbreviations.

Names are long and descriptive, at least 8 characters. This applies to everything: variables, functions, classes, files.
No generic names like `data`, `user`, `item`, `result`.
A name says what is inside: not `data` but `parsedSlideMarkup`.
Function names are always verbs.
Magic numbers are forbidden: always use constants with meaningful names.

Engine-internal DOM attributes always carry the `data--slidemachina-` prefix, so a reader of the markup never takes them for authoring attributes.
Attributes an author writes in slides stay short and unprefixed: `data-step`, `data-morph`, `data-morph-path`.

## File structure

Every file keeps one straight order of groups, top to bottom, and a group never comes back:

1. Imports.
2. Constants, types and interfaces of the module: constants in one row, types and interfaces in one row, no blank lines inside a row.
3. The main component, hook or function the file is named after.
4. Local helpers: the non-exported functions the main one uses, in the order they are read.

A constant, a type or an interface is never declared below a function. A file that needs a value in a group above the one being written gets the value from the group that already exists, not the other way around.

Inside a component the same straight order applies: hook calls in one block — a later hook may be preceded only by the plain callbacks it takes as arguments or uses inside — then derived values and event handlers in one block, then the returned JSX. Destructuring the properties belongs to the signature, not to a block. No blank lines inside a block, exactly one blank line between blocks.

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
