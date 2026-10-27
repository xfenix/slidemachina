import * as Machina from "slidemachina";

// Shows the step of its own slide: a custom component reads it with useSlide().
// It lives in its own file: a module that exports only components keeps hot updates of index.tsx without a page reload.
export function StepMeter() {
  const slide = Machina.useSlide();
  return (
    <figure className="machina-big-number">
      <p>{Number.isFinite(slide.step) ? slide.step : "все"}</p>
      <figcaption>шаг этого слайда</figcaption>
    </figure>
  );
}
