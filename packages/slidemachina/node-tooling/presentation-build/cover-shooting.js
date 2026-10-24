import path from "node:path";
import sharp from "sharp";
import { launchChrome } from "./pdf-printing.js";

// A made-up address: Playwright answers it from the built folder, so a folder build needs no web server either.
const coverOrigin = "http://cover.slidemachina.localhost";
// Twice the width of a card on the list: sharp on retina screens, 6–8 KB in WebP.
const coverWidth = 960;
const coverViewport = { width: 1920, height: 1080 };
const webpQuality = 82;

/** @param {import("playwright-core").Page} coverPage */
async function waitForStillCover(coverPage) {
  await coverPage.waitForFunction(
    () =>
      document.querySelector("[data-cover-preview] [data-slide]") !== null &&
      document.fonts.status === "loaded" &&
      document.querySelector("[data-cover-preview] [data-diagram]:not([data-laid-out]):not([data-layout-failed])") === null &&
      document.querySelector("[data-cover-preview] [data-scene]:not([data-drawn])") === null &&
      [...document.images].every((pictureElement) => pictureElement.complete),
  );
  // The tone of a background picture is measured once it has loaded: two frames let the logo and text follow it.
  await coverPage.evaluate(() => new Promise((resolveFrames) => requestAnimationFrame(() => requestAnimationFrame(resolveFrames))));
}

// One Chrome for all covers of a build. Without Chrome the list shows titles in place of covers.
export function createCoverCamera() {
  /** @type {Promise<import("playwright-core").Browser> | undefined} */
  let chromeLaunch;
  return {
    /**
     * @param {string} builtFolder
     * @param {string} coverPath
     */
    async shootCover(builtFolder, coverPath) {
      chromeLaunch ??= launchChrome();
      const chromeBrowser = await chromeLaunch;
      const coverPage = await chromeBrowser.newPage({ viewport: coverViewport });
      try {
        await coverPage.route(`${coverOrigin}/**`, (interceptedRoute) => {
          const requestedPath = decodeURIComponent(new URL(interceptedRoute.request().url()).pathname);
          return interceptedRoute.fulfill({ path: path.join(builtFolder, requestedPath) });
        });
        await coverPage.goto(`${coverOrigin}/index.html?cover`);
        await waitForStillCover(coverPage);
        const screenshotBytes = await coverPage.screenshot();
        await sharp(screenshotBytes).resize({ width: coverWidth }).webp({ quality: webpQuality, smartSubsample: true }).toFile(coverPath);
      } finally {
        await coverPage.close();
      }
    },
    async close() {
      const chromeBrowser = await chromeLaunch?.catch(() => undefined);
      await chromeBrowser?.close();
    },
  };
}
