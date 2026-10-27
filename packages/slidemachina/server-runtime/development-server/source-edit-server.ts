import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sourceEditEndpoint } from "../../shared-between-runtimes/engine-constants.ts";
import { findPresentationFolder, isSlideSourceFile } from "../presentation-repository/presentation-repository.ts";
import { describeOffset, findLineStarts, hashSourceCode } from "../source-transforms/source-marking.ts";
import { isOwnPageRequest, largestPictureBytes, parseEditRequest, readRequestBody } from "./edit-request-checks.ts";
import { chooseMediaPath, pictureExtensions, toImportPath } from "./media-files.ts";
import { copyOrRemoveSlide, insertSlideAfter, moveDiagramBox, moveSlide, rewriteElementText, rewritePictureSource, SourceEditProblem } from "./source-rewriting.ts";
import { nameMediaImport, prepareMeme } from "../meme-sources/meme-markup.ts";
import { readPresentationFile } from "../source-transforms/presentation-settings.ts";
import { pickTextLanguage } from "../../shared-between-runtimes/text-language.ts";
import type { SlideAction, SourcePlace } from "./source-rewriting.ts";
import type { EditRequest } from "./edit-request-checks.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";
import type { ViteDevServer } from "vite";

const pictureFolderName = "images";
const methodNotAllowedStatus = 405;
const foreignOriginStatus = 403;
const successStatus = 200;
const staleVersionStatus = 409;
const rejectedEditStatus = 422;
const failedEditStatus = 500;
const newSlideTitles = { en: "New slide", ru: "Новый слайд" };

type EditAnswer = { slideLocation?: string };

function resolveSourceLocation(siteLayout: SiteLayout, sourceLocation: string): { filePath: string, sourcePlace: SourcePlace } {
  const locationMatch = /^(.+):(\d+):(\d+)$/.exec(sourceLocation);
  if (locationMatch === null) throw new SourceEditProblem("elementMissing");
  let filePath;
  try {
    filePath = realpathSync(path.resolve(siteLayout.rootFolder, locationMatch[1]!));
  } catch {
    throw new SourceEditProblem("elementMissing");
  }
  if (!isSlideSourceFile(siteLayout, filePath)) throw new SourceEditProblem("elementMissing");
  return { filePath, sourcePlace: { lineNumber: Number(locationMatch[2]), columnNumber: Number(locationMatch[3]) } };
}

// The page sends the version of the file it was built from: if the file changed since, nothing is written.
// A moved slide comes back with its new place, so the page can follow it to its new number.
async function applySourceEdit(siteLayout: SiteLayout, editRequest: EditRequest): Promise<EditAnswer> {
  const { filePath, sourcePlace } = resolveSourceLocation(siteLayout, editRequest.sourceLocation);
  const sourceCode = await readFile(filePath, "utf8");
  if (hashSourceCode(sourceCode) !== editRequest.sourceVersion) throw new SourceEditProblem("fileChanged");
  if (editRequest.editKind === "text") {
    const typedText = editRequest.typedText.trim();
    if (typedText === "") throw new SourceEditProblem("emptyText");
    await writeFile(filePath, rewriteElementText(sourceCode, filePath, sourcePlace, typedText));
    return {};
  }
  if (editRequest.editKind === "box") {
    const anchorPlace = editRequest.anchorLocation === undefined ? undefined : resolveSourceLocation(siteLayout, editRequest.anchorLocation).sourcePlace;
    const boxPlacement = { columnNumber: editRequest.columnNumber, anchorPlace, anchorSide: editRequest.anchorSide };
    await writeFile(filePath, moveDiagramBox(sourceCode, filePath, sourcePlace, boxPlacement));
    return {};
  }
  const presentationFolder = findPresentationFolder(siteLayout, filePath) ?? siteLayout.rootFolder;
  if (editRequest.editKind === "meme") {
    await insertMemeSlide(filePath, sourcePlace, presentationFolder, editRequest);
    return {};
  }
  if (editRequest.editKind === "slide") return changeSlide(siteLayout, filePath, sourceCode, sourcePlace, presentationFolder, editRequest.slideAction);
  const pictureBytes = Buffer.from(editRequest.pictureContent, "base64");
  if (pictureBytes.length > largestPictureBytes) throw new SourceEditProblem("pictureTooLarge");
  if (!pictureExtensions.has(path.extname(editRequest.pictureName).toLowerCase())) throw new SourceEditProblem("pictureType");
  const { mediaPath: picturePath, needsWriting } = await chooseMediaPath(path.join(presentationFolder, pictureFolderName), editRequest.pictureName, pictureBytes);
  const editedSource = rewritePictureSource(sourceCode, filePath, sourcePlace, toImportPath(path.dirname(filePath), picturePath));
  if (needsWriting) {
    await mkdir(path.dirname(picturePath), { recursive: true });
    await writeFile(picturePath, pictureBytes);
  }
  await writeFile(filePath, editedSource);
  return {};
}

