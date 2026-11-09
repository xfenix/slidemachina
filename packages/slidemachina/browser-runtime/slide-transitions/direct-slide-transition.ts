// Instant turns need no view-transition snapshots.
const snapshotFreeTransitions = new Set(["none"]);

// The HyperFrames motion capture reads the animations of a view transition:
// while it watches the page, whole-slide turns keep the snapshot path it hooks into.
const snapshotCaptureActiveFlag = "__slidemachinaSnapshotCaptureActive";

export function runsWithoutSnapshots(chosenTransition: string): boolean {
  const captureIsActive = (window as unknown as Record<string, boolean | undefined>)[snapshotCaptureActiveFlag] === true;
  return !captureIsActive && snapshotFreeTransitions.has(chosenTransition);
}

export function runDirectSlideTransition(
  updateSlides: () => void,
  outgoingSlide: HTMLElement,
  incomingSlide: HTMLElement,
  chosenTransition: string,
  isMovingForward: boolean,
) {
  const documentElement = document.documentElement;
  documentElement.dataset.slideTransition = chosenTransition;
  documentElement.dataset.slideDirection = isMovingForward ? "forward" : "backward";
  // Light and dark backgrounds still swap at once in the middle: the letterbox cross-fade greys out otherwise.
  documentElement.toggleAttribute("data-tone-change", outgoingSlide.dataset.tone !== incomingSlide.dataset.tone);
  // The page root carries the transition layers, so it takes the speed of the slide whose transition plays.
  documentElement.style.setProperty("--transition-speed", (isMovingForward ? incomingSlide : outgoingSlide).style.getPropertyValue("--transition-speed") || "1");
  updateSlides();
}
