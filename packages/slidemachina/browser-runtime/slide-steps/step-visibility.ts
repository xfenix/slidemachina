import { useLayoutEffect, type RefObject } from "react";

// Fired on the slide right after steps are marked, so blocks such as <Code lines> follow in the same frame.
export const stepChangeEventName = "slidemachina-steps";

export function useStepVisibility(
  slideElementReference: RefObject<HTMLElement | null>,
  revealedStep: number,
  reportStepCount: (stepCount: number) => void,
) {
  // Runs after every render: hot reload and nested components may replace step elements.
  useLayoutEffect(() => {
    const slideElement = slideElementReference.current;
    if (slideElement === null) return;
    reportStepCount(markReachedSteps(slideElement, revealedStep));
    slideElement.dispatchEvent(new Event(stepChangeEventName));
  });
}

// Returns the number of steps on the slide.
export function markReachedSteps(slideElement: HTMLElement, revealedStep: number): number {
  const stepElements = [...slideElement.querySelectorAll<HTMLElement>("[data-step]")];
  const stepCount = numberStepElements(stepElements);
  for (const stepElement of stepElements) {
    stepElement.toggleAttribute("data-step-reached", Number(stepElement.dataset.stepIndex) <= revealedStep);
  }
  return stepCount;
}

// A bare step comes right after everything above it; a numbered step lands on its own number.
function numberStepElements(stepElements: HTMLElement[]): number {
  let lastStepNumber = 0;
  for (const stepElement of stepElements) {
    const explicitStepNumber = Number.parseInt(stepElement.dataset.step ?? "", 10);
    const stepNumber = Number.isInteger(explicitStepNumber) ? explicitStepNumber : lastStepNumber + 1;
    stepElement.dataset.stepIndex = String(stepNumber);
    lastStepNumber = Math.max(lastStepNumber, stepNumber);
  }
  return lastStepNumber;
}
