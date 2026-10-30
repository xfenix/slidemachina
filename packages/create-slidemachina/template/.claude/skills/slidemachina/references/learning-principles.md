# Rules of a clear talk

Two sources:
- Richard E. Mayer's 12 principles of multimedia learning ("Multimedia Learning"): how words and pictures together help understanding instead of getting in the way.
- Miller's magic number 7±2: how many items a person holds in working memory. Later work (Cowan) puts it nearer four, so aim for 3 to 5 and treat 7 as the limit.

`npx slidemachina check` checks the measurable rules. The others are a matter of judgment: follow them, and tell the user when you depart from one.

## Mayer's principles in slidemachina markup

| Principle | What to do | In the markup |
|---|---|---|
| 1. Coherence | Remove whatever does not help understanding: decoration, extra words, background music | No decorative pictures; one thought per slide |
| 2. Signaling | Point out the main thing and the structure | `data-step-effect="highlight"`, `Focus` on a diagram, `machina-lead` with the conclusion, sections |
| 3. Redundancy | Do not repeat the speech as text on the slide | Speech goes to `<Notes>`; the slide has a diagram, a picture or a number |
| 4. Spatial contiguity | Put words next to what they explain | `figcaption` under a picture, `label` on an arrow, text and picture in neighboring columns |
| 5. Temporal contiguity | Show a thing when you talk about it | `data-steps`, `step` on diagram parts, `<Notes step={n}>` |
| 6. Segmenting | Split complex material into parts at the listener's pace | Steps, short sections, a slide for each part of a diagram |
| 7. Pre-training | Name the terms before explaining the mechanism | A slide with the terms at the start of a section; `machina-lead` on the section cover |
| 8. Modality | A picture with speech beats a picture with a paragraph | A diagram on the slide, the explanation in the notes |
| 9. Multimedia | Words with a picture are clearer than words alone | `Diagram`, `Image`, `machina-big-number` instead of a paragraph with figures |
| 10. Personalization | A conversational tone, not bureaucratic language | Address the audience as "you", short phrases, verbs instead of nouns made from verbs |
| 11. Voice | A live human voice | A person gives the talk; the engine has no say here |
| 12. Image | The speaker's face on the slide does not help understanding | No photo of yourself on every slide |

## Miller's limits

| What | Aim | Limit in `check` |
|---|---|---|
| Items in a list | 3 to 5 | 7 |
| Words on a slide, code and notes excluded | up to 25 | 40 |
| Diagram boxes per step | up to 7 | 9 without `Focus` |
| Code lines per step | up to 8 | 12 without `lines` |
| Columns, numbers, cards in a row | 2 to 3 | 3 |
| Sections in a talk | 3 to 5 | 7 |

## Examples

Bad: a slide that is a transcript, the speech repeated as text.

```tsx
<Machina.Slide>
  <h2>Results</h2>
  <p>In the third quarter we sped up request handling: p95 used to be 3.4 seconds, and after the release
  of the new gateway it dropped to 0.5 seconds, which let us handle a 36% growth in traffic.</p>
</Machina.Slide>
```

Good: two numbers on the slide, the explanation spoken.

```tsx
<Machina.Slide>
  <h2>The gateway got 7 times faster</h2>
  <div className="machina-columns" data-steps>
    <figure className="machina-big-number"><p>3.4 s</p><figcaption>p95 before the release</figcaption></figure>
    <figure className="machina-big-number"><p>0.5 s</p><figcaption>p95 after</figcaption></figure>
  </div>
  <Machina.Notes>We sped up in the third quarter, and it carried a 36% growth in traffic.</Machina.Notes>
</Machina.Slide>
```

Bad: a diagram with 12 boxes at once. Good: boxes in groups, groups appearing by steps, `Focus` leading the eye.

```tsx
<Machina.Diagram>
  <Machina.Group id="input" title="Input" step>…</Machina.Group>
  <Machina.Group id="core" title="Processing" step>…</Machina.Group>
  <Machina.Arrow from="input" to="core" step />
  <Machina.Focus on={["core"]} step />
</Machina.Diagram>
```

Bad: a topic heading, "Architecture". Good: a thought heading, "A request passes three services". The heading is the conclusion of the slide that the listener takes away.
