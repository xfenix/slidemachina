import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { openWorkingTabs, shareWorkBetweenTabs, shootPageClip } from "./chrome-sharing.ts";
import { addressPrintView, printWaitLimit } from "./pdf-printing.ts";
import { escapeHtml } from "./html-escaping.ts";
import type { Browser, Page } from "playwright-core";
import type { SharedChrome } from "./chrome-sharing.ts";

// Half the 1920×1080 canvas: sharp in the Quick Look window, light enough for a few dozen slides.
const previewPictureWidth = 960;
const previewPictureQuality = 70;
const printedViewport = { width: 1920, height: 1080 };
// Quick Look shows nothing for a bigger HTML file: 9.7 MB renders, 11 MB does not.
export const quickLookSizeLimit = 10 * 1024 * 1024;
// Quick Look renders the page without scripts, so <noscript> shows; the engine hides overflow, the preview scrolls.
const previewStyle = `<style>
      html, body { overflow: auto; background: var(--navigator-background, #0e1018); }
      [data-script-free-preview] { display: flex; flex-direction: column; gap: 24px; max-width: ${previewPictureWidth}px; margin: 0 auto; padding: 24px; }
      [data-script-free-preview] img { display: block; width: 100%; height: auto; border-radius: 8px; }
    </style>`;

type SlidePicture = { pictureBytes: Buffer, slideHeading: string };

async function openPrintedTab(chromeBrowser: Browser, pagePath: string): Promise<Page> {
  const printedTab = await chromeBrowser.newPage({ viewport: printedViewport });
  // Print media lays every page out at the canvas size, as in the PDF.
  await printedTab.emulateMedia({ media: "print" });
  await printedTab.goto(addressPrintView(pagePath, { printsSteps: false, printsHidden: false }));
  await printedTab.waitForSelector("[data-print-pages][data-print-ready]", { state: "attached", timeout: printWaitLimit });
  return printedTab;
}

async function shootSlidePicture(printedTab: Page, pageIndex: number): Promise<SlidePicture> {
  const { pageClip, slideHeading } = await printedTab.evaluate((shownPageIndex) => {
    const printedSlide = document.querySelectorAll("[data-print-page]")[shownPageIndex]!;
    printedSlide.scrollIntoView({ block: "start", inline: "start" });
    const slideRect = printedSlide.getBoundingClientRect();
    return {
      pageClip: { x: slideRect.left + window.scrollX, y: slideRect.top + window.scrollY, width: slideRect.width, height: slideRect.height, scale: 1 },
      slideHeading: printedSlide.querySelector("h1, h2")?.textContent ?? "",
    };
  }, pageIndex);
  const screenshotBytes = await shootPageClip(printedTab, pageClip, false);
  const pictureBytes = await sharp(screenshotBytes).resize({ width: previewPictureWidth }).webp({ quality: previewPictureQuality, smartSubsample: true }).toBuffer();
  return { pictureBytes, slideHeading: slideHeading.trim() };
}

async function shootSlidePictures(pagePath: string, sharedChrome: SharedChrome): Promise<SlidePicture[]> {
  const chromeBrowser = await sharedChrome.openChrome();
  const printedTabs = await openWorkingTabs(() => openPrintedTab(chromeBrowser, pagePath));
  try {
    const pageIndexes = [...Array(await printedTabs[0]!.locator("[data-print-page]").count()).keys()];
    return await shareWorkBetweenTabs(printedTabs, pageIndexes, shootSlidePicture);
  } finally {
    await Promise.all(printedTabs.map((printedTab) => printedTab.close()));
  }
}

// The built page is a React app: without scripts, as in macOS Quick Look, it is empty, so the file carries pictures of its slides.
// Returns false when the file would be too big for Quick Look anyway: then the pictures only add weight.
export async function addScriptFreePreview(builtPagePath: string, previewedPagePath: string, sharedChrome: SharedChrome): Promise<boolean> {
  const pageHtml = readFileSync(builtPagePath, "utf8");
  if (Buffer.byteLength(pageHtml) > quickLookSizeLimit) return false;
  const slidePictures = await shootSlidePictures(builtPagePath, sharedChrome);
  const pictureTags = slidePictures.map(
    ({ pictureBytes, slideHeading }) => `<img src="data:image/webp;base64,${pictureBytes.toString("base64")}" alt="${escapeHtml(slideHeading)}" />`,
  );
  const previewMarkup = `<noscript>
    ${previewStyle}
    <div data-script-free-preview>${pictureTags.join("")}</div>
    </noscript>
  `;
  const bodyEnd = pageHtml.lastIndexOf("</body>");
  const previewedHtml = pageHtml.slice(0, bodyEnd) + previewMarkup + pageHtml.slice(bodyEnd);
  if (Buffer.byteLength(previewedHtml) > quickLookSizeLimit) return false;
  writeFileSync(previewedPagePath, previewedHtml);
  return true;
}
