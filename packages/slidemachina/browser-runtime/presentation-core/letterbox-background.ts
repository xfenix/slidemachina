import { useLayoutEffect, type RefObject } from "react";
import { isBackgroundColor, type SlideTone } from "./background-tone.ts";

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
    presentationElement.style.setProperty("--current-slide-background", letterboxColor);
  }, [slideElementReference, isCurrentSlide, slideTone, backgroundValue]);
}
