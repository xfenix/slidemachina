import { createHash } from "node:crypto";
import { strFromU8, strToU8 } from "fflate";

const mediaFolder = "ppt/media/";
const relationshipsPath = /\.rels$/;

// The logo, a code frame or a section backdrop is the same picture on many slides; pptxgenjs stores a copy for each.
// Slides point at one file instead, as PowerPoint itself saves them: the file is lighter, the pictures are the same bytes.
export function shareRepeatedMedia(pptxFiles: Record<string, Uint8Array>): void {
  const keptMediaByHash = new Map<string, string>();
  const replacedMediaNames = new Map<string, string>();
  for (const filePath of Object.keys(pptxFiles).filter((candidatePath) => candidatePath.startsWith(mediaFolder))) {
    const mediaHash = createHash("sha256").update(pptxFiles[filePath]!).digest("hex");
    const keptMediaPath = keptMediaByHash.get(mediaHash);
    if (keptMediaPath === undefined) {
      keptMediaByHash.set(mediaHash, filePath);
      continue;
    }
    replacedMediaNames.set(filePath.slice(mediaFolder.length), keptMediaPath.slice(mediaFolder.length));
    delete pptxFiles[filePath];
  }
  if (replacedMediaNames.size === 0) return;
  for (const [filePath, fileBytes] of Object.entries(pptxFiles)) {
    if (!relationshipsPath.test(filePath)) continue;
    const relationshipsXml = strFromU8(fileBytes);
    const sharedXml = relationshipsXml.replace(/Target="\.\.\/media\/([^"]+)"/g, (targetMatch, mediaName: string) => {
      const keptMediaName = replacedMediaNames.get(mediaName);
      return keptMediaName === undefined ? targetMatch : `Target="../media/${keptMediaName}"`;
    });
    if (sharedXml !== relationshipsXml) pptxFiles[filePath] = strToU8(sharedXml);
  }
}
