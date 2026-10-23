import { SourceEditProblem } from "./source-rewriting.js";

/**
 * @typedef {{ sourceLocation: string, sourceVersion?: string } & (
 *   | { editKind: "text", typedText: string }
 *   | { editKind: "picture", pictureName: string, pictureContent: string }
 *   | { editKind: "box", columnNumber?: number, anchorLocation?: string, anchorSide?: "before" | "after" }
 * )} EditRequest
 */

export const largestPictureBytes = 80 * 1024 * 1024;
// base64 makes a file a third larger; the rest is room for the other fields of the JSON.
const largestRequestBytes = Math.ceil((largestPictureBytes * 4) / 3) + 1024 * 1024;
/** @type {Set<unknown>} */
const anchorSides = new Set(["before", "after"]);

/**
 * @param {import("node:http").IncomingMessage} incomingRequest
 * @returns {Promise<string>}
 */
export function readRequestBody(incomingRequest) {
  return new Promise((resolveBody, rejectBody) => {
    /** @type {Buffer[]} */
    const bodyChunks = [];
    let receivedBytes = 0;
    incomingRequest.on("data", (/** @type {Buffer} */ bodyChunk) => {
      receivedBytes += bodyChunk.length;
      if (receivedBytes > largestRequestBytes) rejectBody(new SourceEditProblem("pictureTooLarge"));
      else bodyChunks.push(bodyChunk);
    });
    incomingRequest.on("end", () => resolveBody(Buffer.concat(bodyChunks).toString("utf8")));
    incomingRequest.on("error", rejectBody);
  });
}

// Vite's CORS answers every localhost page, so an edit is taken only from a page of this dev server.
/** @param {import("node:http").IncomingMessage} incomingRequest */
export function isOwnPageRequest(incomingRequest) {
  const fetchSite = incomingRequest.headers["sec-fetch-site"];
  if (fetchSite !== undefined) return fetchSite === "same-origin";
  try {
    return new URL(incomingRequest.headers.origin ?? "").host === incomingRequest.headers.host;
  } catch {
    return false;
  }
}

// Every field goes into a source file, so each one is checked by type first.
/**
 * @param {Record<string, unknown> | undefined} editRequest
 * @returns {EditRequest}
 */
function checkEditRequest(editRequest) {
  /** @param {unknown} candidateField */
  const isString = (candidateField) => typeof candidateField === "string";
  /**
   * @param {unknown} candidateField
   * @param {(checkedField: unknown) => boolean} isValidField
   */
  const isMissingOr = (candidateField, isValidField) => candidateField === undefined || isValidField(candidateField);
  /** @param {unknown} candidateField */
  const isColumnNumber = (candidateField) => typeof candidateField === "number" && Number.isInteger(candidateField) && candidateField >= 1;
  const editKind = editRequest?.editKind;
  const isWellFormed =
    isString(editRequest?.sourceLocation) &&
    isMissingOr(editRequest?.sourceVersion, isString) &&
    ((editKind === "text" && isString(editRequest?.typedText)) ||
      (editKind === "picture" && isString(editRequest?.pictureName) && isString(editRequest?.pictureContent)) ||
      (editKind === "box" &&
        isMissingOr(editRequest?.columnNumber, isColumnNumber) &&
        isMissingOr(editRequest?.anchorLocation, isString) &&
        isMissingOr(editRequest?.anchorSide, (candidateField) => anchorSides.has(candidateField))));
  if (!isWellFormed) throw new SourceEditProblem("wrongRequest");
  return /** @type {EditRequest} */ (/** @type {unknown} */ (editRequest));
}

/** @param {string} requestBody */
export function parseEditRequest(requestBody) {
  try {
    return checkEditRequest(JSON.parse(requestBody));
  } catch (parseError) {
    throw parseError instanceof SourceEditProblem ? parseError : new SourceEditProblem("wrongRequest");
  }
}

// "slides/intro.tsx:42:7" → a slide file of the site. A link inside the project may lead out of it, so the real path decides.
