import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { listPictureNames, memeConfigFileName, memeFolderParts, parseMemegenConfig, type MemegenConfig } from "./memegen-config.ts";
import { fetchFromSource, readResponseBytes } from "./source-fetching.ts";
import { SourceEditProblem } from "../development-server/source-rewriting.ts";
import type { MemeTemplateSummary } from "../../shared-between-runtimes/meme-template.ts";

// A remote template keeps the address of its picture on GitHub; a local one is saved in images/memes/.
export type FoundTemplate = { picturePlace: { picturePath: string } | { pictureAddress: string }, memegenConfig: MemegenConfig };
type MemegenListEntry = { id: string, name: string, lines: number, styles?: string[], keywords?: string[], blank: string, example?: { url?: string } };

// SLIDEMACHINA_MEMEGEN_ADDRESS points both at one local server in tests: it answers /templates and /templates/<id>/<file>.
const memegenAddressOverride = process.env.SLIDEMACHINA_MEMEGEN_ADDRESS;
const memegenListAddress = `${memegenAddressOverride ?? "https://api.memegen.link"}/templates`;
// The API renders pictures with a watermark; the repository keeps the clean ones next to their configs.
const memegenFilesAddress = `${memegenAddressOverride ?? "https://raw.githubusercontent.com/jacebrowning/memegen/main"}/templates`;
const previewWidth = 320;
const templateIdPattern = /^[a-z0-9][a-z0-9-]*$/;
const notFoundStatus = 404;

let templateListRequest: Promise<MemeTemplateSummary[]> | undefined;
const pendingDownloads = new Map<string, Promise<string>>();

async function requestTemplateList(): Promise<MemeTemplateSummary[]> {
  const listResponse = await fetchFromSource(memegenListAddress);
  if (!listResponse.ok) throw new SourceEditProblem("memeNetworkFailed", `${memegenListAddress}: ${listResponse.status}`);
  const listEntries = (await listResponse.json()) as MemegenListEntry[];
  // The list repeats a few templates; the first entry of each wins.
  const uniqueEntries = [...new Map(listEntries.toReversed().map((listEntry) => [listEntry.id, listEntry])).values()].toReversed();
  return uniqueEntries.map((listEntry) => ({
    templateId: listEntry.id,
    templateName: listEntry.name,
    captionCount: listEntry.lines,
    keywords: listEntry.keywords ?? [],
    previewAddress: `${listEntry.example?.url ?? listEntry.blank}?width=${previewWidth}`,
    isAnimatable: listEntry.styles?.includes("animated") ?? false,
  }));
}

// One request per process: the list changes rarely and weighs about 90 KB.
function listMemeTemplates(): Promise<MemeTemplateSummary[]> {
  templateListRequest ??= requestTemplateList().catch((listError: unknown) => {
    templateListRequest = undefined;
    throw listError;
  });
  return templateListRequest;
}

// Every word of the query has to appear in the id, the name or the keywords; an empty query lists all templates.
export async function searchMemeTemplates(searchQuery: string): Promise<MemeTemplateSummary[]> {
  const queryWords = searchQuery.toLowerCase().split(/\s+/).filter((queryWord) => queryWord !== "");
  const memeTemplates = await listMemeTemplates();
  return memeTemplates.filter((memeTemplate) => {
    const searchedText = [memeTemplate.templateId, memeTemplate.templateName, ...memeTemplate.keywords].join(" ").toLowerCase();
    return queryWords.every((queryWord) => searchedText.includes(queryWord));
  });
}

async function downloadTemplateFile(templateId: string, fileName: string): Promise<Buffer | undefined> {
  const fileAddress = `${memegenFilesAddress}/${templateId}/${fileName}`;
  const fileResponse = await fetchFromSource(fileAddress);
  if (fileResponse.status === notFoundStatus) return undefined;
  if (!fileResponse.ok) throw new SourceEditProblem("memeNetworkFailed", `${fileAddress}: ${fileResponse.status}`);
  return readResponseBytes(fileResponse);
}

function downloadOnce(downloadKey: string, startDownload: () => Promise<string>): Promise<string> {
  const pendingDownload = pendingDownloads.get(downloadKey) ?? startDownload().finally(() => pendingDownloads.delete(downloadKey));
  pendingDownloads.set(downloadKey, pendingDownload);
  return pendingDownload;
}

// The picture is saved as images/memes/<template>.jpg, .png or .gif and kept: a second meme of the same template reuses it.
async function savePicture(memeFolder: string, templateId: string, isAnimated: boolean): Promise<string> {
  const pictureNames = listPictureNames(isAnimated);
  const savedPicture = pictureNames
    .map((pictureName) => path.join(memeFolder, `${templateId}${path.extname(pictureName)}`))
    .find((picturePath) => existsSync(picturePath));
  if (savedPicture !== undefined) return savedPicture;
  for (const pictureName of pictureNames) {
    const pictureBytes = await downloadTemplateFile(templateId, pictureName);
    if (pictureBytes === undefined) continue;
    const picturePath = path.join(memeFolder, `${templateId}${path.extname(pictureName)}`);
    await mkdir(memeFolder, { recursive: true });
    await writeFile(picturePath, pictureBytes);
    return picturePath;
  }
  throw new SourceEditProblem("memeTemplateMissing");
}

async function findRemotePicture(templateId: string, isAnimated: boolean): Promise<string> {
  for (const pictureName of listPictureNames(isAnimated)) {
    if ((await downloadTemplateFile(templateId, pictureName)) !== undefined) return `${memegenFilesAddress}/${templateId}/${pictureName}`;
  }
  throw new SourceEditProblem("memeTemplateMissing");
}

// config.yml is read once, for the markup: its fields become data-place and style of the captions, the file itself is not kept.
export async function findMemeTemplate(presentationFolder: string, templateId: string, isAnimated: boolean, storesLocally: boolean): Promise<FoundTemplate> {
  if (!templateIdPattern.test(templateId)) throw new SourceEditProblem("memeTemplateMissing");
  const configBytes = await downloadTemplateFile(templateId, memeConfigFileName);
  if (configBytes === undefined) throw new SourceEditProblem("memeTemplateMissing");
  const memegenConfig = parseMemegenConfig(configBytes.toString("utf8"), templateId);
  if (!storesLocally) return { picturePlace: { pictureAddress: await findRemotePicture(templateId, isAnimated) }, memegenConfig };
  const memeFolder = path.join(presentationFolder, ...memeFolderParts);
  const picturePath = await downloadOnce(`${memeFolder}:${templateId}:${isAnimated}`, () => savePicture(memeFolder, templateId, isAnimated));
  return { picturePlace: { picturePath }, memegenConfig };
}
