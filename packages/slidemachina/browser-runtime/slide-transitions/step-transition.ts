import { readMorphTiming } from "../element-morphing/morph-timing.ts";

// "jump" is the default: steps just switch. "morph" glides morph-named elements from their old place to the new one.
export type StepTransition = "morph" | "jump";

type RecordedMorphElement = {
  morphElement: HTMLElement;
  previousRectangle: DOMRect;
};

let activeStepAnimations: Animation[] = [];

// A slide change or a new step change supersedes a running one: the element snaps to its final place first.
export function cancelStepTransitions() {
  for (const stepAnimation of activeStepAnimations) stepAnimation.cancel();
  activeStepAnimations = [];
}

// Same-DOM steps cannot use view transition pairs, so morph-named elements move with a FLIP animation:
// the new layout is measured, the old rectangle is restored with a transform, and the transform animates away.
export function runStepTransition(updateSteps: () => void, slideElement: HTMLElement) {
  cancelStepTransitions();
  const morphSelector = "[data-content] [morph]";
  const recordedElements: RecordedMorphElement[] = [...slideElement.querySelectorAll<HTMLElement>(morphSelector)].map((morphElement) => ({
    morphElement,
    previousRectangle: morphElement.getBoundingClientRect(),
  }));
  updateSteps();
  const { durationMilliseconds, easing } = readMorphTiming();
  for (const recordedElement of recordedElements) {
    const { morphElement, previousRectangle } = recordedElement;
    if (!morphElement.isConnected) continue;
    const nextRectangle = morphElement.getBoundingClientRect();
    if (nextRectangle.width === 0 || nextRectangle.height === 0) continue;
    const translateX = previousRectangle.left - nextRectangle.left;
    const translateY = previousRectangle.top - nextRectangle.top;
    const scaleX = previousRectangle.width / nextRectangle.width;
    const scaleY = previousRectangle.height / nextRectangle.height;
    if (Math.abs(translateX) < 0.5 && Math.abs(translateY) < 0.5 && Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) continue;
    const stepAnimation = morphElement.animate(
      [
        { transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`, transformOrigin: "top left" },
        { transform: "translate(0px, 0px) scale(1, 1)", transformOrigin: "top left" },
      ],
      { duration: durationMilliseconds, easing, fill: "both" },
    );
    activeStepAnimations.push(stepAnimation);
    void stepAnimation.finished
      .finally(() => {
        activeStepAnimations = activeStepAnimations.filter((runningAnimation) => runningAnimation !== stepAnimation);
      })
      .catch(() => {});
  }
}
