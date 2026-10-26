import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { pickSourceMarks } from "../presentation-core/source-marks.ts";

export type SourceProperties = {
  children?: ReactNode;
};

// Under the blocks it cites; right under a picture it is as wide as the picture.
export function Source({ children, ...otherProperties }: SourceProperties) {
  const sourceReference = useRef<HTMLParagraphElement>(null);
  useWidthOfMediaAbove(sourceReference);
  return (
    <p ref={sourceReference} data-source {...pickSourceMarks(otherProperties)}>
      {children}
    </p>
  );
}

// A stretched picture is centred in its frame, so the footnote takes both its width and its left edge.
function useWidthOfMediaAbove(sourceReference: RefObject<HTMLParagraphElement | null>) {
  useLayoutEffect(() => {
    const sourceElement = sourceReference.current;
    const blockAbove = sourceElement?.previousElementSibling;
    if (sourceElement === null || blockAbove === null || blockAbove === undefined) return;
    const mediaElement = blockAbove.matches("[data-media]") ? blockAbove : blockAbove.querySelector(":scope[data-media-frame] [data-media]");
    if (!(mediaElement instanceof HTMLElement)) return;
    const followMedia = () => {
      const containerElement = sourceElement.parentElement!;
      const containerBox = containerElement.getBoundingClientRect();
      const canvasScale = containerBox.width / containerElement.offsetWidth || 1;
      sourceElement.style.setProperty("--source-width", `${mediaElement.offsetWidth}px`);
      sourceElement.style.setProperty("--source-offset", `${(mediaElement.getBoundingClientRect().left - containerBox.left) / canvasScale}px`);
    };
    followMedia();
    const sizeObserver = new ResizeObserver(followMedia);
    sizeObserver.observe(mediaElement);
    return () => sizeObserver.disconnect();
  });
}
