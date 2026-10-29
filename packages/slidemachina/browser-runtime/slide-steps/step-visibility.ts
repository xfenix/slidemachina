import { useLayoutEffect, type RefObject } from "react";

// Fired on the slide right after steps are marked, so blocks such as <Code lines> follow in the same frame.
export const stepChangeEventName = "slidemachina-steps";
// Names the step attributes the engine wrote on an element: a sequence's step and effect, or the slide's default effect.
// A changed or removed data-steps or stepEffect takes them back.
const writtenStepMark = "data-written-step";
// The step just revealed, one forward from the step before: only it plays an animation such as glitch.
const arrivingStepMark = "data-step-arriving";
const lastRevealedSteps = new WeakMap<HTMLElement, number>();

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

// Rows of a table, items of a list, columns: the direct parts of the element with data-steps.
function listSequenceItems(sequenceElement: HTMLElement): HTMLElement[] {
  const itemSelector = sequenceElement instanceof HTMLTableElement ? ":scope > tbody > tr" : ":scope > *";
  return [...sequenceElement.querySelectorAll<HTMLElement>(itemSelector)];
}

// <ul data-steps>: every item becomes a step; data-steps={3} puts them on steps 3, 4, 5. An item's own attributes win.
function markSequenceSteps(slideElement: HTMLElement) {
  for (const markedItem of slideElement.querySelectorAll<HTMLElement>(`[${writtenStepMark}]`)) {
    for (const writtenAttribute of markedItem.getAttribute(writtenStepMark)!.split(" ")) markedItem.removeAttribute(writtenAttribute);
    markedItem.removeAttribute(writtenStepMark);
  }
  for (const sequenceElement of slideElement.querySelectorAll<HTMLElement>("[data-steps]")) {
    const firstStepNumber = Number.parseInt(sequenceElement.dataset.steps ?? "", 10);
    const sequenceEffect = sequenceElement.dataset.stepEffect;
    listSequenceItems(sequenceElement).forEach((sequenceItem, itemPosition) => {
      if (sequenceItem.hasAttribute("data-step")) return;
      const writtenAttributes = ["data-step"];
      sequenceItem.dataset.step = Number.isInteger(firstStepNumber) ? String(firstStepNumber + itemPosition) : "";
      if (sequenceEffect !== undefined && !sequenceItem.hasAttribute("data-step-effect")) {
        sequenceItem.dataset.stepEffect = sequenceEffect;
        writtenAttributes.push("data-step-effect");
      }
      sequenceItem.setAttribute(writtenStepMark, writtenAttributes.join(" "));
    });
  }
}

// <Slide stepEffect> or <Presentation stepEffect> goes to every step that names no effect of its own, after the sequences gave theirs.
function markDefaultEffects(slideElement: HTMLElement) {
  const defaultEffect = slideElement.dataset.defaultStepEffect;
  if (defaultEffect === undefined) return;
  for (const stepElement of slideElement.querySelectorAll<HTMLElement>("[data-step]:not([data-step-effect])")) {
    stepElement.dataset.stepEffect = defaultEffect;
    const earlierWrites = stepElement.getAttribute(writtenStepMark);
    stepElement.setAttribute(writtenStepMark, earlierWrites === null ? "data-step-effect" : `${earlierWrites} data-step-effect`);
  }
}

// Marks only a move one step forward: a slide opened again, or opened at its last step, shows its steps in place.
function markArrivingSteps(slideElement: HTMLElement, stepElements: HTMLElement[], revealedStep: number) {
  const previousRevealedStep = lastRevealedSteps.get(slideElement);
  lastRevealedSteps.set(slideElement, revealedStep);
  if (previousRevealedStep === revealedStep) return;
  const movedOneForward = previousRevealedStep === revealedStep - 1;
  for (const stepElement of stepElements) {
    stepElement.toggleAttribute(arrivingStepMark, movedOneForward && Number(stepElement.dataset.stepIndex) === revealedStep);
  }
}

// Returns the number of steps on the slide.
export function markReachedSteps(slideElement: HTMLElement, revealedStep: number): number {
  markSequenceSteps(slideElement);
  markDefaultEffects(slideElement);
  const stepElements = [...slideElement.querySelectorAll<HTMLElement>("[data-step]")];
  const stepCount = numberStepElements(stepElements);
  for (const stepElement of stepElements) {
    stepElement.toggleAttribute("data-step-reached", Number(stepElement.dataset.stepIndex) <= revealedStep);
  }
  markArrivingSteps(slideElement, stepElements, revealedStep);
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
