// Whole-slide transitions without view-transition snapshots: the leaving slide slides away over the arriving one,
// which already stands at its place. Skipping the two snapshot captures takes the heaviest part of a key press
// out of the turn, and the arriving slide never carries a transform, so a jump lands on measurable DOM at once.
const snapshotFreeTransitions = new Set(["slide", "none"]);

// The HyperFrames motion capture reads the animations of a view transition:
// while it watches the page, whole-slide turns keep the snapshot path it hooks into.
const snapshotCaptureActiveFlag = "__slidemachinaSnapshotCaptureActive";

let markedTransitionElements: HTMLElement[] = [];

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
  // A press in the middle of a turn drops the previous marks: the new pair starts from what is on screen now.
  for (const markedElement of markedTransitionElements) {
    markedElement.removeAttribute("data-leaving");
  }
  // The marks go on before the update, so the outgoing slide never flashes hidden between losing data-current and animating.
  if (chosenTransition !== "none") {
    outgoingSlide.setAttribute("data-leaving", "");
    markedTransitionElements = [outgoingSlide];
  } else {
    markedTransitionElements = [];
  }
  updateSlides();
  if (chosenTransition === "none") return;
  const clearLeavingMark = () => {
    outgoingSlide.removeAttribute("data-leaving");
    outgoingSlide.removeEventListener("animationend", clearLeavingMark);
    outgoingSlide.removeEventListener("animationcancel", clearLeavingMark);
  };
  outgoingSlide.addEventListener("animationend", clearLeavingMark);
  outgoingSlide.addEventListener("animationcancel", clearLeavingMark);
}
