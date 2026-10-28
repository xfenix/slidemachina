import { writeFileSync } from "node:fs";
import { unzipSync, zipSync } from "fflate";
import sharp from "sharp";
import { openWorkingTabs, shareWorkBetweenTabs } from "../presentation-build/chrome-sharing.ts";
import { addressPrintView, printWaitLimit } from "../presentation-build/pdf-printing.ts";
import { blendHighlightsOverPixels } from "./highlight-backdrop-sampling.ts";
import { pageReadingConstants, pptxPageMarks, writeCaptureStylesheet } from "./pptx-page-marks.ts";
import { drawSlideParts, inchesPerCanvasPixel } from "./pptx-slide-drawing.ts";
import { writeStepAnimations } from "./pptx-step-animations.ts";
import { splitNotesParagraphs } from "./pptx-notes-paragraphs.ts";
import { shareRepeatedMedia } from "./pptx-media-sharing.ts";
import { layoutPageFunctions } from "./slide-layout-reading.ts";
import { pseudoTextPageFunctions } from "./pseudo-text-materializing.ts";
import { capturePageFunctions, capturePicture } from "./slide-picture-capturing.ts";
import { stylePageFunctions } from "./slide-style-reading.ts";
import { textPageFunctions } from "./slide-text-reading.ts";
import { vectorPageFunctions } from "./slide-vector-reading.ts";
import type { Browser, Page } from "playwright-core";
import type { SharedChrome } from "../presentation-build/chrome-sharing.ts";
import type { SlideAnimation } from "./pptx-slide-drawing.ts";
import type { CapturedPicture } from "./slide-picture-capturing.ts";
import type { ExportedPage, PicturePart, SlideLayout } from "./slide-part-types.ts";

type PageFormat = { pageWidth: number; pageHeight: number };
type ExportTab = { exportPage: Page; pageFormat: PageFormat };
type ReadPage = { slideLayout: SlideLayout; capturedPictures: Map<string, CapturedPicture | undefined>; notesText: string | null | undefined };

// Pictures are taken at twice the canvas size: sharp on a projector, and the slide text is native anyway.
const captureScale = 2;
// The print view keeps margins around its pages; the window holds a page with them at full size.
const printViewRoom = 256;
const layoutName = "slidemachina";
const singleFrameCount = 1;

function writePageScript(): string {
  const pageFunctions = [...stylePageFunctions, ...pseudoTextPageFunctions, ...textPageFunctions, ...vectorPageFunctions, ...layoutPageFunctions, ...capturePageFunctions];
  return [
    `const pptxPageMarks = ${JSON.stringify(pptxPageMarks)};`,
    `const pageReadingConstants = ${JSON.stringify(pageReadingConstants)};`,
    ...pageFunctions.map(String),
  ].join("\n");
}

// A GIF stays animated in PowerPoint; the build made it an animated WebP, so it goes back to GIF at its size on the slide: GIF frames weigh a lot.
async function convertAnimatedPicture(picturePart: PicturePart): Promise<CapturedPicture | undefined> {
  const [, pictureBase64] = picturePart.animatedSource?.split("base64,") ?? [];
  if (pictureBase64 === undefined || picturePart.contentBox === undefined) return undefined;
  const pictureBytes = Buffer.from(pictureBase64, "base64");
  const { pages: frameCount = 1 } = await sharp(pictureBytes, { animated: true }).metadata();
  if (frameCount <= singleFrameCount) return undefined;
  const { boxWidth, boxHeight } = picturePart.contentBox;
  const gifBytes = await sharp(pictureBytes, { animated: true })
    .resize({ width: Math.round(boxWidth), height: Math.round(boxHeight), fit: "cover" })
    .gif()
    .toBuffer();
  return { pictureBox: picturePart.contentBox, pictureData: `image/gif;base64,${gifBytes.toString("base64")}` };
}

async function capturePictures(exportPage: Page, slideLayout: SlideLayout): Promise<Map<string, CapturedPicture | undefined>> {
  const capturedPictures = new Map<string, CapturedPicture | undefined>();
  for (const slidePart of slideLayout.slideParts) {
    if (slidePart.partKind !== "picture" && slidePart.partKind !== "video") continue;
    const animatedPicture = slidePart.partKind === "picture" ? await convertAnimatedPicture(slidePart) : undefined;
    capturedPictures.set(slidePart.captureMark, animatedPicture ?? (await capturePicture(exportPage, slidePart.captureMark, captureScale)));
  }
  return capturedPictures;
}

