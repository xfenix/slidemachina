// Named css, not by the verb rule: editors highlight a css`…` template as CSS.
// The slide source plugin moves every top-level css`…` of a slide file into a stylesheet, so the call never runs there.
export function css(styleTemplate: TemplateStringsArray): void {
  throw new Error(`css\`…\` works only as a top-level statement of a slide file: ${styleTemplate.raw.join("").trim().slice(0, 40)}`);
}
