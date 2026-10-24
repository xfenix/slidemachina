import { readinessCheckInterval, readinessTimeout } from "../presentation-core/settings.ts";

// Failed scenes and diagrams mark themselves too; the limit only keeps a hung part from blocking the print.

// Diagrams lay out in a worker and scenes wait for three.js: pages printed before that show them empty.
function arePrintedPagesReady(pagesElement: HTMLElement): boolean {
  const unfinishedPart = pagesElement.querySelector("[data-diagram]:not([data-laid-out]):not([data-layout-failed]), [data-scene]:not([data-drawn])");
  const pictureElements = [...pagesElement.querySelectorAll("img")];
  return document.fonts.status === "loaded" && unfinishedPart === null && pictureElements.every((pictureElement) => pictureElement.complete);
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
