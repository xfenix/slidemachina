import { useLayoutEffect, type RefObject } from "react";

// Flex no longer shrinks a floated picture, so the slide gives it the height left under the blocks above:
// the picture ends on the bottom line of the content and keeps clear of the breadcrumbs and number.
function fitFloatsToHeight(contentElement: HTMLElement) {
  for (const floatElement of contentElement.querySelectorAll<HTMLElement>("[data-media-float]")) {
    floatElement.style.removeProperty("--float-room-height");
    const roomHeight = contentElement.clientHeight - floatElement.offsetTop;
    if (roomHeight > 0) floatElement.style.setProperty("--float-room-height", `${roomHeight}px`);
  }
}

export function useFloatFitting(slideElementReference: RefObject<HTMLElement | null>, slideContent: unknown) {
  useLayoutEffect(() => {
    const contentElement = slideElementReference.current?.querySelector<HTMLElement>(":scope > [data-content]");
    if (contentElement === null || contentElement === undefined || contentElement.querySelector("[data-media-float]") === null) return;
    let refitFrame = 0;
    const refitFloats = () => {
      cancelAnimationFrame(refitFrame);
      refitFrame = requestAnimationFrame(() => fitFloatsToHeight(contentElement));
    };
    fitFloatsToHeight(contentElement);
    const sizeObserver = new ResizeObserver(refitFloats);
    sizeObserver.observe(contentElement);
    void document.fonts.ready.then(refitFloats);
    return () => {
      sizeObserver.disconnect();
      cancelAnimationFrame(refitFrame);
    };
  }, [slideElementReference, slideContent]);
}
