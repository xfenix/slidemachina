import { useEffect } from "react";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { PrinterIcon, printShortcut } from "./print-menu.tsx";

type PrintViewBarProperties = {
  languageCode: string;
  pageCount: number;
  printsSteps: boolean;
  choosePrintedSteps: (withSteps: boolean) => void;
  printsHidden: boolean | undefined;
  chooseHiddenSlides: (withHidden: boolean) => void;
  printPresentation: () => void;
  closePrintView: () => void;
};

// The print view keeps the toolbar's capsule: back to the slides, the switches and the print button.
export function PrintViewBar({
  languageCode,
  pageCount,
  printsSteps,
  choosePrintedSteps,
  printsHidden,
  chooseHiddenSlides,
  printPresentation,
  closePrintView,
}: PrintViewBarProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);

  useEffect(() => {
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.code === "Escape") closePrintView();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closePrintView]);

  return (
    <div data-print-view-bar role="toolbar" aria-label={interfaceTexts.printViewTitle}>
      <button type="button" aria-label={interfaceTexts.printViewBackButton} title={interfaceTexts.printViewBackButton} onClick={closePrintView}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M11.5 5L6.5 10l5 5" />
        </svg>
      </button>
      <span data-print-view-count>{interfaceTexts.printViewPageCount(pageCount)}</span>
      <button
        type="button"
        role="switch"
        aria-checked={printsSteps}
        title={interfaceTexts.printStepsHint}
        onClick={() => choosePrintedSteps(!printsSteps)}
      >
        {interfaceTexts.printStepsTitle}
        <span data-print-switch />
      </button>
      {printsHidden !== undefined && (
        <button type="button" role="switch" aria-checked={printsHidden} title={interfaceTexts.printHiddenHint} onClick={() => chooseHiddenSlides(!printsHidden)}>
          {interfaceTexts.printHiddenTitle}
          <span data-print-switch />
        </button>
      )}
      <button type="button" data-print-view-print title={printShortcut} onClick={printPresentation}>
        <PrinterIcon />
        {interfaceTexts.printNowTitle}
      </button>
    </div>
  );
}
