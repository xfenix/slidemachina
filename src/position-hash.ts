export type PresentationPosition = {
  slideIndex: number;
  stepIndex: number;
};

// "#7" is slide 7 before any steps, "#7.2" is slide 7 after two steps.
export function readPositionFromHash(): PresentationPosition {
  const [slideNumberText = "", stepText = ""] = location.hash.slice(1).split(".");
  const slideNumber = Number.parseInt(slideNumberText, 10);
  const stepIndex = Number.parseInt(stepText, 10);
  return {
    slideIndex: slideNumber > 0 ? slideNumber - 1 : 0,
    stepIndex: stepIndex > 0 ? stepIndex : 0,
  };
}

export function writePositionToHash(presentationPosition: PresentationPosition) {
  const slideNumber = presentationPosition.slideIndex + 1;
  const positionHash =
    presentationPosition.stepIndex > 0 ? `#${slideNumber}.${presentationPosition.stepIndex}` : `#${slideNumber}`;
  if (location.hash !== positionHash) history.replaceState(history.state, "", positionHash);
}
