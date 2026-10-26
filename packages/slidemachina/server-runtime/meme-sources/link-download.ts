import path from "node:path";
import { fetchFromSource, readResponseBytes } from "./source-fetching.ts";
import { pictureExtensions, saveMediaFile, videoExtensions } from "../development-server/media-files.ts";
import { SourceEditProblem } from "../development-server/source-rewriting.ts";

export type DownloadedMedia = { mediaPath: string, isVideo: boolean };

const mediaTypeExtensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};
// A page shares its main picture in these tags: Reddit, Imgur and Know Your Meme all fill og:image.
const pagePictureProperties = new Set(["og:image", "twitter:image"]);

function readLinkAddress(linkText: string): URL {
  try {
    const linkAddress = new URL(linkText.trim());
    if (linkAddress.protocol === "http:" || linkAddress.protocol === "https:") return linkAddress;
  } catch {
    // An address that does not parse is refused below, the same as one with another protocol.
  }
  throw new SourceEditProblem("memeLinkWrong");
}

function findPagePicture(pageText: string, pageAddress: URL): URL | undefined {
  for (const [metaTag] of pageText.matchAll(/<meta\b[^>]*>/gi)) {
    const metaAttributes = new Map([...metaTag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(([, attributeName, attributeValue]) => [attributeName!.toLowerCase(), attributeValue!]));
    const metaProperty = metaAttributes.get("property") ?? metaAttributes.get("name");
    const pictureAddress = metaAttributes.get("content");
    if (metaProperty !== undefined && pagePictureProperties.has(metaProperty) && pictureAddress !== undefined) return new URL(pictureAddress.replaceAll("&amp;", "&"), pageAddress);
  }
  return undefined;
}

// A link to a page instead of a picture is followed to the picture the page shares.
async function fetchMedia(linkAddress: URL, followsPage: boolean): Promise<{ mediaAddress: URL, mediaExtension: string, mediaBytes: Buffer }> {
  const mediaResponse = await fetchFromSource(linkAddress.href);
  if (!mediaResponse.ok) throw new SourceEditProblem("memeNetworkFailed", `${linkAddress.href}: ${mediaResponse.status}`);
  const mediaType = (mediaResponse.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (mediaType === "text/html" && followsPage) {
    const pagePicture = findPagePicture(await mediaResponse.text(), linkAddress);
    if (pagePicture === undefined) throw new SourceEditProblem("memeLinkNotPicture");
    return fetchMedia(pagePicture, false);
  }
  const addressExtension = path.extname(linkAddress.pathname).toLowerCase();
  const mediaExtension = mediaTypeExtensions[mediaType] ?? addressExtension;
  if (!pictureExtensions.has(mediaExtension) && !videoExtensions.has(mediaExtension)) throw new SourceEditProblem("memeLinkNotPicture");
  return { mediaAddress: linkAddress, mediaExtension, mediaBytes: await readResponseBytes(mediaResponse) };
}

export async function downloadMediaLink(mediaFolder: string, linkText: string, preferredStem?: string): Promise<DownloadedMedia> {
  const { mediaAddress, mediaExtension, mediaBytes } = await fetchMedia(readLinkAddress(linkText), true);
  const addressStem = path.basename(mediaAddress.pathname, path.extname(mediaAddress.pathname));
  const mediaPath = await saveMediaFile(mediaFolder, `${preferredStem ?? (addressStem || "meme")}${mediaExtension}`, mediaBytes);
  return { mediaPath, isVideo: videoExtensions.has(mediaExtension) };
}