async function changeSlide(
  siteLayout: SiteLayout,
  filePath: string,
  sourceCode: string,
  slidePlace: SourcePlace,
  presentationFolder: string,
  slideAction: SlideAction,
): Promise<EditAnswer> {
  if (slideAction === "earlier" || slideAction === "later") {
    const { editedCode, slideStart } = moveSlide(sourceCode, filePath, slidePlace, slideAction === "earlier");
    await writeFile(filePath, editedCode);
    const relativeFile = path.relative(siteLayout.rootFolder, filePath).split(path.sep).join("/");
    return { slideLocation: `${relativeFile}:${describeOffset(findLineStarts(editedCode), slideStart)}` };
  }
  if (slideAction === "add") {
    const slideTitle = newSlideTitles[pickTextLanguage(readPresentationFile(presentationFolder).languageCode)];
    const newSlide = { engineParts: [], mediaImport: undefined, writeMarkup: () => [`<h2>${slideTitle}</h2>`] };
    await writeFile(filePath, insertSlideAfter(sourceCode, filePath, slidePlace, newSlide));
    return {};
  }
  await writeFile(filePath, copyOrRemoveSlide(sourceCode, filePath, slidePlace, slideAction === "remove"));
  return {};
}

// Downloading takes seconds: the file is read again afterwards, and its version checked again.
async function insertMemeSlide(filePath: string, slidePlace: SourcePlace, presentationFolder: string, memeRequest: EditRequest & { editKind: "meme" }): Promise<void> {
  const { languageCode } = readPresentationFile(presentationFolder);
  const memeChoice = { memeKind: memeRequest.memeKind, memeValue: memeRequest.memeValue, isAnimated: false, storesLocally: memeRequest.storesLocally };
  const preparedMeme = await prepareMeme(presentationFolder, memeChoice, languageCode);
  const sourceCode = await readFile(filePath, "utf8");
  if (hashSourceCode(sourceCode) !== memeRequest.sourceVersion) throw new SourceEditProblem("fileChanged");
  const { mediaPath, remoteAddress } = preparedMeme;
  const mediaImport = mediaPath === undefined
    ? undefined
    : {
        importName: nameMediaImport(mediaPath, (importName) => new RegExp(`\\b${importName}\\b`).test(sourceCode)),
        importPath: toImportPath(path.dirname(filePath), mediaPath),
      };
  const mediaSource = mediaImport === undefined ? JSON.stringify(remoteAddress) : `{${mediaImport.importName}}`;
  const insertedSlide = { engineParts: preparedMeme.engineParts, mediaImport, writeMarkup: (nameEnginePart: (partName: string) => string) => preparedMeme.writeMarkup(nameEnginePart, mediaSource) };
  await writeFile(filePath, insertSlideAfter(sourceCode, filePath, slidePlace, insertedSlide));
}

export function installSourceEditing(developmentServer: ViteDevServer, siteLayout: SiteLayout): void {
  let editQueue: Promise<void> = Promise.resolve();
  developmentServer.middlewares.use(sourceEditEndpoint, (incomingRequest, serverResponse) => {
    const sendAnswer = (statusCode: number, answerBody: object) => {
      serverResponse.statusCode = statusCode;
      serverResponse.setHeader("Content-Type", "application/json");
      serverResponse.end(JSON.stringify(answerBody));
    };
    const isJsonPost = incomingRequest.method === "POST" && incomingRequest.headers["content-type"]?.startsWith("application/json");
    if (!isJsonPost) return sendAnswer(methodNotAllowedStatus, { problemCode: "wrongRequest" });
    if (!isOwnPageRequest(incomingRequest)) return sendAnswer(foreignOriginStatus, { problemCode: "wrongRequest" });
    // One edit at a time: the second one sees the file the first has written and checks its version against it.
    editQueue = editQueue.then(async () => {
      try {
        sendAnswer(successStatus, await applySourceEdit(siteLayout, parseEditRequest(await readRequestBody(incomingRequest))));
      } catch (editError) {
        const isKnownProblem = editError instanceof SourceEditProblem;
        if (!isKnownProblem) developmentServer.config.logger.error(editError instanceof Error ? String(editError.stack ?? editError) : String(editError));
        const problemCode = isKnownProblem ? editError.problemCode : "writeFailed";
        const problemDetail = editError instanceof Error ? editError.message : String(editError);
        sendAnswer(problemCode === "fileChanged" ? staleVersionStatus : isKnownProblem ? rejectedEditStatus : failedEditStatus, { problemCode, problemDetail });
      }
    });
  });
}
