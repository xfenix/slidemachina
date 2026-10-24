import type { SourceEditProblemCode } from "./editor-texts.ts";
import { sourceEditEndpoint } from "../../shared-between-runtimes/engine-constants.js";

const longestUpdateWait = 4000;

declare global {
  interface Window {
    // Set by every slide module in slidemachina dev: which version of the file the page was built from.
    slidemachinaSourceVersions?: Record<string, string>;
  }
}

export type SourceEditRequest =
  | { editKind: "text"; sourceLocation: string; typedText: string }
  | { editKind: "picture"; sourceLocation: string; pictureName: string; pictureContent: string }
  | { editKind: "box"; sourceLocation: string; columnNumber?: number; anchorLocation?: string; anchorSide?: "before" | "after" };

export class SourceEditFailure extends Error {
  constructor(readonly problemCode: SourceEditProblemCode) {
    super(problemCode);
  }
}

export function readSourceFile(sourceLocation: string) {
  return sourceLocation.replace(/:\d+:\d+$/, "");
}

// The written file comes back as a hot update; the edit is done when the page runs the new version of the module.
function waitForSourceUpdate(sourceFile: string, previousVersion: string | undefined) {
  const waitStart = performance.now();
  return new Promise<void>((resolveUpdate) => {
    const checkVersion = () => {
      const isUpdated = window.slidemachinaSourceVersions?.[sourceFile] !== previousVersion;
      if (isUpdated || performance.now() - waitStart > longestUpdateWait) resolveUpdate();
      else requestAnimationFrame(checkVersion);
    };
    checkVersion();
  });
}

let editQueue: Promise<unknown> = Promise.resolve();

// One edit at a time: the next one leaves after the page runs the file the previous one wrote, so it sends that version.
export function sendSourceEdit(editRequest: SourceEditRequest) {
  const queuedEdit = editQueue.then(() => sendQueuedEdit(editRequest));
  editQueue = queuedEdit.catch(() => {});
  return queuedEdit;
}

async function sendQueuedEdit(editRequest: SourceEditRequest) {
  const sourceFile = readSourceFile(editRequest.sourceLocation);
  const sourceVersion = window.slidemachinaSourceVersions?.[sourceFile];
  const editResponse = await fetch(sourceEditEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...editRequest, sourceVersion }),
  }).catch(() => {
    throw new SourceEditFailure("serverUnreachable");
  });
  if (!editResponse.ok) {
    const problemAnswer = (await editResponse.json().catch(() => ({}))) as { problemCode?: SourceEditProblemCode };
    throw new SourceEditFailure(problemAnswer.problemCode ?? "writeFailed");
  }
  await waitForSourceUpdate(sourceFile, sourceVersion);
}

export function readFileContent(pictureFile: File) {
  return new Promise<string>((resolveContent, rejectContent) => {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const dataAddress = String(fileReader.result);
      resolveContent(dataAddress.slice(dataAddress.indexOf(",") + 1));
    };
    fileReader.onerror = () => rejectContent(fileReader.error);
    fileReader.readAsDataURL(pictureFile);
  });
}