async function openPrintView(exportPage: Page, pagePath: string, printsHidden: boolean): Promise<PageFormat> {
  await exportPage.goto(addressPrintView(pagePath, { printsSteps: true, printsHidden }));
  await exportPage.waitForSelector("[data-print-pages][data-print-ready]", { state: "attached", timeout: printWaitLimit });
  const pageFormat = await exportPage.evaluate(() => {
    const firstPage = document.querySelector<HTMLElement>("[data-print-page]")!;
    return { pageWidth: firstPage.offsetWidth, pageHeight: firstPage.offsetHeight };
  });
  // The print view shrinks pages to a narrow window: a wide enough window shows them at their own size.
  await exportPage.setViewportSize({ width: pageFormat.pageWidth + printViewRoom, height: pageFormat.pageHeight + printViewRoom });
  await exportPage.waitForFunction((pageWidth) => document.querySelector("[data-print-page]")!.getBoundingClientRect().width === pageWidth, pageFormat.pageWidth);
  await exportPage.addStyleTag({ content: writeCaptureStylesheet() });
  await exportPage.addScriptTag({ content: writePageScript() });
  return pageFormat;
}

async function openExportTab(chromeBrowser: Browser, pagePath: string, printsHidden: boolean): Promise<ExportTab> {
  const exportPage = await chromeBrowser.newPage({ viewport: { width: printViewRoom, height: printViewRoom }, deviceScaleFactor: captureScale });
  return { exportPage, pageFormat: await openPrintView(exportPage, pagePath, printsHidden) };
}

// Reading a page marks and unmarks its own elements only, so tabs read different pages at once.
async function readExportedPage({ exportPage }: ExportTab, { pageIndex, isStepFrame }: ExportedPage): Promise<ReadPage> {
  const slideLayout = await exportPage.evaluate<SlideLayout>(`readSlideLayout(${pageIndex}, ${isStepFrame})`);
  const capturedPictures = await capturePictures(exportPage, slideLayout);
  await blendHighlightsOverPixels(exportPage, pageIndex, slideLayout);
  const notesText = await exportPage.evaluate((shownPageIndex) => document.querySelectorAll("[data-print-page]")[shownPageIndex]!.querySelector("[data-slide]")?.getAttribute("data-notes"), pageIndex);
  return { slideLayout, capturedPictures, notesText };
}

// Every slide of the print view becomes a slide of native text boxes, shapes, freeforms, pictures and videos; steps become entrance animations, <Notes> slide notes.
// The print view shows a page per step: a slide takes its last page, a slide with code line steps takes every page, one slide per step.
export async function exportPptx(pagePath: string, pptxPath: string, printsHidden: boolean, sharedChrome: SharedChrome): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const chromeBrowser = await sharedChrome.openChrome();
  const exportTabs = await openWorkingTabs(() => openExportTab(chromeBrowser, pagePath, printsHidden));
  try {
    const [firstTab] = exportTabs;
    const { pageWidth, pageHeight } = firstTab!.pageFormat;
    const exportedPages = await firstTab!.exportPage.evaluate<ExportedPage[]>("listExportedPages()");
    const readPages = await shareWorkBetweenTabs(exportTabs, exportedPages, readExportedPage);
    const pptxPresentation = new PptxGenJS();
    pptxPresentation.defineLayout({ name: layoutName, width: pageWidth * inchesPerCanvasPixel, height: pageHeight * inchesPerCanvasPixel });
    pptxPresentation.layout = layoutName;
    const slideAnimations: SlideAnimation[] = readPages.map(({ slideLayout, capturedPictures, notesText }) => {
      const pptxSlide = pptxPresentation.addSlide();
      const animatedObjects = drawSlideParts(pptxSlide, slideLayout, capturedPictures);
      if (notesText != null) pptxSlide.addNotes(notesText);
      return { stepDuration: slideLayout.stepDuration, animatedObjects };
    });
    const pptxFiles = unzipSync((await pptxPresentation.write({ outputType: "uint8array" })) as Uint8Array);
    writeStepAnimations(pptxFiles, slideAnimations);
    splitNotesParagraphs(pptxFiles);
    shareRepeatedMedia(pptxFiles);
    writeFileSync(pptxPath, zipSync(pptxFiles));
  } finally {
    await Promise.all(exportTabs.map(({ exportPage }) => exportPage.close()));
  }
}
