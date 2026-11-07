import { useLayoutEffect, type RefObject } from "react";

// Fired on the slide right after steps are marked, so blocks such as <Code lines> follow in the same frame.
export const stepChangeEventName = "slidemachina-steps";
// Names the step attributes the engine wrote on an element: a sequence's step and effect, or the slide's default effect.
// A changed or removed data-steps or stepEffect takes them back.
const writtenStepMark = "data-written-step";
// The step just revealed, one forward from the step before: only it plays an animation such as glitch.
const arrivingStepMark = "data-step-arriving";
// Steps a slide re-renders with nothing to redo: no signature walk, no marking pass. A DOM edit flips the flag.
const structureDirtyFlags = new WeakMap<HTMLElement, boolean>();
const structureObservers = new WeakMap<HTMLElement, MutationObserver>();
const lastRevealedSteps = new WeakMap<HTMLElement, number>();
const stepStructureSignatures = new WeakMap<HTMLElement, string>();
const countedSteps = new WeakMap<HTMLElement, number>();
const elementIdentifiers = new WeakMap<HTMLElement, number>();
const slideRenderStates = new WeakMap<HTMLElement, string>();
// Hot reload replaces step elements without a step change: a new update count re-marks every rendered slide.
let hotUpdateCounter = 0;
let lastElementIdentifier = 0;
import.meta.hot?.on("vite:afterUpdate", () => {
  hotUpdateCounter += 1;
});
const markedStepStates = new WeakMap<HTMLElement, { revealedStep: number; hotUpdateCounter: number }>();

export function useStepVisibility(
  slideElementReference: RefObject<HTMLElement | null>,
  revealedStep: number,
  reportStepCount: (stepCount: number) => void,
  isCurrentSlide: boolean,
  isSlideNearby: boolean,
) {
  // Runs after every render: hot reload and nested components may replace step elements.
  // A key press finds its slide untouched most of the time, so the cheap guards run first and the signature walk only on a real change.
  useLayoutEffect(() => {
    const slideElement = slideElementReference.current;
    if (slideElement === null) return;
    // One observer per slide: it outlives bails, and a WeakMap lets both go with the element.
    if (!structureObservers.has(slideElement)) {
      const structureObserver = new MutationObserver(() => structureDirtyFlags.set(slideElement, true));
      structureObserver.observe(slideElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-steps", "data-step", "data-step-effect"],
      });
      structureObservers.set(slideElement, structureObserver);
    }
    const renderState = `${isCurrentSlide} ${isSlideNearby}`;
    const markedState = markedStepStates.get(slideElement);
    const structureUnchanged =
      structureDirtyFlags.get(slideElement) !== true &&
      markedState !== undefined &&
      markedState.revealedStep === revealedStep &&
      markedState.hotUpdateCounter === hotUpdateCounter &&
      slideRenderStates.get(slideElement) === renderState;
    if (structureUnchanged) {
      reportStepCount(countedSteps.get(slideElement) ?? 0);
      return;
    }
    const structureSignature = readStepStructureSignature(slideElement);
    const shouldNotify =
      markedState?.revealedStep !== revealedStep ||
      markedState.hotUpdateCounter !== hotUpdateCounter ||
      stepStructureSignatures.get(slideElement) !== structureSignature ||
      slideRenderStates.get(slideElement) !== renderState;
    reportStepCount(markReachedSteps(slideElement, revealedStep, structureSignature));
    slideRenderStates.set(slideElement, renderState);
    structureDirtyFlags.set(slideElement, false);
    if (shouldNotify) slideElement.dispatchEvent(new Event(stepChangeEventName));
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

function readElementIdentifier(element: HTMLElement): number {
  const knownIdentifier = elementIdentifiers.get(element);
  if (knownIdentifier !== undefined) return knownIdentifier;
  lastElementIdentifier += 1;
  elementIdentifiers.set(element, lastElementIdentifier);
  return lastElementIdentifier;
}

function readStepStructureSignature(slideElement: HTMLElement): string {
  const sequenceSignatures = [...slideElement.querySelectorAll<HTMLElement>("[data-steps]")].map((sequenceElement) => [
    readElementIdentifier(sequenceElement),
    sequenceElement.dataset.steps,
    sequenceElement.dataset.stepEffect,
    listSequenceItems(sequenceElement).map((sequenceItem) => [readElementIdentifier(sequenceItem), sequenceItem.dataset.step, sequenceItem.dataset.stepEffect, sequenceItem.getAttribute(writtenStepMark)]),
  ]);
  const stepSignatures = [...slideElement.querySelectorAll<HTMLElement>("[data-step]")].map((stepElement) => [
    readElementIdentifier(stepElement),
    stepElement.dataset.step,
    stepElement.dataset.stepEffect,
    stepElement.getAttribute(writtenStepMark),
  ]);
  return JSON.stringify([slideElement.dataset.defaultStepEffect, sequenceSignatures, stepSignatures]);
}

// Returns the number of steps on the slide.
export function markReachedSteps(slideElement: HTMLElement, revealedStep: number, structureSignature = readStepStructureSignature(slideElement)): number {
  const markedState = markedStepStates.get(slideElement);
  if (markedState?.revealedStep === revealedStep && markedState.hotUpdateCounter === hotUpdateCounter && stepStructureSignatures.get(slideElement) === structureSignature) {
    return countedSteps.get(slideElement) ?? 0;
  }
  if (stepStructureSignatures.get(slideElement) !== structureSignature) {
    markSequenceSteps(slideElement);
    markDefaultEffects(slideElement);
    stepStructureSignatures.set(slideElement, readStepStructureSignature(slideElement));
  }
  const stepElements = [...slideElement.querySelectorAll<HTMLElement>("[data-step]")];
  const stepCount = numberStepElements(stepElements);
  countedSteps.set(slideElement, stepCount);
  for (const stepElement of stepElements) {
    stepElement.toggleAttribute("data-step-reached", Number(stepElement.dataset.stepIndex) <= revealedStep);
  }
  markArrivingSteps(slideElement, stepElements, revealedStep);
  markedStepStates.set(slideElement, { revealedStep, hotUpdateCounter });
  return stepCount;
}

// A bare step comes right after everything above it; a numbered step lands on its own number.
function numberStepElements(stepElements: HTMLElement[]): number {
  let lastStepNumber = 0;
  for (const stepElement of stepElements) {
    const explicitStepNumber = Number.parseInt(stepElement.dataset.step ?? "", 10);
    const stepNumber = Number.isInteger(explicitStepNumber) ? explicitStepNumber : lastStepNumber + 1;
    const stepIndex = String(stepNumber);
    if (stepElement.dataset.stepIndex !== stepIndex) stepElement.dataset.stepIndex = stepIndex;
    lastStepNumber = Math.max(lastStepNumber, stepNumber);
  }
  return lastStepNumber;
}
