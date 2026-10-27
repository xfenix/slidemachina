import path from "node:path";
import { fetchGiphyClip } from "./giphy-clips.ts";
import { findMediaLink, saveFoundMedia } from "./link-download.ts";
import { memeFolderParts, type MemeCaptionField } from "./memegen-config.ts";
import { findMemeTemplate } from "./memegen-templates.ts";
import { escapeJsxText } from "../development-server/source-rewriting.ts";
import { pickTextLanguage } from "../../shared-between-runtimes/text-language.ts";
import type { MemeKind } from "../../shared-between-runtimes/meme-template.ts";

// A remote meme points at the picture on the web, a local one is saved in images/memes/; the build embeds either.
export type MemeChoice = { memeKind: MemeKind, memeValue: string, isAnimated: boolean, storesLocally: boolean };
export type EnginePartNamer = (partName: string) => string;
// Files are downloaded first; the markup is written later, with the names the target file uses.
// The source is {importName} for a saved file and "https://…" for a remote one.
export type PreparedMeme = {
  engineParts: string[],
  mediaPath: string | undefined,
  remoteAddress: string | undefined,
  writeMarkup: (nameEnginePart: EnginePartNamer, mediaSource: string) => string[],
};

const markupTextsByLanguage = {
  en: {
    templateSource: (templateName: string, sourceAddress: string) => `Template: ${templateName}, ${sourceAddress}`,
    clipSource: (pageAddress: string) => `GIF: GIPHY, ${pageAddress}`,
    linkSource: (linkAddress: string) => `Source: ${linkAddress}`,
    placeholderCaption: (captionNumber: number) => `Caption ${captionNumber}`,
  },
  ru: {
    templateSource: (templateName: string, sourceAddress: string) => `Шаблон: ${templateName}, ${sourceAddress}`,
    clipSource: (pageAddress: string) => `GIF: GIPHY, ${pageAddress}`,
    linkSource: (linkAddress: string) => `Источник: ${linkAddress}`,
    placeholderCaption: (captionNumber: number) => `Подпись ${captionNumber}`,
  },
};

