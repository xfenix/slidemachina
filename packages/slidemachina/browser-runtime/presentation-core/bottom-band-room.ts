import { useLayoutEffect, type RefObject } from "react";

// A pinned block across the whole width at the bottom edge is a band: the content stands in the space above it.
const bottomBandSelector = ":scope > .machina-pin-bottom.machina-pin-left.machina-pin-right";

// Padding keeps the box the band and its percentages are measured from, so the measure never changes the band itself.
function reserveBandRoom(contentElement: HTMLElement) {
  const bandElements = [...contentElement.querySelectorAll<HTMLElement>(bottomBandSelector)];
  const bandTop = Math.min(...bandElements.map((bandElement) => bandElement.offsetTop));
  const bandRoom = contentElement.clientHeight - bandTop;
  if (bandElements.length === 0 || bandRoom <= 0) contentElement.style.removeProperty("--bottom-band-room");
  else contentElement.style.setProperty("--bottom-band-room", `${bandRoom}px`);
}

export function useBottomBandRoom(slideElementReference: RefObject<HTMLElement | null>, slideContent: unknown) {
  useLayoutEffect(() => {
    const contentElement = slideElementReference.current?.querySelector<HTMLElement>(":scope > [data-content]");
    if (contentElement === null || contentElement === undefined) return;
    reserveBandRoom(contentElement);
    const bandElements = contentElement.querySelectorAll<HTMLElement>(bottomBandSelector);
    if (bandElements.length === 0) return;
    let refitFrame = 0;
    const sizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(refitFrame);
      refitFrame = requestAnimationFrame(() => reserveBandRoom(contentElement));
    });
    sizeObserver.observe(contentElement);
    for (const bandElement of bandElements) sizeObserver.observe(bandElement);
    return () => {
      sizeObserver.disconnect();
      cancelAnimationFrame(refitFrame);
    };
  }, [slideElementReference, slideContent]);
}
