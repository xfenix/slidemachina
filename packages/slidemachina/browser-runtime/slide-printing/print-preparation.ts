import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { printedStepsStorageKey, printViewParameter, printViewStepsValue } from "../../shared-between-runtimes/engine-constants.js";
import { waitForPrintedPages } from "./print-readiness.ts";

function readPrintViewRequest(): { isPrintView: boolean; printsSteps?: boolean } {
  const searchParameters = new URLSearchParams(location.search);
  const requestedValue = searchParameters.get(printViewParameter);
  if (requestedValue === null) return { isPrintView: false };
  return { isPrintView: true, printsSteps: requestedValue === printViewStepsValue };
}

// "?print" or "?print=steps"; the slide position in the hash stays.
function describePrintViewAddress(isPrintView: boolean, printsSteps: boolean): string {
  const pageAddress = new URL(location.href);
  pageAddress.searchParams.delete(printViewParameter);
  if (isPrintView) pageAddress.searchParams.set(printViewParameter, printsSteps ? printViewStepsValue : "");
  pageAddress.search = pageAddress.search.replace(new RegExp(`([?&]${printViewParameter})=(?=&|$)`), "$1");
  return pageAddress.href;
}

// Pages appear synchronously on beforeprint. Chrome may lay them out again until its dialog closes, so they go on the next press on the page.
export function usePrintPreparation() {
  const [isPrintView, setPrintView] = useState(() => readPrintViewRequest().isPrintView);
  const [printsSteps, setPrintsSteps] = useState(
    () => readPrintViewRequest().printsSteps ?? localStorage.getItem(printedStepsStorageKey) === "true",
  );
  const [isPrintPrepared, setPrintPrepared] = useState(false);
  const isPrintingReference = useRef(false);

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
    const followAddress = () => {
      const printViewRequest = readPrintViewRequest();
      setPrintView(printViewRequest.isPrintView);
      if (printViewRequest.printsSteps !== undefined) setPrintsSteps(printViewRequest.printsSteps);
    };
    window.addEventListener("beforeprint", preparePrint);
    window.addEventListener("afterprint", finishPrint);
    window.addEventListener("popstate", followAddress);
    return () => {
      window.removeEventListener("beforeprint", preparePrint);
      window.removeEventListener("afterprint", finishPrint);
      window.removeEventListener("popstate", followAddress);
      window.removeEventListener("pointerdown", removePages, true);
      window.removeEventListener("keydown", removePages, true);
    };
  }, []);

  // The dialog opens once every diagram is laid out and every scene drawn, or they would print empty.
  const printPresentation = async () => {
    if (isPrintingReference.current) return;
    isPrintingReference.current = true;
    flushSync(() => setPrintPrepared(true));
    const pagesElement = document.querySelector<HTMLElement>("[data-print-pages]");
    if (pagesElement !== null) await waitForPrintedPages(pagesElement);
    isPrintingReference.current = false;
    window.print();
  };

  // Cmd+P goes through the same wait; the browser's own Print menu item still gets the pages on beforeprint.
  useEffect(() => {
    const interceptPrintShortcut = (keyboardEvent: KeyboardEvent) => {
      const isPrintShortcut = (keyboardEvent.metaKey || keyboardEvent.ctrlKey) && !keyboardEvent.altKey && keyboardEvent.code === "KeyP";
      if (!isPrintShortcut) return;
      keyboardEvent.preventDefault();
      void printPresentation();
    };
    window.addEventListener("keydown", interceptPrintShortcut, true);
    return () => window.removeEventListener("keydown", interceptPrintShortcut, true);
  });

  const showPrintView = (shownAsPrintView: boolean, shownSteps: boolean) => {
    history.pushState(history.state, "", describePrintViewAddress(shownAsPrintView, shownSteps));
    setPrintView(shownAsPrintView);
  };

  return {
    isPrintView,
    isPrintPrepared: isPrintPrepared || isPrintView,
    printsSteps,
    printPresentation,
    choosePrintedSteps: (withSteps: boolean) => {
      setPrintsSteps(withSteps);
      if (isPrintView) history.replaceState(history.state, "", describePrintViewAddress(true, withSteps));
    },
    openPrintView: () => showPrintView(true, printsSteps),
    closePrintView: () => showPrintView(false, printsSteps),
  };
}
