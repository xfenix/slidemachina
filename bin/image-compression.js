import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

/** @typedef {{ savedPictureBytes: Map<string, number>, videoSizes: Map<string, number> }} BuildReport */

const compressedPicturePattern = /\.(png|jpe?g)$/i;
const videoPattern = /\.(mp4|webm|mov|m4v|ogv)$/i;
// Twice the 1920×1080 slide: pictures stay sharp on retina screens and 4K projectors.
const largestPictureWidth = 3840;
const largestPictureHeight = 2160;
const pictureQuality = 82;
const compressionSettings = `${largestPictureWidth}x${largestPictureHeight}-q${pictureQuality}`;
// In the home folder, not a shared /tmp where another user could plant pictures; entries are named by contents.
const cacheFolder = path.join(os.homedir(), ".cache", "slidemachina", "pictures");

// The next build reuses the result; "original" marks a picture WebP did not shrink.
/** @param {string} picturePath */
async function compressPicture(picturePath) {
  const pictureBytes = readFileSync(picturePath);
  const contentHash = createHash("sha256").update(pictureBytes).update(compressionSettings).digest("hex").slice(0, 16);
  const cachedFolder = path.join(cacheFolder, contentHash);
  const compressedPath = path.join(cachedFolder, `${path.parse(picturePath).name}.webp`);
  const keptOriginalMarker = path.join(cachedFolder, "original");
  if (existsSync(compressedPath)) return compressedPath;
  if (existsSync(keptOriginalMarker)) return undefined;
  const compressedBytes = await sharp(pictureBytes)
    .rotate()
    .resize({ width: largestPictureWidth, height: largestPictureHeight, fit: "inside", withoutEnlargement: true })
    .webp({ quality: pictureQuality, smartSubsample: true })
    .toBuffer();
  mkdirSync(cachedFolder, { recursive: true });
  if (compressedBytes.length >= pictureBytes.length) {
    writeFileSync(keptOriginalMarker, "");
    return undefined;
  }
  writeFileSync(compressedPath, compressedBytes);
  return compressedPath;
}

// Imported PNG and JPEG pictures are swapped for WebP before Vite sees them; videos are only reported.
/**
 * @param {BuildReport} buildReport
 * @returns {import("vite").Plugin}
 */
export function imageCompressionPlugin(buildReport) {
  return {
    name: "slidemachina-image-compression",
    enforce: "pre",
    async resolveId(requestedModuleId, importerPath) {
      const isMediaImport = compressedPicturePattern.test(requestedModuleId) || videoPattern.test(requestedModuleId);
      if (!isMediaImport || importerPath === undefined) return undefined;
      const resolvedMedia = await this.resolve(requestedModuleId, importerPath, { skipSelf: true });
      if (resolvedMedia === null || resolvedMedia.external) return resolvedMedia;
      const mediaPath = resolvedMedia.id;
      if (videoPattern.test(mediaPath)) {
        buildReport.videoSizes.set(mediaPath, statSync(mediaPath).size);
        return resolvedMedia;
      }
      const compressedPath = await compressPicture(mediaPath);
      if (compressedPath === undefined) return resolvedMedia;
      buildReport.savedPictureBytes.set(mediaPath, statSync(mediaPath).size - statSync(compressedPath).size);
      return compressedPath;
    },
  };
}
