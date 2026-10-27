import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { styleText } from "node:util";
import { commandLineTexts } from "./command-line-texts.ts";
import { toImportPath } from "../development-server/media-files.ts";
import { SourceEditProblem } from "../development-server/source-rewriting.ts";
import { isGiphyOn, searchGiphyClips } from "../meme-sources/giphy-clips.ts";
import { nameMediaImport, prepareMeme, type MemeChoice } from "../meme-sources/meme-markup.ts";
import { searchMemeTemplates } from "../meme-sources/memegen-templates.ts";
import { presentationFileName } from "../presentation-repository/presentation-repository.ts";
import { readPresentationFile } from "../source-transforms/presentation-settings.ts";
import { findEngineNames, parseSlideSource } from "../source-transforms/syntax-tree.ts";

export type MemeFlags = { template?: string, gif?: string, url?: string, animated?: boolean, local?: boolean };

const shownTemplateLimit = 12;
const listIndent = "  ";
const hintIndent = "      ";
const templateIdColumnWidth = 14;

function chooseMeme(memeFlags: MemeFlags): MemeChoice | undefined {
  const isAnimated = memeFlags.animated ?? false;
  const storesLocally = memeFlags.local ?? false;
  if (memeFlags.template !== undefined) return { memeKind: "template", memeValue: memeFlags.template, isAnimated, storesLocally };
  if (memeFlags.gif !== undefined) return { memeKind: "clip", memeValue: memeFlags.gif, isAnimated, storesLocally };
  if (memeFlags.url !== undefined) return { memeKind: "link", memeValue: memeFlags.url, isAnimated, storesLocally };
  return undefined;
}

// Plain lines for a person and for an agent alike: each find comes with the command that takes it.
async function printSearch(searchQuery: string): Promise<void> {
  const [memeTemplates, giphyClips] = await Promise.all([searchMemeTemplates(searchQuery), searchGiphyClips(searchQuery)]);
  console.log(commandLineTexts.memeTemplatesFound(searchQuery, memeTemplates.length));
  for (const memeTemplate of memeTemplates.slice(0, shownTemplateLimit)) {
    console.log(`${listIndent}${memeTemplate.templateId.padEnd(templateIdColumnWidth)}${commandLineTexts.memeTemplateLine(memeTemplate.templateName, memeTemplate.captionCount, memeTemplate.isAnimatable)}`);
    console.log(styleText("dim", `${hintIndent}slidemachina meme --template ${memeTemplate.templateId}`));
  }
  if (memeTemplates.length > shownTemplateLimit) console.log(`${listIndent}${commandLineTexts.memeMoreTemplates(memeTemplates.length - shownTemplateLimit)}`);
  if (memeTemplates.length === 0) console.log(`${listIndent}${commandLineTexts.memeNoTemplates}`);
  console.log("");
  if (!isGiphyOn()) {
    console.log(commandLineTexts.giphyOff);
    return;
  }
  console.log(commandLineTexts.memeClipsFound(giphyClips.length));
  for (const giphyClip of giphyClips) {
    console.log(`${listIndent}${giphyClip.clipTitle || giphyClip.clipId}  ${styleText("dim", giphyClip.pageAddress)}`);
    console.log(styleText("dim", `${hintIndent}slidemachina meme --gif ${giphyClip.clipId}`));
  }
}

// The markup uses the names index.tsx imports: Machina.Meme after import * as Machina, Meme after a named import.
async function printTakenMeme(presentationFolder: string, memeChoice: MemeChoice): Promise<void> {
  const presentationFile = path.join(presentationFolder, presentationFileName);
  const presentationSource = readFileSync(presentationFile, "utf8");
  const engineNames = findEngineNames(parseSlideSource(presentationSource, presentationFile));
  const preparedMeme = await prepareMeme(presentationFolder, memeChoice, readPresentationFile(presentationFolder).languageCode);
  const { mediaPath, remoteAddress } = preparedMeme;
  const mediaImportName = mediaPath === undefined ? undefined : nameMediaImport(mediaPath, (importName) => new RegExp(`\\b${importName}\\b`).test(presentationSource));
  console.log(mediaPath === undefined ? commandLineTexts.memeLinked : commandLineTexts.memeSaved(path.relative(process.cwd(), mediaPath) || "."));
  console.log("");
  if (mediaPath !== undefined) console.log(`import ${mediaImportName} from ${JSON.stringify(toImportPath(presentationFolder, mediaPath))};\n`);
  const mediaSource = mediaImportName === undefined ? JSON.stringify(remoteAddress) : `{${mediaImportName}}`;
  console.log(preparedMeme.writeMarkup((partName) => engineNames[partName] ?? partName, mediaSource).join("\n"));
}

export async function runMemeCommand(commandArguments: string[], memeFlags: MemeFlags): Promise<void> {
  const memeChoice = chooseMeme(memeFlags);
  try {
    if (memeChoice === undefined) {
      const searchQuery = commandArguments.join(" ").trim();
      if (searchQuery === "") throw new Error(commandLineTexts.memeQueryMissing);
      await printSearch(searchQuery);
      return;
    }
    const requestedFolder = path.resolve(commandArguments[0] ?? ".");
    if (!existsSync(path.join(requestedFolder, presentationFileName))) throw new Error(commandLineTexts.memeFolderWithoutPresentation(requestedFolder));
    await printTakenMeme(realpathSync(requestedFolder), memeChoice);
  } catch (memeError) {
    if (!(memeError instanceof SourceEditProblem)) {
      console.error(memeError instanceof Error ? memeError.message : String(memeError));
      process.exit(1);
    }
    // The detail, an address and a status, follows the explanation when there is one.
    const problemDetail = memeError.message === memeError.problemCode ? undefined : memeError.message;
    console.error([commandLineTexts.memeProblems[memeError.problemCode], problemDetail].filter((problemPart) => problemPart !== undefined).join(". "));
    process.exit(1);
  }
}
