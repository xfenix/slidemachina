import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sourceEditEndpoint } from "../../../shared-between-runtimes/engine-constants.js";
import { findPresentationFolder, isSlideSourceFile } from "../../presentation-repository/presentation-repository.js";
import { hashSourceCode } from "../../source-transforms/source-marking.js";
import { isOwnPageRequest, largestPictureBytes, parseEditRequest, readRequestBody } from "./edit-request-checks.js";
import { moveDiagramBox, rewriteElementText, rewritePictureSource, SourceEditProblem } from "./source-rewriting.js";

/** @typedef {import("./edit-request-checks.js").EditRequest} EditRequest */

const pictureFolderName = "images";
const pictureExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);
const methodNotAllowedStatus = 405;
const foreignOriginStatus = 403;
const successStatus = 200;
const staleVersionStatus = 409;
const rejectedEditStatus = 422;
const failedEditStatus = 500;

/**
 * @param {import("../../presentation-repository/presentation-repository.js").SiteLayout} siteLayout
 * @param {string} sourceLocation
 */
function resolveSourceLocation(siteLayout, sourceLocation) {
  const locationMatch = /^(.+):(\d+):(\d+)$/.exec(sourceLocation);
  if (locationMatch === null) throw new SourceEditProblem("elementMissing");
  let filePath;
  try {
    filePath = realpathSync(path.resolve(siteLayout.rootFolder, locationMatch[1]));
  } catch {
    throw new SourceEditProblem("elementMissing");
  }
  if (!isSlideSourceFile(siteLayout, filePath)) throw new SourceEditProblem("elementMissing");
  return { filePath, sourcePlace: { lineNumber: Number(locationMatch[2]), columnNumber: Number(locationMatch[3]) } };
}

/**
 * @param {string} importingFolder
 * @param {string} targetFile
 */
function toImportPath(importingFolder, targetFile) {
  const relativePath = path.relative(importingFolder, targetFile).split(path.sep).join("/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

// A file with the same name and other content gets a number; the same content reuses the file already there.
/**
 * @param {string} presentationFolder
 * @param {string} originalName
 * @param {Buffer} pictureBytes
 */
async function choosePicturePath(presentationFolder, originalName, pictureBytes) {
  const pictureExtension = path.extname(originalName).toLowerCase();
  if (!pictureExtensions.has(pictureExtension)) throw new SourceEditProblem("pictureType");
  const cleanStem = path.basename(originalName, path.extname(originalName)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "picture";
  const pictureFolder = path.join(presentationFolder, pictureFolderName);
  for (let copyNumber = 1; ; copyNumber += 1) {
    const picturePath = path.join(pictureFolder, `${cleanStem}${copyNumber === 1 ? "" : `-${copyNumber}`}${pictureExtension}`);
    if (!existsSync(picturePath)) return { picturePath, needsWriting: true };
    if ((await readFile(picturePath)).equals(pictureBytes)) return { picturePath, needsWriting: false };
  }
}

// The page sends the version of the file it was built from: if the file changed since, nothing is written.
/**
 * @param {import("../../presentation-repository/presentation-repository.js").SiteLayout} siteLayout
 * @param {EditRequest} editRequest
 */
async function applySourceEdit(siteLayout, editRequest) {
  const { filePath, sourcePlace } = resolveSourceLocation(siteLayout, editRequest.sourceLocation);
  const sourceCode = await readFile(filePath, "utf8");
  if (hashSourceCode(sourceCode) !== editRequest.sourceVersion) throw new SourceEditProblem("fileChanged");
  if (editRequest.editKind === "text") {
    const typedText = editRequest.typedText.trim();
    if (typedText === "") throw new SourceEditProblem("emptyText");
    await writeFile(filePath, rewriteElementText(sourceCode, filePath, sourcePlace, typedText));
    return;
  }
  if (editRequest.editKind === "box") {
    const anchorPlace = editRequest.anchorLocation === undefined ? undefined : resolveSourceLocation(siteLayout, editRequest.anchorLocation).sourcePlace;
    const boxPlacement = { columnNumber: editRequest.columnNumber, anchorPlace, anchorSide: editRequest.anchorSide };
    await writeFile(filePath, moveDiagramBox(sourceCode, filePath, sourcePlace, boxPlacement));
    return;
  }
  if (editRequest.editKind === "picture") {
    const pictureBytes = Buffer.from(editRequest.pictureContent, "base64");
    if (pictureBytes.length > largestPictureBytes) throw new SourceEditProblem("pictureTooLarge");
    const presentationFolder = findPresentationFolder(siteLayout, filePath) ?? siteLayout.rootFolder;
    const { picturePath, needsWriting } = await choosePicturePath(presentationFolder, editRequest.pictureName, pictureBytes);
    const editedSource = rewritePictureSource(sourceCode, filePath, sourcePlace, toImportPath(path.dirname(filePath), picturePath));
    if (needsWriting) {
      await mkdir(path.dirname(picturePath), { recursive: true });
      await writeFile(picturePath, pictureBytes);
    }
    await writeFile(filePath, editedSource);
    return;
  }
  throw new SourceEditProblem("elementMissing");
}

/**
 * @param {import("vite").ViteDevServer} developmentServer
 * @param {import("../../presentation-repository/presentation-repository.js").SiteLayout} siteLayout
 */
export function installSourceEditing(developmentServer, siteLayout) {
  /** @type {Promise<void>} */
  let editQueue = Promise.resolve();
  developmentServer.middlewares.use(sourceEditEndpoint, (incomingRequest, serverResponse) => {
    /**
     * @param {number} statusCode
     * @param {object} answerBody
     */
    const sendAnswer = (statusCode, answerBody) => {
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
        await applySourceEdit(siteLayout, parseEditRequest(await readRequestBody(incomingRequest)));
        sendAnswer(successStatus, {});
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
