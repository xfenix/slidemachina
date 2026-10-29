import { findShownSlide, type SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";

export type PresentationPosition = {
  slideIndex: number;
  stepIndex: number;
};

// "#7" is slide 7 before any steps, "#7.2" is slide 7 after two steps, "#7+1" the first hidden slide after slide 7.
export function readPositionFromHash(slideNumbering: SlideNumbering): PresentationPosition {
  const [slideAddress = "", stepText = ""] = location.hash.slice(1).split(".");
  const addressedSlideIndex = slideNumbering.slideAddresses.indexOf(slideAddress);
  const stepIndex = Number.parseInt(stepText, 10);
  return {
    slideIndex: addressedSlideIndex === -1 ? findShownSlide(slideNumbering, Number.parseInt(slideAddress, 10) || 1) : addressedSlideIndex,
    stepIndex: stepIndex > 0 ? stepIndex : 0,
  };
}

export function writePositionToHash(presentationPosition: PresentationPosition, slideAddresses: string[]) {
  const slideAddress = slideAddresses[presentationPosition.slideIndex] ?? String(presentationPosition.slideIndex + 1);
  const positionHash = presentationPosition.stepIndex > 0 ? `#${slideAddress}.${presentationPosition.stepIndex}` : `#${slideAddress}`;
  if (location.hash !== positionHash) history.replaceState(history.state, "", positionHash);
}
