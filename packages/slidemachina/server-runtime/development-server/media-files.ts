import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const pictureExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);
export const videoExtensions = new Set([".mp4", ".webm"]);

export function toImportPath(importingFolder: string, targetFile: string): string {
  const relativePath = path.relative(importingFolder, targetFile).split(path.sep).join("/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

// "My Photo.PNG" becomes my-photo.png: names stay Latin and lower case, as in the rest of images/.
function cleanFileStem(originalName: string): string {
  return path.basename(originalName, path.extname(originalName)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "picture";
}

// A file with the same name and other content gets a number; the same content reuses the file already there.
export async function chooseMediaPath(mediaFolder: string, originalName: string, mediaBytes: Buffer): Promise<{ mediaPath: string, needsWriting: boolean }> {
  const mediaExtension = path.extname(originalName).toLowerCase();
  const cleanStem = cleanFileStem(originalName);
  for (let copyNumber = 1; ; copyNumber += 1) {
    const mediaPath = path.join(mediaFolder, `${cleanStem}${copyNumber === 1 ? "" : `-${copyNumber}`}${mediaExtension}`);
    if (!existsSync(mediaPath)) return { mediaPath, needsWriting: true };
    if ((await readFile(mediaPath)).equals(mediaBytes)) return { mediaPath, needsWriting: false };
  }
}

export async function saveMediaFile(mediaFolder: string, originalName: string, mediaBytes: Buffer): Promise<string> {
  const { mediaPath, needsWriting } = await chooseMediaPath(mediaFolder, originalName, mediaBytes);
  if (needsWriting) {
    await mkdir(mediaFolder, { recursive: true });
    await writeFile(mediaPath, mediaBytes);
  }
  return mediaPath;
}
