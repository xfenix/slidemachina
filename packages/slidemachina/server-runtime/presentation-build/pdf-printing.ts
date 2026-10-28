import { pathToFileURL } from "node:url";
import { printViewHiddenParameter, printViewParameter, printViewStepsValue } from "../../shared-between-runtimes/engine-constants.ts";
import type { SharedChrome } from "./chrome-sharing.ts";

const printedViewport = { width: 1920, height: 1080 };
export const printWaitLimit = 60000;

type PrintChoice = { printsSteps: boolean; printsHidden: boolean };

// "?print=steps&hidden": the print view of the built file with the pages the build asked for.
export function addressPrintView(pagePath: string, { printsSteps, printsHidden }: PrintChoice): string {
  const printViewAddress = new URL(pathToFileURL(pagePath));
  printViewAddress.search = [printsSteps ? `${printViewParameter}=${printViewStepsValue}` : printViewParameter, ...(printsHidden ? [printViewHiddenParameter] : [])].join("&");
  return printViewAddress.href;
}

// Prints the print view of the built one-file page in headless Chrome with the browser's own print styles, as Cmd+P does.
export async function printPdf(pagePath: string, printedPdfPath: string, printChoice: PrintChoice, sharedChrome: SharedChrome): Promise<void> {
  const chromeBrowser = await sharedChrome.openChrome();
  // Pages take the size of the canvas from @page, whatever the window: the window only has to be wide enough for the print view.
  const printedPage = await chromeBrowser.newPage({ viewport: printedViewport });
  try {
    await printedPage.goto(addressPrintView(pagePath, printChoice));
    // The print view marks its pages once every diagram is laid out, every scene drawn and every picture loaded.
    await printedPage.waitForSelector("[data-print-pages][data-print-ready]", { state: "attached", timeout: printWaitLimit });
    await printedPage.pdf({ path: printedPdfPath, preferCSSPageSize: true, printBackground: true });
  } finally {
    await printedPage.close();
  }
}
