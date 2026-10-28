import sharp from "sharp";
import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";
import { listPaintedOutsideParts } from "./slide-layout-reading.ts";
import { shootPageClip } from "../presentation-build/chrome-sharing.ts";
import type { Page } from "playwright-core";
import type { SlidePartBox } from "./slide-part-types.ts";

export type CapturedPicture = { pictureBox: SlidePartBox; pictureData: string };
type CaptureFrame = {
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  pageLeft: number;
  pageTop: number;
  pageWidth: number;
  pageHeight: number;
  scrollLeft: number;
  scrollTop: number;
};

export const capturePageFunctions = [isolateCaptureSubject, releaseCaptureSubject];
const visibleAlphaThreshold = 2;
const rgbaChannelCount = 4;
const alphaChannelOffset = 3;
const opaqueAlpha = 255;
const opaquePictureQuality = 90;


// Page function: the subject stays, its ancestors lose their own paint, everything else on the slide turns invisible.
function isolateCaptureSubject(captureMark: string): CaptureFrame {
  const subjectElement = document.querySelector(`[${pptxPageMarks.captureMark}="${captureMark}"]`)!;
  const pageElement = subjectElement.closest("[data-print-page]")!;
  subjectElement.setAttribute(pptxPageMarks.captureSubject, "");
  if (subjectElement !== pageElement) {
    for (let ancestorElement = subjectElement.parentElement; ancestorElement !== null; ancestorElement = ancestorElement.parentElement) {
      ancestorElement.setAttribute(pptxPageMarks.capturePath, "");
      if (ancestorElement === pageElement) break;
    }
  }
  pageElement.setAttribute(pptxPageMarks.capturing, "");
  pageElement.scrollIntoView({ block: "start", inline: "start" });
  const pageRect = pageElement.getBoundingClientRect();
  // Text in a vector, such as the section number, may stand outside the vector's box: such a vector gets the whole slide.
  const takesWholePage = subjectElement instanceof SVGSVGElement && getComputedStyle(subjectElement).overflow === "visible";
  const isWholeSubject = subjectElement.hasAttribute(pptxPageMarks.wholeElement);
  const leftElements = takesWholePage ? [pageElement] : isWholeSubject ? [] : listPaintedOutsideParts(subjectElement);
  const framedElements = leftElements.length > 0 ? leftElements : [subjectElement];
  const framedRects = framedElements.map((framedElement) => framedElement.getBoundingClientRect());
  const frameMargin = pageReadingConstants.subjectFrameMargin;
  const frameLeft = Math.max(pageRect.left, Math.floor(Math.min(...framedRects.map((framedRect) => framedRect.left)) - frameMargin));
  const frameTop = Math.max(pageRect.top, Math.floor(Math.min(...framedRects.map((framedRect) => framedRect.top)) - frameMargin));
  const frameRight = Math.min(pageRect.right, Math.ceil(Math.max(...framedRects.map((framedRect) => framedRect.right)) + frameMargin));
  const frameBottom = Math.min(pageRect.bottom, Math.ceil(Math.max(...framedRects.map((framedRect) => framedRect.bottom)) + frameMargin));
  return { frameLeft, frameTop, frameWidth: Math.max(1, frameRight - frameLeft), frameHeight: Math.max(1, frameBottom - frameTop), pageLeft: pageRect.left, pageTop: pageRect.top, pageWidth: pageRect.width, pageHeight: pageRect.height, scrollLeft: window.scrollX, scrollTop: window.scrollY };
}

function releaseCaptureSubject(): void {
  for (const markName of [pptxPageMarks.capturing, pptxPageMarks.captureSubject, pptxPageMarks.capturePath]) {
    for (const markedElement of document.querySelectorAll(`[${markName}]`)) markedElement.removeAttribute(markName);
  }
}

// Only the painted part of the slide becomes the picture; nothing painted, no picture.
async function cropPaintedPart(screenshotBytes: Buffer, captureFrame: CaptureFrame, captureScale: number): Promise<CapturedPicture | undefined> {
  const { data: pixelBytes, info: pixelLayout } = await sharp(screenshotBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let [leftColumn, upperPixelRow, rightColumn, bottomRow] = [pixelLayout.width, pixelLayout.height, -1, -1];
  // Opacity is judged on the whole screenshot, not the crop: JPEG is taken only where nothing around the subject shows through.
  let isOpaque = true;
  for (let pixelRow = 0; pixelRow < pixelLayout.height; pixelRow += 1) {
    const rowStart = pixelRow * pixelLayout.width * rgbaChannelCount;
    for (let pixelColumn = 0; pixelColumn < pixelLayout.width; pixelColumn += 1) {
      const pixelAlpha = pixelBytes[rowStart + pixelColumn * rgbaChannelCount + alphaChannelOffset]!;
      if (pixelAlpha < opaqueAlpha) isOpaque = false;
      if (pixelAlpha < visibleAlphaThreshold) continue;
      leftColumn = Math.min(leftColumn, pixelColumn);
      rightColumn = Math.max(rightColumn, pixelColumn);
      upperPixelRow = Math.min(upperPixelRow, pixelRow);
      bottomRow = pixelRow;
    }
  }
  if (rightColumn < 0) return undefined;
  const paintedRegion = { left: leftColumn, top: upperPixelRow, width: rightColumn - leftColumn + 1, height: bottomRow - upperPixelRow + 1 };
  // The decoded pixels are cropped and encoded as they are: the screenshot is not decoded again.
  const croppedPicture = sharp(pixelBytes, { raw: { width: pixelLayout.width, height: pixelLayout.height, channels: rgbaChannelCount } }).extract(paintedRegion);
  // Adaptive filtering keeps every pixel and makes these screenshots of gradients and text about a quarter lighter.
  const pictureBytes = isOpaque ? await croppedPicture.jpeg({ quality: opaquePictureQuality }).toBuffer() : await croppedPicture.png({ adaptiveFiltering: true }).toBuffer();
  return {
    pictureBox: {
      leftEdge: captureFrame.frameLeft - captureFrame.pageLeft + paintedRegion.left / captureScale,
      upperEdge: captureFrame.frameTop - captureFrame.pageTop + paintedRegion.top / captureScale,
      boxWidth: paintedRegion.width / captureScale,
      boxHeight: paintedRegion.height / captureScale,
    },
    pictureData: `image/${isOpaque ? "jpeg" : "png"};base64,${pictureBytes.toString("base64")}`,
  };
}

export async function capturePicture(exportPage: Page, captureMark: string, captureScale: number): Promise<CapturedPicture | undefined> {
  const captureFrame = await exportPage.evaluate<CaptureFrame>(`isolateCaptureSubject(${JSON.stringify(captureMark)})`);
  try {
    // A whole-slide picture is a backdrop such as the grainy section gradient: at canvas size it paints four times faster and looks the same.
    const isBackdrop = captureFrame.frameWidth * captureFrame.frameHeight >= captureFrame.pageWidth * captureFrame.pageHeight;
    const { frameLeft, frameTop, frameWidth, frameHeight, scrollLeft, scrollTop } = captureFrame;
    const pageClip = { x: frameLeft + scrollLeft, y: frameTop + scrollTop, width: frameWidth, height: frameHeight, scale: isBackdrop ? 1 : captureScale };
    const screenshotBytes = await shootPageClip(exportPage, pageClip, true);
    return await cropPaintedPart(screenshotBytes, captureFrame, isBackdrop ? 1 : captureScale);
  } finally {
    await exportPage.evaluate("releaseCaptureSubject()");
  }
}
