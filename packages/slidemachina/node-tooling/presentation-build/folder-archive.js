import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";

// Pictures, video and fonts are compressed already: they are stored as they are, which keeps zipping fast.
const storedFilePattern = /\.(webp|avif|png|jpe?g|gif|mp4|webm|mov|woff2?)$/i;
const storedCompressionLevel = 0;
const defaultCompressionLevel = 6;

/**
 * @param {string} sourceFolder
 * @param {string} archivePath
 */
export function zipFolder(sourceFolder, archivePath) {
  /** @type {import("fflate").Zippable} */
  const archivedFiles = {};
  for (const folderEntry of readdirSync(sourceFolder, { recursive: true, withFileTypes: true })) {
    if (!folderEntry.isFile()) continue;
    const filePath = path.join(folderEntry.parentPath, folderEntry.name);
    const archivedName = path.relative(sourceFolder, filePath).split(path.sep).join("/");
    archivedFiles[archivedName] = [readFileSync(filePath), { level: storedFilePattern.test(filePath) ? storedCompressionLevel : defaultCompressionLevel }];
  }
  writeFileSync(archivePath, zipSync(archivedFiles));
}
