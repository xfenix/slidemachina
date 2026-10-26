import { useLayoutEffect, type RefObject } from "react";

// A diagram this close to the full width grows to it: its right edge stands on the frame line, the text grows unnoticeably.
const frameReachShare = 0.03;

function measureContainerWidth(figureElement: HTMLElement): number {
  const containerElement = figureElement.parentElement!;
  const containerStyle = getComputedStyle(containerElement);
  return containerElement.clientWidth - Number.parseFloat(containerStyle.paddingLeft) - Number.parseFloat(containerStyle.paddingRight);
}

// A diagram fills the free space: it shrinks to fit and grows up to --diagram-max-scale, keeping its proportions.
export function useDiagramScaling(figureElementReference: RefObject<HTMLElement | null>, diagramWidth: number, diagramHeight: number) {
  useLayoutEffect(() => {
    const figureElement = figureElementReference.current;
    if (figureElement === null || diagramWidth === 0 || diagramHeight === 0) return;
    const fitDiagram = () => {
      const settingScale = Number.parseFloat(getComputedStyle(figureElement).getPropertyValue("--diagram-max-scale")) || 1;
      const fillingScale = measureContainerWidth(figureElement) / diagramWidth;
      const reachesFrame = fillingScale > settingScale && fillingScale <= settingScale * (1 + frameReachShare);
      const largestScale = reachesFrame ? fillingScale : settingScale;
      figureElement.style.setProperty("--diagram-largest-scale", String(largestScale));
      const fittingScale = Math.min(largestScale, figureElement.clientWidth / diagramWidth, figureElement.clientHeight / diagramHeight);
      figureElement.style.setProperty("--diagram-scale", String(fittingScale));
    };
    fitDiagram();
    const sizeObserver = new ResizeObserver(fitDiagram);
    sizeObserver.observe(figureElement);
    sizeObserver.observe(figureElement.parentElement!);
    return () => sizeObserver.disconnect();
  }, [figureElementReference, diagramWidth, diagramHeight]);
}
