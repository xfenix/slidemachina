import path from "node:path";
import { fetchGiphyClip } from "./giphy-clips.ts";
import { downloadMediaLink } from "./link-download.ts";
import { memeFolderParts, readTemplateFiles } from "./memegen-config.ts";
import { ensureMemeTemplate } from "./memegen-templates.ts";
import { escapeJsxText, SourceEditProblem } from "../development-server/source-rewriting.ts";
import { pickTextLanguage } from "../../shared-between-runtimes/text-language.ts";
import type { MemeKind } from "../../shared-between-runtimes/meme-template.ts";

export type MemeChoice = { memeKind: MemeKind, memeValue: string, isAnimated: boolean };
export type EnginePartNamer = (partName: string) => string;
// Files are downloaded first; the markup is written later, with the names the target file uses.
export type PreparedMeme = {
  engineParts: string[],
  mediaPath: string | undefined,
  writeMarkup: (nameEnginePart: EnginePartNamer, mediaImportName: string | undefined) => string[],
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

function writeMediaLine(nameEnginePart: EnginePartNamer, isVideo: boolean, mediaImportName: string | undefined): string {
  return isVideo ? `<${nameEnginePart("Video")} src={${mediaImportName}} stretch />` : `<${nameEnginePart("Image")} src={${mediaImportName}} alt="" stretch />`;
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

async function prepareTemplate(presentationFolder: string, memeChoice: MemeChoice, markupTexts: typeof markupTextsByLanguage.en): Promise<PreparedMeme> {
  const templateId = memeChoice.memeValue;
  const templateFiles = await readTemplateFiles(await ensureMemeTemplate(presentationFolder, templateId, memeChoice.isAnimated), memeChoice.isAnimated);
  if (templateFiles === undefined) throw new SourceEditProblem("memeTemplateMissing");
  const { templateName, sourceAddress, exampleCaptions, captionFields } = templateFiles.memegenConfig;
  // memegen's example text tells which field is which; the author replaces it on the slide.
  const captionTexts = captionFields.map((_captionField, fieldIndex) => exampleCaptions[fieldIndex] || markupTexts.placeholderCaption(fieldIndex + 1));
  const sourceText = markupTexts.templateSource(templateName, shortenAddress(sourceAddress ?? "memegen.link"));
  return {
    engineParts: ["Meme", "Source"],
    mediaPath: undefined,
    writeMarkup: (nameEnginePart) => [
      `<${nameEnginePart("Meme")} template="${templateId}"${memeChoice.isAnimated ? " animated" : ""}>`,
      ...captionTexts.map((captionText) => `  <p>${escapeJsxText(captionText)}</p>`),
      `</${nameEnginePart("Meme")}>`,
      writeSourceLine(nameEnginePart, sourceText),
    ],
  };
}

// The template, clip or link lands in images/memes/ of the presentation, with a <Source> line pointing where it came from.
export async function prepareMeme(presentationFolder: string, memeChoice: MemeChoice, languageCode: string): Promise<PreparedMeme> {
  const markupTexts = markupTextsByLanguage[pickTextLanguage(languageCode)];
  if (memeChoice.memeKind === "template") return prepareTemplate(presentationFolder, memeChoice, markupTexts);
  const memeFolder = path.join(presentationFolder, ...memeFolderParts);
  const giphyClip = memeChoice.memeKind === "clip" ? await fetchGiphyClip(memeChoice.memeValue) : undefined;
  const { mediaPath, isVideo } = giphyClip === undefined
    ? await downloadMediaLink(memeFolder, memeChoice.memeValue)
    : await downloadMediaLink(memeFolder, giphyClip.videoAddress, giphyClip.clipTitle || giphyClip.clipId);
  const sourceText = giphyClip === undefined ? markupTexts.linkSource(shortenAddress(memeChoice.memeValue)) : markupTexts.clipSource(shortenAddress(giphyClip.pageAddress));
  return {
    engineParts: [isVideo ? "Video" : "Image", "Source"],
    mediaPath,
    writeMarkup: (nameEnginePart, mediaImportName) => [writeMediaLine(nameEnginePart, isVideo, mediaImportName), writeSourceLine(nameEnginePart, sourceText)],
  };
}
