import { readinessCheckInterval, readinessTimeout } from "../presentation-core/settings.ts";
import { settlePrintedCanvases } from "./canvas-pictures.ts";

// Failed scenes and diagrams mark themselves too; the limit only keeps a hung part from blocking the print.

// Diagrams lay out in a worker and scenes wait for three.js: pages printed before that show them empty.
// A picture without an address counts as complete, so one still being painted, like the demo's cube, waits for its address.
// data-print-pending holds the print for parts that appear later, such as a canvas added after a library loads.
// Canvases are turned into pictures last, once nothing else is pending.
function arePrintedPagesReady(pagesElement: HTMLElement): boolean {
  const unfinishedPart = pagesElement.querySelector("[data-diagram]:not([data-laid-out]):not([data-layout-failed]), [data-scene]:not([data-drawn]), [data-print-pending]");
  const pictureElements = [...pagesElement.querySelectorAll("img")];
  const arePicturesLoaded = pictureElements.every((pictureElement) => pictureElement.complete && pictureElement.currentSrc !== "");
  return document.fonts.status === "loaded" && unfinishedPart === null && arePicturesLoaded && settlePrintedCanvases(pagesElement);
}

export function waitForPrintedPages(pagesElement: HTMLElement): Promise<void> {
  const waitStart = performance.now();
  return new Promise((resolveReadiness) => {
    const checkReadiness = () => {
      if (arePrintedPagesReady(pagesElement) || performance.now() - waitStart > readinessTimeout) resolveReadiness();
      else setTimeout(checkReadiness, readinessCheckInterval);
    };
    checkReadiness();
  });
}
