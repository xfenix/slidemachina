import type { IncomingMessage } from "node:http";
import { SourceEditProblem } from "./source-rewriting.ts";
import type { MemeKind } from "../../shared-between-runtimes/meme-template.ts";
import type { SlideAction } from "./source-rewriting.ts";

export type EditRequest = { sourceLocation: string, sourceVersion?: string } & (
  | { editKind: "text", typedText: string }
  | { editKind: "picture", pictureName: string, pictureContent: string }
  | { editKind: "box", columnNumber?: number, anchorLocation?: string, anchorSide?: "before" | "after" }
  | { editKind: "meme", memeKind: MemeKind, memeValue: string, storesLocally: boolean }
  | { editKind: "slide", slideAction: SlideAction }
);

export const largestPictureBytes = 80 * 1024 * 1024;
// base64 makes a file a third larger; the rest is room for the other fields of the JSON.
const largestRequestBytes = Math.ceil((largestPictureBytes * 4) / 3) + 1024 * 1024;
const anchorSides = new Set<unknown>(["before", "after"]);
const memeKinds = new Set<unknown>(["template", "clip", "link"]);
const slideActions = new Set<unknown>(["add", "duplicate", "earlier", "later", "remove"]);

export function readRequestBody(incomingRequest: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const bodyChunks: Buffer[] = [];
    let receivedBytes = 0;
    incomingRequest.on("data", (bodyChunk: Buffer) => {
      receivedBytes += bodyChunk.length;
      if (receivedBytes > largestRequestBytes) rejectBody(new SourceEditProblem("pictureTooLarge"));
      else bodyChunks.push(bodyChunk);
    });
    incomingRequest.on("end", () => resolveBody(Buffer.concat(bodyChunks).toString("utf8")));
    incomingRequest.on("error", rejectBody);
  });
}

// Vite's CORS answers every localhost page, so an edit is taken only from a page of this dev server.
export function isOwnPageRequest(incomingRequest: IncomingMessage): boolean {
  const fetchSite = incomingRequest.headers["sec-fetch-site"];
  if (fetchSite !== undefined) return fetchSite === "same-origin";
  try {
    return new URL(incomingRequest.headers.origin ?? "").host === incomingRequest.headers.host;
  } catch {
    return false;
  }
}

// Every field goes into a source file, so each one is checked by type first.
function checkEditRequest(parsedBody: unknown): EditRequest {
  const editRequest: Record<string, unknown> = typeof parsedBody === "object" && parsedBody !== null ? { ...parsedBody } : {};
  const isString = (candidateField: unknown) => typeof candidateField === "string";
  const isMissingOr = (candidateField: unknown, isValidField: (checkedField: unknown) => boolean) =>
    candidateField === undefined || isValidField(candidateField);
  const isColumnNumber = (candidateField: unknown) => typeof candidateField === "number" && Number.isInteger(candidateField) && candidateField >= 1;
  const editKind = editRequest.editKind;
  const isWellFormed =
    isString(editRequest.sourceLocation) &&
    isMissingOr(editRequest.sourceVersion, isString) &&
    ((editKind === "text" && isString(editRequest.typedText)) ||
      (editKind === "picture" && isString(editRequest.pictureName) && isString(editRequest.pictureContent)) ||
      (editKind === "box" &&
        isMissingOr(editRequest.columnNumber, isColumnNumber) &&
        isMissingOr(editRequest.anchorLocation, isString) &&
        isMissingOr(editRequest.anchorSide, (candidateField) => anchorSides.has(candidateField))) ||
      (editKind === "meme" && memeKinds.has(editRequest.memeKind) && isString(editRequest.memeValue) && typeof editRequest.storesLocally === "boolean") ||
      (editKind === "slide" && slideActions.has(editRequest.slideAction)));
  if (!isWellFormed) throw new SourceEditProblem("wrongRequest");
  return editRequest as EditRequest;
}

export function parseEditRequest(requestBody: string): EditRequest {
  try {
    return checkEditRequest(JSON.parse(requestBody));
  } catch (parseError) {
    throw parseError instanceof SourceEditProblem ? parseError : new SourceEditProblem("wrongRequest");
  }
}
