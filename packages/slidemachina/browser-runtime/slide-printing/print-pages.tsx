import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { printViewMargin } from "../presentation-core/settings.ts";
import { waitForPrintedPages } from "./print-readiness.ts";

type PrintedPage = { slideIndex: number; revealedStep: number };
type PrintPagesProperties = {
  printedSlideIndexes: number[];
  formatWidth: number;
  printsSteps: boolean;
  isPrintView: boolean;
  countSteps: (slideIndex: number) => number;
  renderPrintedSlide: (slideIndex: number, revealedStep: number) => ReactNode;
  renderPrintViewBar: (pageCount: number) => ReactNode;
};

// In the print view a page fills the window width, but never grows past its own size.
function measurePrintViewScale(formatWidth: number): number {
  return Math.min(1, (document.documentElement.clientWidth - 2 * printViewMargin) / formatWidth);
}

function usePrintViewScale(isPrintView: boolean, formatWidth: number): number {
  const [printViewScale, setPrintViewScale] = useState(() => measurePrintViewScale(formatWidth));
  useEffect(() => {
    if (!isPrintView) return;
    const remeasureScale = () => setPrintViewScale(measurePrintViewScale(formatWidth));
    remeasureScale();
    window.addEventListener("resize", remeasureScale);
    return () => window.removeEventListener("resize", remeasureScale);
  }, [isPrintView, formatWidth]);
  return printViewScale;
}

// One page per slide in its final state, or one page per step: code lines and diagram steps included.
export function listPrintedPages(printedSlideIndexes: number[], printsSteps: boolean, countSteps: (slideIndex: number) => number): PrintedPage[] {
  const printedPages: PrintedPage[] = [];
  for (const slideIndex of printedSlideIndexes) {
    if (!printsSteps) {
      printedPages.push({ slideIndex, revealedStep: Infinity });
      continue;
    }
    for (let revealedStep = 0; revealedStep <= countSteps(slideIndex); revealedStep += 1) printedPages.push({ slideIndex, revealedStep });
  }
  return printedPages;
}

export function PrintPages({ printedSlideIndexes, formatWidth, printsSteps, isPrintView, countSteps, renderPrintedSlide, renderPrintViewBar }: PrintPagesProperties) {
  const pagesElementReference = useRef<HTMLDivElement>(null);
  const printViewScale = usePrintViewScale(isPrintView, formatWidth);
  const [printedPages, setPrintedPages] = useState(() => listPrintedPages(printedSlideIndexes, printsSteps, countSteps));

  // Slides count their steps once they mount; pages opened right at load are listed again with those counts.
  useLayoutEffect(() => {
    const countedPages = listPrintedPages(printedSlideIndexes, printsSteps, countSteps);
    // oxlint-disable-next-line react/set-state-in-effect -- step counts arrive in a ref from mounted slides
    if (countedPages.length !== printedPages.length) setPrintedPages(countedPages);
  }, [printedSlideIndexes, printsSteps, countSteps, printedPages]);

  // The mark tells the print view and the PDF build that every diagram and scene is in place.
  useEffect(() => {
    const pagesElement = pagesElementReference.current!;
    let isOutdated = false;
    pagesElement.removeAttribute("data-print-ready");
    void waitForPrintedPages(pagesElement).then(() => isOutdated || pagesElement.setAttribute("data-print-ready", ""));
    return () => {
      isOutdated = true;
    };
  }, [printsSteps, printedPages.length]);

  return (
    <>
      <div
        ref={pagesElementReference}
        data-print-pages
        data-print-view={isPrintView || undefined}
        inert={!isPrintView}
        aria-hidden={!isPrintView}
        style={{ "--print-view-scale": printViewScale } as CSSProperties}
      >
        {printedPages.map(({ slideIndex, revealedStep }) => (
          <div data-print-page data-print-slide={slideIndex} key={`${slideIndex}.${revealedStep}`}>
            {renderPrintedSlide(slideIndex, revealedStep)}
          </div>
        ))}
      </div>
      {isPrintView && renderPrintViewBar(printedPages.length)}
    </>
  );
}
