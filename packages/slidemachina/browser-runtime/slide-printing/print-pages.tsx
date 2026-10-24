import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { waitForPrintedPages } from "./print-readiness.ts";

const printedPageWidth = 1920;
const printViewMargin = 48;

type PrintedPage = { slideIndex: number; revealedStep: number };

type PrintPagesProperties = {
  slideCount: number;
  printsSteps: boolean;
  isPrintView: boolean;
  countSteps: (slideIndex: number) => number;
  renderPrintedSlide: (slideIndex: number, revealedStep: number) => ReactNode;
  renderPrintViewBar: (pageCount: number) => ReactNode;
};

// In the print view a page fills the window width, but never grows past its own size.
function usePrintViewScale(isPrintView: boolean): number {
  const measureScale = () => Math.min(1, (document.documentElement.clientWidth - 2 * printViewMargin) / printedPageWidth);
  const [printViewScale, setPrintViewScale] = useState(measureScale);
  useEffect(() => {
    if (!isPrintView) return;
    const remeasureScale = () => setPrintViewScale(measureScale());
    remeasureScale();
    window.addEventListener("resize", remeasureScale);
    return () => window.removeEventListener("resize", remeasureScale);
  }, [isPrintView]);
  return printViewScale;
}

// One page per slide in its final state, or one page per step: code lines and diagram steps included.
export function listPrintedPages(slideCount: number, printsSteps: boolean, countSteps: (slideIndex: number) => number): PrintedPage[] {
  const printedPages: PrintedPage[] = [];
  for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
    if (!printsSteps) {
      printedPages.push({ slideIndex, revealedStep: Infinity });
      continue;
    }
    for (let revealedStep = 0; revealedStep <= countSteps(slideIndex); revealedStep += 1) printedPages.push({ slideIndex, revealedStep });
  }
  return printedPages;
}

export function PrintPages({ slideCount, printsSteps, isPrintView, countSteps, renderPrintedSlide, renderPrintViewBar }: PrintPagesProperties) {
  const pagesElementReference = useRef<HTMLDivElement>(null);
  const printViewScale = usePrintViewScale(isPrintView);
  const [, setStepCountVersion] = useState(0);
  const printedPages = listPrintedPages(slideCount, printsSteps, countSteps);

  // Slides count their steps once they mount; pages opened right at load are listed again with those counts.
  useLayoutEffect(() => {
    const countedPageTotal = listPrintedPages(slideCount, printsSteps, countSteps).length;
    if (countedPageTotal !== printedPages.length) setStepCountVersion((stepCountVersion) => stepCountVersion + 1);
  });

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
          <div data-print-page key={`${slideIndex}.${revealedStep}`}>
            {renderPrintedSlide(slideIndex, revealedStep)}
          </div>
        ))}
      </div>
      {isPrintView && renderPrintViewBar(printedPages.length)}
    </>
  );
}
