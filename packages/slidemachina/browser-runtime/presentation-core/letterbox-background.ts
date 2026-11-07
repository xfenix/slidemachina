import { useLayoutEffect, type RefObject } from "react";
import { isBackgroundColor, type SlideTone } from "./background-tone.ts";

// A presentation takes its first letterbox colour without a transition: an effect that reads a computed style commits the dark default before this effect runs, and a transition would flash it at startup.
const presentationsWithInitialLetterbox = new WeakSet<HTMLElement>();

// The margins of a window in another format take the colour of the current slide, so the slide looks wider, not framed.
// A picture has no single colour: a dark one gets the dark background, a light one the colour of the slide under it.
export function useLetterboxBackground(
  slideElementReference: RefObject<HTMLElement | null>,
  isCurrentSlide: boolean,
  slideTone: SlideTone,
  backgroundValue: string | undefined,
) {
  useLayoutEffect(() => {
    const slideElement = slideElementReference.current;
    const presentationElement = slideElement?.closest<HTMLElement>("[data-presentation]");
    if (!isCurrentSlide || slideElement === null || presentationElement === null || presentationElement === undefined) return;
    const hasPicture = backgroundValue !== undefined && !isBackgroundColor(backgroundValue);
    const letterboxColor = hasPicture && slideTone === "dark" ? "var(--dark-background)" : getComputedStyle(slideElement).backgroundColor;
    if (presentationsWithInitialLetterbox.has(presentationElement)) {
      presentationElement.style.setProperty("--current-slide-background", letterboxColor);
      return;
    }
    presentationsWithInitialLetterbox.add(presentationElement);
    const runningTransition = presentationElement.style.transition;
    presentationElement.style.transition = "none";
    presentationElement.style.setProperty("--current-slide-background", letterboxColor);
    requestAnimationFrame(() => {
      presentationElement.style.transition = runningTransition;
    });
  }, [slideElementReference, isCurrentSlide, slideTone, backgroundValue]);
}
