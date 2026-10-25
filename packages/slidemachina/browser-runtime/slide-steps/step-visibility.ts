import { useLayoutEffect, type RefObject } from "react";

// Fired on the slide right after steps are marked, so blocks such as <Code lines> follow in the same frame.
export const stepChangeEventName = "slidemachina-steps";
// Names the step attributes a sequence wrote on its item, so a changed or removed data-steps can take them back.
const sequenceStepMark = "data-sequence-step";

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
  for (const markedItem of slideElement.querySelectorAll<HTMLElement>(`[${sequenceStepMark}]`)) {
    for (const writtenAttribute of markedItem.getAttribute(sequenceStepMark)!.split(" ")) markedItem.removeAttribute(writtenAttribute);
    markedItem.removeAttribute(sequenceStepMark);
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
      sequenceItem.setAttribute(sequenceStepMark, writtenAttributes.join(" "));
    });
  }
}

// Returns the number of steps on the slide.
export function markReachedSteps(slideElement: HTMLElement, revealedStep: number): number {
  markSequenceSteps(slideElement);
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
