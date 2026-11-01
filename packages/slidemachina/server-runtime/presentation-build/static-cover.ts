import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Page } from "playwright-core";
import type { SharedChrome } from "./chrome-sharing.ts";

const firstFrameViewport = { width: 1920, height: 1080 };
const firstFrameWaitLimit = 60_000;
const staticCoverBeginMarker = "<!--slidemachina-static-cover-->";
const staticCoverEndMarker = "<!--/slidemachina-static-cover-->";
// Quick Look takes the slide pictures out of the same page: the copy there comes without the static cover.
export const staticCoverPattern = /<!--slidemachina-static-cover-->[\s\S]*?<!--\/slidemachina-static-cover-->/;

type StaticCoverCapture = { presentationVariables: string; letterboxColor: string; coverMarkup: string };

function waitForPagePictures(coverPage: Page): Promise<unknown> {
  return coverPage.evaluate(
    () =>
      new Promise<void>((resolvePictures) => {
        const pageImages = [...document.images];
        const pendingImages = pageImages.filter((pageImage) => !pageImage.complete);
        if (pendingImages.length === 0) return resolvePictures();
        let settledCount = 0;
        const settlePicture = () => {
          settledCount += 1;
          if (settledCount === pendingImages.length) resolvePictures();
        };
        for (const pendingImage of pendingImages) {
          pendingImage.addEventListener("load", settlePicture, { once: true });
          pendingImage.addEventListener("error", settlePicture, { once: true });
        }
      }),
  );
}

async function captureFirstSlide(builtPagePath: string, sharedChrome: SharedChrome): Promise<StaticCoverCapture | null> {
  const chromeBrowser = await sharedChrome.openChrome();
  const coverPage = await chromeBrowser.newPage({ viewport: firstFrameViewport });
  try {
    await coverPage.goto(pathToFileURL(builtPagePath).href);
    await coverPage.waitForSelector("[data-canvas] > [data-slide]:not([data-hidden])", { state: "attached", timeout: firstFrameWaitLimit });
    await coverPage.evaluate(() => document.fonts.ready);
    await waitForPagePictures(coverPage);
    return await coverPage.evaluate(() => {
      const presentationElement = document.querySelector("[data-presentation]");
      const coverElement = document.querySelector("[data-canvas] > [data-slide]:not([data-hidden])");
      if (!(presentationElement instanceof HTMLElement) || !(coverElement instanceof HTMLElement)) return null;
      const coverClone = coverElement.cloneNode(true) as HTMLElement;
      // The clone is the current slide: without the mark the engine styles hide every slide but the current one.
      coverClone.setAttribute("data-current", "");
      coverClone.removeAttribute("data-distant");
      coverClone.removeAttribute("id");
      for (const identifiedElement of coverClone.querySelectorAll("[id]")) identifiedElement.removeAttribute("id");
      return {
        presentationVariables: presentationElement.style.cssText,
        letterboxColor: getComputedStyle(presentationElement).backgroundColor,
        coverMarkup: coverClone.outerHTML,
      };
    });
  } finally {
    await coverPage.close();
  }
}

// The built file opens on the painted cover before scripts run; the live app removes the copy once its own first frame is up.
export async function captureStaticCover(builtPagePath: string, sharedChrome: SharedChrome): Promise<string | null> {
  const staticCoverCapture = await captureFirstSlide(builtPagePath, sharedChrome);
  if (staticCoverCapture === null) return null;
  const escapedVariables = staticCoverCapture.presentationVariables.replaceAll('"', "&quot;");
  return `${staticCoverBeginMarker}
<style>@media print { [data-static-cover] { display: none !important; } }</style>
<div data-static-cover aria-hidden="true"><div data-presentation style="${escapedVariables} background: ${staticCoverCapture.letterboxColor};"><div data-canvas>${staticCoverCapture.coverMarkup}</div></div></div>
${staticCoverEndMarker}`;
}

// The cover goes into the final single file after every other pass: the Quick Look step writes its own copy of the page without it.
export function injectStaticCover(pagePath: string, coverMarkup: string): void {
  const pageHtml = readFileSync(pagePath, "utf8").replace(staticCoverPattern, "");
  const bodyEnd = pageHtml.lastIndexOf("</body>");
  writeFileSync(pagePath, pageHtml.slice(0, bodyEnd) + coverMarkup + pageHtml.slice(bodyEnd));
}
