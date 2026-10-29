import path from "node:path";
import sharp from "sharp";
import { coverWidth } from "../presentation-repository/presentation-list-page.ts";
import type { Page } from "playwright-core";
import type { SharedChrome } from "./chrome-sharing.ts";
import type { CanvasSize } from "../../shared-between-runtimes/canvas-size.ts";

// A made-up address: Playwright answers it from the built folder, so a folder build needs no web server either.
const coverOrigin = "http://cover.slidemachina.localhost";
const webpQuality = 82;

// The cover preview and slidemachina shot wait for the same things: fonts, pictures, laid out diagrams, drawn scenes.
export async function waitForStillSlide(slidePage: Page, slideSelector: string): Promise<void> {
  await slidePage.waitForFunction(
    (waitedSlide) =>
      document.querySelector(waitedSlide) !== null &&
      document.fonts.status === "loaded" &&
      document.querySelector(`${waitedSlide} [data-diagram]:not([data-laid-out]):not([data-layout-failed])`) === null &&
      document.querySelector(`${waitedSlide} [data-scene]:not([data-drawn])`) === null &&
      [...document.images].every((pictureElement) => pictureElement.complete) &&
      // Steps fade in and out after the page opens; endless animations, such as an orbiting scene, are not waited for.
      document.getAnimations().every((runningAnimation) => runningAnimation.playState !== "running" || runningAnimation.effect?.getTiming().iterations === Infinity),
    slideSelector,
  );
  // The tone of a background picture is measured once it has loaded: two frames let the logo and text follow it.
  await slidePage.evaluate(() => new Promise((resolveFrames) => requestAnimationFrame(() => requestAnimationFrame(resolveFrames))));
}

// Covers take tabs of the build's Chrome. Without Chrome the list shows titles in place of covers.
export async function shootCover(sharedChrome: SharedChrome, builtFolder: string, coverPath: string, { canvasWidth, canvasHeight }: CanvasSize): Promise<void> {
  const chromeBrowser = await sharedChrome.openChrome();
  // A window of the canvas size shows the slide without letterbox margins.
  const coverPage = await chromeBrowser.newPage({ viewport: { width: canvasWidth, height: canvasHeight } });
  try {
    await coverPage.route(`${coverOrigin}/**`, (interceptedRoute) => {
      const requestedPath = decodeURIComponent(new URL(interceptedRoute.request().url()).pathname);
      return interceptedRoute.fulfill({ path: path.join(builtFolder, requestedPath) });
    });
    await coverPage.goto(`${coverOrigin}/index.html?cover`);
    await waitForStillSlide(coverPage, "[data-cover-preview] [data-slide]");
    const screenshotBytes = await coverPage.screenshot();
    await sharp(screenshotBytes).resize({ width: coverWidth }).webp({ quality: webpQuality, smartSubsample: true }).toFile(coverPath);
  } finally {
    await coverPage.close();
  }
}
