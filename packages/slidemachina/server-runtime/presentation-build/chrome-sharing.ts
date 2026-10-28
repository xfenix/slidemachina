import os from "node:os";
import { commandLineTexts } from "../command-line/command-line-texts.ts";
import type { Browser, CDPSession, Page } from "playwright-core";

export type SharedChrome = { openChrome: () => Promise<Browser>; closeChrome: () => Promise<void> };
// In page pixels, from the top of the document; scale 2 gives a picture twice the size.
export type PageClip = { x: number; y: number; width: number; height: number; scale: number };

// Pictures are Chrome's work, not Node's: a few tabs side by side take them several times faster, more only add memory.
const largestTabCount = 4;
const processorsPerTab = 2;
const transparentBackground = { r: 0, g: 0, b: 0, a: 0 };
const screenshotSessions = new WeakMap<Page, Promise<CDPSession>>();

async function launchChrome(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  try {
    // Without a GPU, as on most CI machines, Chrome needs this flag to draw 3D scenes in software.
    return await chromium.launch({ channel: "chrome", args: ["--enable-unsafe-swiftshader"] });
  } catch {
    throw new Error(commandLineTexts.missingChrome);
  }
}

// One Chrome for the whole build: PDF, PowerPoint, Quick Look pictures and covers open their own tabs in it.
// It starts with the first tab that needs it, so a build without these steps never launches it.
export function shareChrome(): SharedChrome {
  let chromeLaunch: Promise<Browser> | undefined;
  return {
    openChrome: () => (chromeLaunch ??= launchChrome()),
    async closeChrome() {
      const chromeBrowser = await chromeLaunch?.catch(() => undefined);
      await chromeBrowser?.close();
    },
  };
}

export async function openWorkingTabs<WorkingTab>(openTab: () => Promise<WorkingTab>): Promise<WorkingTab[]> {
  const tabCount = Math.max(1, Math.min(largestTabCount, Math.floor(os.availableParallelism() / processorsPerTab)));
  return Promise.all(Array.from({ length: tabCount }, openTab));
}

// Every tab takes the next page as soon as it is free; the results keep the order of the pages.
export async function shareWorkBetweenTabs<WorkingTab, WorkItem, WorkResult>(
  workingTabs: WorkingTab[],
  workItems: WorkItem[],
  doWork: (workingTab: WorkingTab, workItem: WorkItem) => Promise<WorkResult>,
): Promise<WorkResult[]> {
  const workResults: WorkResult[] = [];
  let nextItemIndex = 0;
  await Promise.all(
    workingTabs.map(async (workingTab) => {
      while (nextItemIndex < workItems.length) {
        const takenItemIndex = nextItemIndex;
        nextItemIndex += 1;
        workResults[takenItemIndex] = await doWork(workingTab, workItems[takenItemIndex]!);
      }
    }),
  );
  return workResults;
}

// Chrome's own screenshot call with the PNG encoded for speed: the same pixels several times faster than Playwright's screenshot,
// which also waits for fonts and hides the caret on every call. The clip has to be on screen.
export async function shootPageClip(shotPage: Page, pageClip: PageClip, isTransparent: boolean): Promise<Buffer> {
  let sessionOpening = screenshotSessions.get(shotPage);
  if (sessionOpening === undefined) {
    sessionOpening = shotPage.context().newCDPSession(shotPage);
    screenshotSessions.set(shotPage, sessionOpening);
  }
  const screenshotSession = await sessionOpening;
  // The page was just scrolled to the clip: two frames later Chrome has painted it, as Playwright waits before its own screenshot.
  await shotPage.evaluate(() => new Promise((resolveFrames) => requestAnimationFrame(() => requestAnimationFrame(resolveFrames))));
  if (isTransparent) await screenshotSession.send("Emulation.setDefaultBackgroundColorOverride", { color: transparentBackground });
  try {
    const { data: pictureBase64 } = await screenshotSession.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true, clip: pageClip });
    return Buffer.from(pictureBase64, "base64");
  } finally {
    if (isTransparent) await screenshotSession.send("Emulation.setDefaultBackgroundColorOverride", {});
  }
}
