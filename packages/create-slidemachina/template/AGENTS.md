# A slidemachina presentation

Slides are in `index.tsx`, the theme is in `style.css`, pictures are in `images/`.
In a repository of talks every presentation has its own folder, and the shared theme is `theme/style.css`.

Read the reference before the first edit: `node_modules/slidemachina/llms.txt`.
It lists every component, class, step, transition and theme variable.

## Commands

```bash
npm run dev                       # slides in the browser, a change shows up at once on the same step
npm run check                     # the rules of a clear talk; exit code 1 when there are remarks
npx slidemachina shot 5           # slide 5 as slide-5.png; 5.2 is after two steps
npx slidemachina check --json     # the same remarks with the place in the file and the slide number
npm run build                     # an HTML file, a website, PDF or PowerPoint
```

In a repository of talks the commands take the folder: `npx slidemachina shot 5 my-talk`.
These are plain shell commands, there is no MCP server to connect.

## How to work

1. Theses first, slides second. One thought is one slide, and its `h2` states that thought.
2. Write slide text in the language of the presentation, the `lang` of `Presentation`.
3. What the speaker says aloud goes to `<Machina.Notes>`, not on the slide.
4. Show complex things by steps: `data-steps` on a list, `step` on diagram parts, `lines` on code.
5. After an edit, run `npm run check` and fix the remarks.
6. After layout work, shoot the changed slides with `npx slidemachina shot` and look at the pictures. Code does not tell you whether text overlaps or a diagram is readable.
7. Styling changes only `style.css`: theme variables first, then plain CSS. Take colors and fonts from the user's brand.

## Rules of a clear talk

They come from Richard Mayer's principles of multimedia learning and Miller's 7±2 limit of working memory.
Details with markup examples: `.claude/skills/slidemachina/references/learning-principles.md`.

- A list has 3 to 5 items, at most 7.
- At most 40 words on a slide. What you say goes to the notes. Details and theses for the copy you send go to a hidden slide, `<Machina.Slide hidden>`: it is skipped on stage and kept in print, PDF and PowerPoint.
- A diagram shows at most 9 boxes per step; use groups, steps or `Focus` otherwise.
- Code longer than 12 lines goes by steps with `lines`.
- At most three columns, numbers or cards in a row.
- At most 7 sections in a talk.
- Words stand next to what they explain: a caption under a picture, a `label` on an arrow.
- Emphasis is `highlight` and `Focus`, not bold text and exclamation marks.
- A picture belongs on a slide only when it explains something. Decoration distracts.
