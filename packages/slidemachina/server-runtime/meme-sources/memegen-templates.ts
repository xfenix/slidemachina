import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { animatedPictureName, findTemplateFolder, findTemplatePicture, listPictureNames, memeConfigFileName } from "./memegen-config.ts";
import { fetchFromSource, readResponseBytes } from "./source-fetching.ts";
import { SourceEditProblem } from "../development-server/source-rewriting.ts";
import type { MemeTemplateSummary } from "../../shared-between-runtimes/meme-template.ts";

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

async function downloadTemplate(templateFolder: string, templateId: string, pictureNames: string[]): Promise<string> {
  const configPath = path.join(templateFolder, memeConfigFileName);
  const configBytes = existsSync(configPath) ? undefined : await downloadTemplateFile(templateId, memeConfigFileName);
  if (!existsSync(configPath) && configBytes === undefined) throw new SourceEditProblem("memeTemplateMissing");
  for (const pictureName of pictureNames) {
    const pictureBytes = await downloadTemplateFile(templateId, pictureName);
    if (pictureBytes === undefined) continue;
    await mkdir(templateFolder, { recursive: true });
    await writeFile(path.join(templateFolder, pictureName), pictureBytes);
    if (configBytes !== undefined) await writeFile(configPath, configBytes);
    return templateFolder;
  }
  throw new SourceEditProblem("memeTemplateMissing");
}

function downloadOnce(downloadKey: string, startDownload: () => Promise<string>): Promise<string> {
  const pendingDownload = pendingDownloads.get(downloadKey) ?? startDownload().finally(() => pendingDownloads.delete(downloadKey));
  pendingDownloads.set(downloadKey, pendingDownload);
  return pendingDownload;
}

// A template already in images/memes/ works without the network, in dev and in the build.
export function ensureMemeTemplate(presentationFolder: string, templateId: string, isAnimated: boolean): Promise<string> {
  if (!templateIdPattern.test(templateId)) return Promise.reject(new SourceEditProblem("memeTemplateMissing"));
  const templateFolder = findTemplateFolder(presentationFolder, templateId);
  const foundPicture = findTemplatePicture(templateFolder, isAnimated);
  const hasTemplate = existsSync(path.join(templateFolder, memeConfigFileName)) && foundPicture !== undefined;
  if (!hasTemplate) return downloadOnce(templateFolder, () => downloadTemplate(templateFolder, templateId, listPictureNames(isAnimated)));
  if (!isAnimated || foundPicture.endsWith(animatedPictureName)) return Promise.resolve(templateFolder);
  // "animated" added to a still template fetches its GIF; without one, or offline, the still picture stays.
  return downloadOnce(`${templateFolder}:animated`, () =>
    downloadTemplate(templateFolder, templateId, [animatedPictureName]).catch(() => templateFolder),
  );
}
