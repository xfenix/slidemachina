import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { commandLineTexts } from "../command-line/command-line-texts.ts";
import { mediaTypeExtensions } from "../meme-sources/link-download.ts";
import { fetchFromSource, readResponseBytes } from "../meme-sources/source-fetching.ts";
import { findAttribute, readElementName } from "./syntax-tree.ts";
import type { SyntaxNode } from "./syntax-tree.ts";
import type MagicString from "magic-string";
import type { Rollup } from "vite";

// The same file is not downloaded twice: the next build takes it from here, as compressed pictures are taken from theirs.
const cacheFolder = path.join(os.homedir(), ".cache", "slidemachina", "remote-media");
const remoteAddressPattern = /^https?:\/\//;
// Attributes that take a picture or a video; an <iframe> background is an object and stays on the web.
const mediaAttributesByPart: Record<string, string[]> = { Image: ["src"], Video: ["src", "poster"], Meme: ["src"], Slide: ["background"] };

type RemoteMediaPlace = { attributeValue: SyntaxNode, remoteAddress: string };

export function findRemoteMedia(syntaxNode: SyntaxNode, engineNames: Record<string, string>): RemoteMediaPlace[] {
  if (syntaxNode.type !== "JSXElement") return [];
  const elementName = readElementName(syntaxNode);
  const partName = Object.keys(mediaAttributesByPart).find((mediaPart) => engineNames[mediaPart] === elementName);
  if (partName === undefined) return [];
  return mediaAttributesByPart[partName]!.flatMap((attributeName) => {
    const attributeValue = findAttribute(syntaxNode, attributeName)?.value;
    const isRemoteLiteral = attributeValue?.type === "Literal" && typeof attributeValue.value === "string" && remoteAddressPattern.test(attributeValue.value);
    return isRemoteLiteral ? [{ attributeValue, remoteAddress: attributeValue.value as string }] : [];
  });
}

async function downloadToCache(remoteAddress: string): Promise<string> {
  const addressHash = createHash("sha256").update(remoteAddress).digest("hex");
  const addressExtension = path.extname(new URL(remoteAddress).pathname).toLowerCase();
  const knownCopy = Object.values(mediaTypeExtensions)
    .map((mediaExtension) => path.join(cacheFolder, `${addressHash}${mediaExtension}`))
    .find((cachedPath) => existsSync(cachedPath));
  if (knownCopy !== undefined) return knownCopy;
  const mediaResponse = await fetchFromSource(remoteAddress);
  if (!mediaResponse.ok) throw new Error(String(mediaResponse.status));
  const mediaType = (mediaResponse.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const cachedPath = path.join(cacheFolder, `${addressHash}${mediaTypeExtensions[mediaType] ?? addressExtension}`);
  await mkdir(cacheFolder, { recursive: true });
  await writeFile(cachedPath, await readResponseBytes(mediaResponse));
  return cachedPath;
}

// In the build a web address becomes an import of the downloaded file: the picture is compressed and embedded like any other.
export async function embedRemoteMedia(remoteMediaPlaces: RemoteMediaPlace[], editedSource: MagicString, pluginContext: Rollup.TransformPluginContext): Promise<void> {
  for (const [placeIndex, { attributeValue, remoteAddress }] of remoteMediaPlaces.entries()) {
    let cachedPath;
    try {
      cachedPath = await downloadToCache(remoteAddress);
    } catch (downloadError) {
      pluginContext.error(commandLineTexts.remoteMediaFailed(remoteAddress, downloadError instanceof Error ? downloadError.message : String(downloadError)));
    }
    const importName = `slidemachinaRemoteMedia${placeIndex}`;
    editedSource.prepend(`import ${importName} from ${JSON.stringify(cachedPath)};`);
    editedSource.overwrite(attributeValue.start, attributeValue.end, `{${importName}}`);
  }
}
