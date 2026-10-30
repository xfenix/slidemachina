import { useLayoutEffect, type RefObject } from "react";

// A stretched picture sizes itself inside its frame, and CSS gives a neighbour no way to read that width.
function findMediaAbove(sourceElement: HTMLElement): HTMLElement | null {
  const blockAbove = sourceElement.previousElementSibling;
  if (blockAbove === null) return null;
  const mediaElement = blockAbove.matches("[data-media]") ? blockAbove : blockAbove.querySelector(":scope[data-media-frame] [data-media]");
  return mediaElement instanceof HTMLElement ? mediaElement : null;
}

// A stretched picture is centred in its frame, so the footnote takes both its width and its left edge.
function followMediaWidth(sourceElement: HTMLElement, mediaElement: HTMLElement): () => void {
  const fitSourceToMedia = () => {
    const containerElement = sourceElement.parentElement!;
    const containerBox = containerElement.getBoundingClientRect();
    const canvasScale = containerBox.width / containerElement.offsetWidth || 1;
    sourceElement.style.setProperty("--source-width", `${mediaElement.offsetWidth}px`);
    sourceElement.style.setProperty("--source-offset", `${(mediaElement.getBoundingClientRect().left - containerBox.left) / canvasScale}px`);
  };
  fitSourceToMedia();
  const sizeObserver = new ResizeObserver(fitSourceToMedia);
  sizeObserver.observe(mediaElement);
  return () => sizeObserver.disconnect();
}

// <p className="machina-source"> is plain markup, so the slide finds the footnotes under pictures itself.
export function useSourceWidthFitting(slideElementReference: RefObject<HTMLElement | null>, slideContent: unknown, isSlideDistant: boolean) {
  useLayoutEffect(() => {
    if (isSlideDistant) return;
    const sourceElements = slideElementReference.current?.querySelectorAll<HTMLElement>("[data-content] .machina-source") ?? [];
    const stopFollowers = [...sourceElements].flatMap((sourceElement) => {
      sourceElement.style.removeProperty("--source-width");
      sourceElement.style.removeProperty("--source-offset");
      const mediaElement = findMediaAbove(sourceElement);
      return mediaElement === null ? [] : [followMediaWidth(sourceElement, mediaElement)];
    });
    return () => {
      for (const stopFollower of stopFollowers) stopFollower();
    };
  }, [slideElementReference, slideContent, isSlideDistant]);
}
