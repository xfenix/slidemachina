import { pathToFileURL } from "node:url";
import { printedStepsStorageKey } from "../src/engine-constants.js";
import { commandLineTexts } from "./command-line-texts.js";

export async function launchChrome() {
  const { chromium } = await import("playwright-core");
  try {
    // Without a GPU, as on most CI machines, Chrome needs this flag to draw 3D scenes in software.
    return await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-swiftshader"] });
  } catch {
    throw new Error(commandLineTexts.missingChrome);
  }
}

// Prints the built one-file page in headless Chrome with the browser's own print styles, as Cmd+P does.
/**
 * @param {string} pagePath
 * @param {string} printedPdfPath
 * @param {boolean} printsSteps
 */
export async function printPdf(pagePath, printedPdfPath, printsSteps) {
  const chromeBrowser = await launchChrome();
  try {
    // The 16:9 window matches the printed page, so printed diagrams reuse the layouts of the slides on screen.
    const printedPage = await chromeBrowser.newPage({ viewport: { width: 1920, height: 1080 } });
    await printedPage.addInitScript(
      ([storageKey, storedValue]) => localStorage.setItem(storageKey, storedValue),
      [printedStepsStorageKey, String(printsSteps)],
    );
    await printedPage.goto(pathToFileURL(pagePath).href);
    await printedPage.waitForFunction(() => document.querySelector("[data-canvas] [data-slide]") !== null);
    await printedPage.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await printedPage.waitForFunction(
      () =>
        document.fonts.status === "loaded" &&
        document.querySelector("[data-print-pages] [data-diagram]:not([data-laid-out]):not([data-layout-failed])") === null &&
        document.querySelector("[data-print-pages] [data-scene]:not([data-drawn])") === null &&
        [...document.images].every((pictureElement) => pictureElement.complete),
    );
    await printedPage.pdf({ path: printedPdfPath, preferCSSPageSize: true, printBackground: true });
  } finally {
    await chromeBrowser.close();
  }
}
