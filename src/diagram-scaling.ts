import { useLayoutEffect, type RefObject } from "react";

// A diagram fills the free space: it shrinks to fit and grows up to --diagram-max-scale, keeping its proportions.
export function useDiagramScaling(figureElementReference: RefObject<HTMLElement | null>, diagramWidth: number, diagramHeight: number) {
  useLayoutEffect(() => {
    const figureElement = figureElementReference.current;
    if (figureElement === null || diagramWidth === 0 || diagramHeight === 0) return;
    const fitDiagram = () => {
      const largestScale = Number.parseFloat(getComputedStyle(figureElement).getPropertyValue("--diagram-max-scale")) || 1;
      const fittingScale = Math.min(largestScale, figureElement.clientWidth / diagramWidth, figureElement.clientHeight / diagramHeight);
      figureElement.style.setProperty("--diagram-scale", String(fittingScale));
    };
    fitDiagram();
    const sizeObserver = new ResizeObserver(fitDiagram);
    sizeObserver.observe(figureElement);
    return () => sizeObserver.disconnect();
  }, [figureElementReference, diagramWidth, diagramHeight]);
}
