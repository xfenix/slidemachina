import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { printedStepsStorageKey } from "./engine-constants.js";


// Pages appear synchronously on beforeprint. Chrome may lay them out again until its dialog closes, so they go on the next press on the page.
export function usePrintPreparation() {
  const [printsSteps, setPrintsSteps] = useState(() => localStorage.getItem(printedStepsStorageKey) === "true");
  const [isPrintPrepared, setPrintPrepared] = useState(false);

  useEffect(() => {
    localStorage.setItem(printedStepsStorageKey, String(printsSteps));
  }, [printsSteps]);

  useEffect(() => {
    const preparePrint = () => flushSync(() => setPrintPrepared(true));
    const removePages = () => {
      window.removeEventListener("pointerdown", removePages, true);
      window.removeEventListener("keydown", removePages, true);
      setPrintPrepared(false);
    };
    const finishPrint = () => {
      window.addEventListener("pointerdown", removePages, true);
      window.addEventListener("keydown", removePages, true);
    };
    window.addEventListener("beforeprint", preparePrint);
    window.addEventListener("afterprint", finishPrint);
    return () => {
      window.removeEventListener("beforeprint", preparePrint);
      window.removeEventListener("afterprint", finishPrint);
      window.removeEventListener("pointerdown", removePages, true);
      window.removeEventListener("keydown", removePages, true);
    };
  }, []);

  return {
    isPrintPrepared,
    printsSteps,
    printPresentation: (withSteps: boolean) => {
      flushSync(() => {
        setPrintsSteps(withSteps);
        setPrintPrepared(true);
      });
      window.print();
    },
  };
}

type PrintPagesProperties = {
  slideCount: number;
  printsSteps: boolean;
  countSteps: (slideIndex: number) => number;
  renderPrintedSlide: (slideIndex: number, revealedStep: number) => ReactNode;
};

// One page per slide in its final state, or one page per step: code lines and diagram steps included.
export function PrintPages({ slideCount, printsSteps, countSteps, renderPrintedSlide }: PrintPagesProperties) {
  const printedPages: Array<{ slideIndex: number; revealedStep: number }> = [];
  for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
    if (!printsSteps) {
      printedPages.push({ slideIndex, revealedStep: Infinity });
      continue;
    }
    for (let revealedStep = 0; revealedStep <= countSteps(slideIndex); revealedStep += 1) printedPages.push({ slideIndex, revealedStep });
  }
  return (
    <div data-print-pages inert aria-hidden>
      {printedPages.map(({ slideIndex, revealedStep }) => (
        <div data-print-page key={`${slideIndex}.${revealedStep}`}>
          {renderPrintedSlide(slideIndex, revealedStep)}
        </div>
      ))}
    </div>
  );
}
