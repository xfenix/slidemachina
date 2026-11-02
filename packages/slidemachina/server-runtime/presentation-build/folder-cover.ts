import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { captureShownFirstSlide, firstFrameViewport, injectStaticCover } from "./static-cover.ts";
import type { SharedChrome } from "./chrome-sharing.ts";

// A made-up address: Playwright answers it from the built folder, so the capture needs no web server.
const folderCoverOrigin = "http://folder-cover.slidemachina.localhost";
// In the home folder like the picture cache: entries are named by the contents of the built folder.
const folderCoverCacheFolder = path.join(os.homedir(), ".cache", "slidemachina", "folder-covers");

// Vite names built files by content hash, so any source edit changes the key and photographs the cover afresh.
function hashBuiltFolder(builtFolder: string): string {
  const contentHash = createHash("sha256");
  contentHash.update(readFileSync(path.join(builtFolder, "index.html")));
  const assetsFolder = path.join(builtFolder, "assets");
  if (!existsSync(assetsFolder)) return contentHash.digest("hex").slice(0, 16);
  const assetEntries = readdirSync(assetsFolder, { withFileTypes: true })
    .filter((assetEntry) => assetEntry.isFile())
    .sort((firstEntry, secondEntry) => firstEntry.name.localeCompare(secondEntry.name));
  for (const assetEntry of assetEntries) {
    contentHash.update(assetEntry.name);
    contentHash.update(readFileSync(path.join(assetsFolder, assetEntry.name)));
  }
  return contentHash.digest("hex").slice(0, 16);
}

function readCachedCover(coverKey: string): string | undefined {
  const cachedCoverPath = path.join(folderCoverCacheFolder, `${coverKey}.html`);
  if (!existsSync(cachedCoverPath)) return undefined;
  return readFileSync(cachedCoverPath, "utf8");
}

// Another build process may write the same entry: a rename never leaves half a file.
function writeCachedCover(coverKey: string, coverMarkup: string): void {
  mkdirSync(folderCoverCacheFolder, { recursive: true });
  const cachedCoverPath = path.join(folderCoverCacheFolder, `${coverKey}.html`);
  const partialCoverPath = `${cachedCoverPath}.${process.pid}.partial`;
  writeFileSync(partialCoverPath, coverMarkup);
  renameSync(partialCoverPath, cachedCoverPath);
}

// The folder page is a module app that file:// does not load; the route answers every request from the built folder.
async function shootFolderCover(builtFolder: string, sharedChrome: SharedChrome): Promise<string | null> {
  const chromeBrowser = await sharedChrome.openChrome();
  const coverPage = await chromeBrowser.newPage({ viewport: firstFrameViewport });
  try {
    await coverPage.route(`${folderCoverOrigin}/**`, (interceptedRoute) => {
      const requestedPath = decodeURIComponent(new URL(interceptedRoute.request().url()).pathname);
      return interceptedRoute.fulfill({ path: path.join(builtFolder, requestedPath) });
    });
    await coverPage.goto(`${folderCoverOrigin}/index.html`);
    return await captureShownFirstSlide(coverPage);
  } finally {
    await coverPage.close();
  }
}

// The folder index opens on its painted first slide, as the single-file builds do; a rebuild of the same sources reuses the shot.
export async function addFolderCover(builtFolder: string, sharedChrome: SharedChrome): Promise<void> {
  const coverKey = hashBuiltFolder(builtFolder);
  let coverMarkup = readCachedCover(coverKey);
  if (coverMarkup === undefined) {
    const capturedMarkup = await shootFolderCover(builtFolder, sharedChrome);
    if (capturedMarkup === null) return;
    writeCachedCover(coverKey, capturedMarkup);
    coverMarkup = capturedMarkup;
  }
  injectStaticCover(path.join(builtFolder, "index.html"), coverMarkup);
}
