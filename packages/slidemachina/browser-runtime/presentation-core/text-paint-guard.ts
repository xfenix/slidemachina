import { useLayoutEffect, type RefObject } from "react";

// Chromium paints a background clipped to the text only inside a trimmed line box, so a trimmed block with a gradient fill loses the tops of its glyphs.
function releaseTrimBehindClippedTextFill(slideElement: HTMLElement) {
  for (const descendantElement of slideElement.querySelectorAll<HTMLElement>("*")) {
    const descendantStyle = getComputedStyle(descendantElement);
    const clipsFillToText = descendantStyle.backgroundClip === "text" || descendantStyle.getPropertyValue("-webkit-background-clip") === "text";
    if (clipsFillToText) descendantElement.style.setProperty("text-box", "normal");
  }
}

export function useTextPaintGuard(slideElementReference: RefObject<HTMLElement | null>, slideContent: unknown, isSlideDistant: boolean) {
  useLayoutEffect(() => {
    if (isSlideDistant) return;
    const slideElement = slideElementReference.current;
    if (slideElement === null) return;
    releaseTrimBehindClippedTextFill(slideElement);
  }, [slideElementReference, slideContent, isSlideDistant]);
}
