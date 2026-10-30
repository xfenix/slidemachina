import { useLayoutEffect, type RefObject } from "react";

export type WidthFitting = {
  // The text that must not stick out; it is measured on one line, as wide as it wants to be.
  findTextElement: (fittedElement: HTMLElement) => HTMLElement | null;
  // How wide the text may be, for the font size the element has at that moment.
  measureRoom: (fittedElement: HTMLElement) => number;
  smallestFontSize: number;
};

// A number wider than its column gets a smaller font, so neighbouring numbers never run into each other.
const bigNumberWidthFitting: WidthFitting = {
  findTextElement: (numberElement) => numberElement,
  measureRoom: (numberElement) => numberElement.parentElement?.clientWidth ?? 0,
  smallestFontSize: 64,
};

// Too wide text gets a smaller font down to smallestFontSize, then data-overflowing: its CSS wraps the lines.
function fitToWidth(fittedElement: HTMLElement, widthFitting: WidthFitting) {
  fittedElement.style.removeProperty("font-size");
  fittedElement.removeAttribute("data-overflowing");
  const textElement = widthFitting.findTextElement(fittedElement);
  if (textElement === null) return;
  const naturalWidth = textElement.scrollWidth;
  const roomWidth = widthFitting.measureRoom(fittedElement);
  if (naturalWidth <= roomWidth || roomWidth <= 0) return;
  const naturalFontSize = Number.parseFloat(getComputedStyle(fittedElement).fontSize);
  // A smaller font shrinks the padding in em too, so the room is measured again after the change.
  const fittedFontSize = Math.max(widthFitting.smallestFontSize, Math.floor((naturalFontSize * roomWidth) / naturalWidth));
  fittedElement.style.fontSize = `${fittedFontSize}px`;
  if (textElement.scrollWidth > widthFitting.measureRoom(fittedElement) + 1) fittedElement.setAttribute("data-overflowing", "");
}

// The room's width is watched, not the element's: its height follows the font and would loop.
function watchWidthFitting(fittedElement: HTMLElement, widthFitting: WidthFitting): () => void {
  const roomElement = fittedElement.parentElement;
  if (roomElement === null) return () => {};
  let fittedRoomWidth = roomElement.clientWidth;
  let refitFrame = 0;
  const refitElement = () => fitToWidth(fittedElement, widthFitting);
  const refitWhenWidthChanges = () => {
    if (roomElement.clientWidth === fittedRoomWidth) return;
    fittedRoomWidth = roomElement.clientWidth;
    cancelAnimationFrame(refitFrame);
    refitFrame = requestAnimationFrame(refitElement);
  };
  refitElement();
  const sizeObserver = new ResizeObserver(refitWhenWidthChanges);
  sizeObserver.observe(roomElement);
  void document.fonts.ready.then(refitElement);
  return () => {
    sizeObserver.disconnect();
    cancelAnimationFrame(refitFrame);
  };
}

export function useWidthFitting(
  fittedElementReference: RefObject<HTMLElement | null>,
  widthFitting: WidthFitting,
  fittedContent: unknown,
  isSlideDistant: boolean,
) {
  useLayoutEffect(() => {
    const fittedElement = fittedElementReference.current;
    if (fittedElement === null || isSlideDistant) return;
    return watchWidthFitting(fittedElement, widthFitting);
  }, [fittedElementReference, widthFitting, fittedContent, isSlideDistant]);
}

// <figure className="machina-big-number"> is plain markup, so the slide finds its numbers itself.
export function useBigNumberFitting(slideElementReference: RefObject<HTMLElement | null>, slideContent: unknown, isSlideDistant: boolean) {
  useLayoutEffect(() => {
    if (isSlideDistant) return;
    const numberElements = slideElementReference.current?.querySelectorAll<HTMLElement>(".machina-big-number > p") ?? [];
    const stopWatchers = [...numberElements].map((numberElement) => watchWidthFitting(numberElement, bigNumberWidthFitting));
    return () => {
      for (const stopWatcher of stopWatchers) stopWatcher();
    };
  }, [slideElementReference, slideContent, isSlideDistant]);
}
