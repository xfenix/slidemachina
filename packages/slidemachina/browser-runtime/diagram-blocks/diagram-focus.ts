import { useLayoutEffect, type RefObject } from "react";
import { stepChangeEventName } from "../slide-steps/step-visibility.ts";

// The reached marker with the highest step wins; a marker without step is on from the start.
function findActiveMarker(diagramElement: HTMLElement): HTMLElement | undefined {
  let activeMarker: HTMLElement | undefined;
  let activeStepNumber = -1;
  for (const focusMarker of diagramElement.querySelectorAll<HTMLElement>("[data-focus-marker]")) {
    const isStepMarker = focusMarker.hasAttribute("data-step");
    if (isStepMarker && !focusMarker.hasAttribute("data-step-reached")) continue;
    const markerStepNumber = isStepMarker ? Number(focusMarker.dataset.stepIndex) : 0;
    if (markerStepNumber >= activeStepNumber) {
      activeMarker = focusMarker;
      activeStepNumber = markerStepNumber;
    }
  }
  return activeMarker;
}

function splitIdentifierList(attributeValue: string | undefined): string[] {
  return (attributeValue ?? "").split(" ").filter(Boolean);
}

// A part is lit by its id or a lit group around it; an arrow also when both its ends are chosen.
function applyFocus(diagramElement: HTMLElement) {
  const focusedIdentifiers = new Set(splitIdentifierList(findActiveMarker(diagramElement)?.dataset.focusMarker));
  const focusableElements = [...diagramElement.querySelectorAll<HTMLElement>("[data-focus-id]")];
  const isFocusing = focusedIdentifiers.size > 0;
  diagramElement.toggleAttribute("data-focusing", isFocusing);
  const chosenNodes = new Set<string>();
  const litNodes = new Set<string>();
  for (const focusableElement of focusableElements) {
    const enclosingGroups = splitIdentifierList(focusableElement.dataset.focusGroups);
    const nodeIdentifier = focusableElement.dataset.focusId!;
    if (focusedIdentifiers.has(nodeIdentifier) || enclosingGroups.some((groupIdentifier) => focusedIdentifiers.has(groupIdentifier))) {
      chosenNodes.add(nodeIdentifier);
      litNodes.add(nodeIdentifier);
      for (const endIdentifier of splitIdentifierList(focusableElement.dataset.focusEnds)) litNodes.add(endIdentifier);
    }
  }
  for (const focusableElement of focusableElements) {
    if (!litNodes.has(focusableElement.dataset.focusId!)) continue;
    for (const groupIdentifier of splitIdentifierList(focusableElement.dataset.focusGroups)) litNodes.add(groupIdentifier);
  }
  for (const focusableElement of focusableElements) {
    const arrowEnds = splitIdentifierList(focusableElement.dataset.focusEnds);
    const isFocusLit =
      litNodes.has(focusableElement.dataset.focusId!) ||
      (arrowEnds.length === 2 && arrowEnds.every((endIdentifier) => chosenNodes.has(endIdentifier)));
    if (isFocusing) focusableElement.dataset.focus = isFocusLit ? "on" : "off";
    else delete focusableElement.dataset.focus;
  }
}

// Focus is set straight in the DOM, like lit code lines: a slide transition snapshots it in the right state.
export function useFocusSteps(diagramElementReference: RefObject<HTMLElement | null>) {
  // Runs after every render: hot reload brings new parts without the focus marks.
  useLayoutEffect(() => {
    const diagramElement = diagramElementReference.current;
    const slideElement = diagramElement?.closest<HTMLElement>("[data-slide]");
    if (diagramElement === null || diagramElement === undefined || slideElement === null || slideElement === undefined) return;
    const showReachedFocus = () => applyFocus(diagramElement);
    showReachedFocus();
    slideElement.addEventListener(stepChangeEventName, showReachedFocus);
    return () => slideElement.removeEventListener(stepChangeEventName, showReachedFocus);
  });
}
