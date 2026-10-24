import { pathToFileURL } from "node:url";
import { printViewParameter, printViewStepsValue } from "../../shared-between-runtimes/engine-constants.js";
import { commandLineTexts } from "../command-line/command-line-texts.js";

export async function launchChrome() {
  const { chromium } = await import("playwright-core");
  try {
    // Without a GPU, as on most CI machines, Chrome needs this flag to draw 3D scenes in software.
    return await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-swiftshader"] });
  } catch {
    throw new Error(commandLineTexts.missingChrome);
  }
}

// Prints the print view of the built one-file page in headless Chrome with the browser's own print styles, as Cmd+P does.
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
    const printViewAddress = new URL(pathToFileURL(pagePath));
    printViewAddress.search = printsSteps ? `${printViewParameter}=${printViewStepsValue}` : printViewParameter;
    await printedPage.goto(printViewAddress.href);
    // The print view marks its pages once every diagram is laid out, every scene drawn and every picture loaded.
    await printedPage.waitForSelector("[data-print-pages][data-print-ready]", { state: "attached", timeout: 60000 });
    await printedPage.pdf({ path: printedPdfPath, preferCSSPageSize: true, printBackground: true });
  } finally {
    await chromeBrowser.close();
  }
}
