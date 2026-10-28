import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  printedHiddenStorageKey,
  printedStepsStorageKey,
  printViewHiddenParameter,
  printViewParameter,
  printViewStepsValue,
} from "../../shared-between-runtimes/engine-constants.js";
import { waitForPrintedPages } from "./print-readiness.ts";
import { describeAddressWithParameter } from "../presentation-core/page-address.ts";

type PrintChoice = { printsSteps: boolean; printsHidden: boolean };

function readPrintViewRequest(): { isPrintView: boolean; printChoice?: PrintChoice } {
  const searchParameters = new URLSearchParams(location.search);
  const requestedValue = searchParameters.get(printViewParameter);
  if (requestedValue === null) return { isPrintView: false };
  return { isPrintView: true, printChoice: { printsSteps: requestedValue === printViewStepsValue, printsHidden: searchParameters.has(printViewHiddenParameter) } };
}

function readRememberedChoice(): PrintChoice {
  return {
    printsSteps: localStorage.getItem(printedStepsStorageKey) === "true",
    printsHidden: localStorage.getItem(printedHiddenStorageKey) === "true",
  };
}

// "?print", "?print=steps" or "?print=steps&hidden"; the slide position in the hash stays.
function describePrintViewAddress(isPrintView: boolean, { printsSteps, printsHidden }: PrintChoice): string {
  const printViewValue = printsSteps ? printViewStepsValue : "";
  const printViewAddress = describeAddressWithParameter(printViewParameter, isPrintView ? printViewValue : undefined);
  return describeAddressWithParameter(printViewHiddenParameter, isPrintView && printsHidden ? "" : undefined, printViewAddress);
}

// Pages appear synchronously on beforeprint. Chrome may lay them out again until its dialog closes, so they go on the next press on the page.
export function usePrintPreparation() {
  const [isPrintView, setPrintView] = useState(() => readPrintViewRequest().isPrintView);
  const [printChoice, setPrintChoice] = useState(() => readPrintViewRequest().printChoice ?? readRememberedChoice());
  const [isPrintPrepared, setPrintPrepared] = useState(false);
  const isPrintingReference = useRef(false);

  useEffect(() => {
    localStorage.setItem(printedStepsStorageKey, String(printChoice.printsSteps));
    localStorage.setItem(printedHiddenStorageKey, String(printChoice.printsHidden));
  }, [printChoice]);

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
      if (printViewRequest.printChoice !== undefined) setPrintChoice(printViewRequest.printChoice);
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

  const showPrintView = (shownAsPrintView: boolean) => {
    history.pushState(history.state, "", describePrintViewAddress(shownAsPrintView, printChoice));
    setPrintView(shownAsPrintView);
  };
  const changePrintChoice = (changedChoice: Partial<PrintChoice>) => {
    const nextChoice = { ...printChoice, ...changedChoice };
    setPrintChoice(nextChoice);
    if (isPrintView) history.replaceState(history.state, "", describePrintViewAddress(true, nextChoice));
  };

  return {
    isPrintView,
    isPrintPrepared: isPrintPrepared || isPrintView,
    ...printChoice,
    printPresentation: () => void printPresentation(),
    choosePrintedSteps: (withSteps: boolean) => changePrintChoice({ printsSteps: withSteps }),
    chooseHiddenSlides: (withHidden: boolean) => changePrintChoice({ printsHidden: withHidden }),
    openPrintView: () => showPrintView(true),
    closePrintView: () => showPrintView(false),
  };
}
