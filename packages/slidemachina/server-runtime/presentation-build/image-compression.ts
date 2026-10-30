import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";

export type BuildReport = { savedPictureBytes: Map<string, number>, videoSizes: Map<string, number> };

const compressedPicturePattern = /\.(png|jpe?g|gif)$/i;
const videoPattern = /\.(mp4|webm|mov|m4v|ogv)$/i;
// Twice the 1920×1080 slide: pictures stay sharp on retina screens and 4K projectors.
const largestPictureWidth = 3840;
const largestPictureHeight = 2160;
const pictureQuality = 82;
const compressionSettings = `${largestPictureWidth}x${largestPictureHeight}-q${pictureQuality}`;
// In the home folder, not a shared /tmp where another user could plant pictures; entries are named by contents.
const cacheFolder = path.join(os.homedir(), ".cache", "slidemachina", "pictures");

// The next build reuses the result; "original" marks a picture WebP did not shrink.
async function compressPicture(picturePath: string): Promise<string | undefined> {
  const pictureBytes = readFileSync(picturePath);
  const contentHash = createHash("sha256").update(pictureBytes).update(compressionSettings).digest("hex").slice(0, 16);
  const cachedFolder = path.join(cacheFolder, contentHash);
  const compressedPath = path.join(cachedFolder, `${path.parse(picturePath).name}.webp`);
  const keptOriginalMarker = path.join(cachedFolder, "original");
  if (existsSync(compressedPath)) return compressedPath;
  if (existsSync(keptOriginalMarker)) return undefined;
  // A GIF keeps all its frames as an animated WebP; EXIF rotation applies only to photos.
  const isAnimatable = /\.gif$/i.test(picturePath);
  const { default: sharp } = await import("sharp");
  const picturePipeline = sharp(pictureBytes, { animated: isAnimatable });
  const compressedBytes = await (isAnimatable ? picturePipeline : picturePipeline.rotate())
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

// Imported PNG, JPEG and GIF pictures are swapped for WebP before Vite sees them; videos are only reported.
export function createImageCompressionPlugin(buildReport: BuildReport): Plugin {
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
