---
name: slidemachina
description: Writes, edits and styles a slidemachina presentation by the rules of a clear talk (Mayer's principles, Miller's 7±2). Use it when asked to make a presentation, a talk or slides, to add or rework a slide, to style a presentation for a brand, to check the slides, or to build a PDF, HTML or PowerPoint.
---

# A slidemachina presentation

API reference: `node_modules/slidemachina/llms.txt`. Read it before the first edit.
Rules of a clear talk with examples: `references/learning-principles.md`.
Write slide text in the language of the presentation, the `lang` of `Presentation`.
The tools are shell commands: `npm run check`, `npx slidemachina shot <number>`, `npm run build`. There is no MCP server.

## A new talk

1. Ask the user for the topic, the audience, the length and the main thought. If something is missing, propose it yourself and say so.
2. Sketch the theses: one thought per slide. A talk has about as many slides as minutes.
3. Split the theses into 3 to 7 sections (`Machina.Section`). A section adds its own numbered cover.
4. Make the cover of the talk: `<Machina.Slide cover>` with `h1` and `machina-lead`.
5. Lay out the slides. Pick a form for each thought:

| Thought | Form |
|---|---|
| One statement | a thesis: `machina-thesis` on `background="var(--accent-soft-color)"` |
| A number or a result | `machina-big-number`, up to three in a row in `machina-columns` |
| An enumeration | a list with `data-steps`, 3 to 5 items |
| Relations, architecture, a process | `Machina.Diagram`, by steps or with `Focus` |
| Messages over time | `Machina.Sequence` |
| Before and after | two slides with the same heading: morphing shows the difference |
| Code | `Machina.Code` with `lines` by steps |
| A comparison of options | `table className="machina-compare"` |
| A real-life example, an emotion | `Machina.Image full` or `Machina.Meme` |

6. Everything the speaker says aloud goes to `<Machina.Notes>`. Notes for a step are `<Machina.Notes step={2}>`.
7. Details and theses the audience should read later go to `<Machina.Slide hidden>` after the last slide. It is skipped on stage and kept in print, PDF and PowerPoint, the copy people get after the talk.

## Editing a slide

- Find the slide by its heading in `index.tsx`. The slide number for `shot` and the address comes from `npx slidemachina check --json` or from the order in the browser.
- Change only what was asked. Do not rewrite neighboring slides.

## Styling for a brand

All styling lives in `style.css` next to `index.tsx`; do not touch the slide markup.

1. Colors: `--accent-color`, `--second-accent-color`, `--text-color`, `--muted-color`, `--slide-background`, `--dark-background`, `--section-background`. Take them from the user's brand: a style guide, a website or the logo. If no colors are given, ask.
2. Font: a file in `fonts/`, `@font-face`, then `--font-text`, `--font-heading`, `--heading-weight`.
3. Logo: `logo={{ light, dark }}` on `Presentation`; its position is `logo` on `Slide`.
4. Headings, list bullets and section covers are plain CSS. Examples are in the "Theme" section of `llms.txt`.
5. Motion: `transition`, `stepEffect` and `speed` on `Presentation`. A formal talk suits `fade` and `rise`, a bold one suits `glitch`.
6. Shoot the cover, a section cover and a slide with a list using `shot`, and check the contrast: the text must be readable from the back row.

## Before handing over

1. `npm run check` reports nothing. If a rule is broken on purpose, tell the user why.
2. Run `npx slidemachina shot <number>` for every changed slide and look at the picture: nothing overlaps, the diagram is readable, the text is not smaller than the captions.
3. Show the user pictures of the key slides and say what changed.
4. Run the build (`npm run build`) only when asked.
