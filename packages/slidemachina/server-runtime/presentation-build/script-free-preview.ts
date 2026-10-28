import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { addressPrintView, launchChrome, printWaitLimit } from "./pdf-printing.ts";
import { escapeHtml } from "./html-escaping.ts";

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

async function shootSlidePictures(pagePath: string): Promise<SlidePicture[]> {
  const chromeBrowser = await launchChrome();
  try {
    const printedPage = await chromeBrowser.newPage({ viewport: printedViewport });
    // Print media lays every page out at the canvas size, as in the PDF.
    await printedPage.emulateMedia({ media: "print" });
    await printedPage.goto(addressPrintView(pagePath, { printsSteps: false, printsHidden: false }));
    await printedPage.waitForSelector("[data-print-pages][data-print-ready]", { state: "attached", timeout: printWaitLimit });
    const slidePictures: SlidePicture[] = [];
    for (const printedSlide of await printedPage.locator("[data-print-page]").all()) {
      const screenshotBytes = await printedSlide.screenshot();
      const pictureBytes = await sharp(screenshotBytes).resize({ width: previewPictureWidth }).webp({ quality: previewPictureQuality, smartSubsample: true }).toBuffer();
      const [slideHeading = ""] = await printedSlide.locator("h1, h2").allTextContents();
      slidePictures.push({ pictureBytes, slideHeading: slideHeading.trim() });
    }
    return slidePictures;
  } finally {
    await chromeBrowser.close();
  }
}

// The built page is a React app: without scripts, as in macOS Quick Look, it is empty, so the file carries pictures of its slides.
// Returns false when the file would be too big for Quick Look anyway: then the pictures only add weight.
export async function addScriptFreePreview(builtPagePath: string, previewedPagePath: string): Promise<boolean> {
  const pageHtml = readFileSync(builtPagePath, "utf8");
  if (Buffer.byteLength(pageHtml) > quickLookSizeLimit) return false;
  const slidePictures = await shootSlidePictures(builtPagePath);
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
