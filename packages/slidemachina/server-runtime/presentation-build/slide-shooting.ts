// slidemachina shot: one slide at one step, as the audience sees it, in a PNG an agent can look at.
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { createBuildConfiguration } from "../development-server/vite-configuration.ts";
import { readPresentationFile } from "../source-transforms/presentation-settings.ts";
import { defaultAspectRatio, measureCanvasSize } from "../../shared-between-runtimes/canvas-size.ts";
import { shareChrome } from "./chrome-sharing.ts";
import { waitForStillSlide } from "./cover-shooting.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

// The toolbar shows until the mouse has been still for a while: in a picture of the slide it has no place.
const interfaceHidingStyle = "[data-toolbar] { display: none !important; }";

// The one-file build opens from disk, so the shot needs no server; the address picks the slide and the step, as in the browser.
export async function shootSlide(presentationLayout: SiteLayout, slidePosition: string, picturePath: string): Promise<void> {
  const temporaryFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-shot-"));
  const sharedChrome = shareChrome();
  try {
    await build(createBuildConfiguration(presentationLayout, temporaryFolder, true, { savedPictureBytes: new Map(), videoSizes: new Map() }));
    const aspectRatio = readPresentationFile(presentationLayout.rootFolder).aspectRatio ?? defaultAspectRatio;
    const { canvasWidth, canvasHeight } = measureCanvasSize(aspectRatio) ?? measureCanvasSize(defaultAspectRatio)!;
    const chromeBrowser = await sharedChrome.openChrome();
    // A window of the canvas size shows the slide without letterbox margins.
    const shotPage = await chromeBrowser.newPage({ viewport: { width: canvasWidth, height: canvasHeight } });
    await shotPage.goto(`${pathToFileURL(path.join(temporaryFolder, "index.html")).href}#${slidePosition}`);
    await shotPage.addStyleTag({ content: interfaceHidingStyle });
    await waitForStillSlide(shotPage, "[data-canvas] > [data-slide][data-current]");
    await shotPage.screenshot({ path: picturePath });
  } finally {
    await sharedChrome.closeChrome();
    rmSync(temporaryFolder, { recursive: true, force: true });
  }
}