function shortenAddress(fullAddress: string): string {
  return fullAddress.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function writeSourceLine(nameEnginePart: EnginePartNamer, sourceText: string): string {
  return `<${nameEnginePart("Source")}>${escapeJsxText(sourceText)}</${nameEnginePart("Source")}>`;
}

function writeMediaLine(nameEnginePart: EnginePartNamer, isVideo: boolean, mediaSource: string): string {
  return isVideo ? `<${nameEnginePart("Video")} src=${mediaSource} stretch />` : `<${nameEnginePart("Image")} src=${mediaSource} alt="" stretch />`;
}

// "this-is-fine.gif" becomes thisIsFinePicture; a name taken in the file gets a number.
export function nameMediaImport(mediaPath: string, isNameTaken: (importName: string) => boolean): string {
  const nameWords = path.basename(mediaPath, path.extname(mediaPath)).split(/[^a-zA-Z0-9]+/).filter((nameWord) => nameWord !== "");
  const camelStem = nameWords.map((nameWord, wordIndex) => (wordIndex === 0 ? nameWord : nameWord[0]!.toUpperCase() + nameWord.slice(1))).join("");
  const kindSuffix = /\.(mp4|webm)$/i.test(mediaPath) ? "Video" : "Picture";
  const baseName = /^[a-zA-Z]/.test(camelStem) ? `${camelStem}${kindSuffix}` : `meme${kindSuffix}`;
  for (let copyNumber = 1; ; copyNumber += 1) {
    const importName = copyNumber === 1 ? baseName : `${baseName}${copyNumber}`;
    if (!isNameTaken(importName)) return importName;
  }
}

// <Meme> puts its first caption along the top and the second along the bottom, the bands of a fifth that memegen uses by default.
const percentScale = 100;
const roundingScale = 10;
const defaultBoxes = ["0 0 100 20", "0 80 100 20"];
const namedBoxes: Record<string, string> = { "0 0 100 20": "top", "0 80 100 20": "bottom", "0 40 100 20": "center" };
const thinFontWeight = 500;

function roundPercent(fieldShare: number): number {
  return Math.round(fieldShare * percentScale * roundingScale) / roundingScale;
}

// A field becomes data-place and plain CSS on the caption: nothing about the template is kept outside the slide.
function writeCaptionLine(captionField: MemeCaptionField, fieldIndex: number, captionText: string): string {
  const fieldBox = [captionField.fieldLeft, captionField.fieldTop, captionField.fieldWidth, captionField.fieldHeight].map(roundPercent).join(" ");
  const placeAttribute = defaultBoxes[fieldIndex] === fieldBox ? "" : ` data-place="${namedBoxes[fieldBox] ?? fieldBox}"`;
  const styleEntries = [
    captionField.textColor === "white" ? undefined : `color: ${JSON.stringify(captionField.textColor)}`,
    captionField.fieldAngle === 0 ? undefined : `rotate: "${-captionField.fieldAngle}deg"`,
    captionField.textAlign === "left" ? `textAlign: "left"` : undefined,
    captionField.letterCase === "upper" ? undefined : `textTransform: "${captionField.letterCase === "lower" ? "lowercase" : "none"}"`,
    captionField.isThickFont ? undefined : `fontWeight: ${thinFontWeight}`,
  ].filter((styleEntry) => styleEntry !== undefined);
  const styleAttribute = styleEntries.length === 0 ? "" : ` style={{ ${styleEntries.join(", ")} }}`;
  return `  <p${placeAttribute}${styleAttribute}>${escapeJsxText(captionText)}</p>`;
}

async function prepareTemplate(presentationFolder: string, memeChoice: MemeChoice, markupTexts: typeof markupTextsByLanguage.en): Promise<PreparedMeme> {
  const { picturePlace, memegenConfig } = await findMemeTemplate(presentationFolder, memeChoice.memeValue, memeChoice.isAnimated, memeChoice.storesLocally);
  const { templateName, sourceAddress, exampleCaptions, captionFields } = memegenConfig;
  // memegen's example text tells which field is which; the author replaces it on the slide.
  const captionTexts = captionFields.map((_captionField, fieldIndex) => exampleCaptions[fieldIndex] || markupTexts.placeholderCaption(fieldIndex + 1));
  const sourceText = markupTexts.templateSource(templateName, shortenAddress(sourceAddress ?? "memegen.link"));
  return {
    engineParts: ["Meme", "Source"],
    mediaPath: "picturePath" in picturePlace ? picturePlace.picturePath : undefined,
    remoteAddress: "pictureAddress" in picturePlace ? picturePlace.pictureAddress : undefined,
    writeMarkup: (nameEnginePart, mediaSource) => [
      `<${nameEnginePart("Meme")} src=${mediaSource} alt=${JSON.stringify(templateName)}>`,
      ...captionFields.map((captionField, fieldIndex) => writeCaptionLine(captionField, fieldIndex, captionTexts[fieldIndex]!)),
      `</${nameEnginePart("Meme")}>`,
      writeSourceLine(nameEnginePart, sourceText),
    ],
  };
}

// The template, clip or link comes with a <Source> line pointing where it came from.
export async function prepareMeme(presentationFolder: string, memeChoice: MemeChoice, languageCode: string): Promise<PreparedMeme> {
  const markupTexts = markupTextsByLanguage[pickTextLanguage(languageCode)];
  if (memeChoice.memeKind === "template") return prepareTemplate(presentationFolder, memeChoice, markupTexts);
  const giphyClip = memeChoice.memeKind === "clip" ? await fetchGiphyClip(memeChoice.memeValue) : undefined;
  const foundMedia = await findMediaLink(giphyClip?.videoAddress ?? memeChoice.memeValue);
  const mediaPath = memeChoice.storesLocally
    ? (await saveFoundMedia(path.join(presentationFolder, ...memeFolderParts), foundMedia, giphyClip === undefined ? undefined : giphyClip.clipTitle || giphyClip.clipId)).mediaPath
    : undefined;
  const sourceText = giphyClip === undefined ? markupTexts.linkSource(shortenAddress(memeChoice.memeValue)) : markupTexts.clipSource(shortenAddress(giphyClip.pageAddress));
  return {
    engineParts: [foundMedia.isVideo ? "Video" : "Image", "Source"],
    mediaPath,
    remoteAddress: memeChoice.storesLocally ? undefined : foundMedia.mediaAddress.href,
    writeMarkup: (nameEnginePart, mediaSource) => [writeMediaLine(nameEnginePart, foundMedia.isVideo, mediaSource), writeSourceLine(nameEnginePart, sourceText)],
  };
}
