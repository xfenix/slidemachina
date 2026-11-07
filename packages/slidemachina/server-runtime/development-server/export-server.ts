import { createReadStream, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { presentationExportEndpoint, presentationExportStatusEndpoint } from "../../shared-between-runtimes/engine-constants.ts";
import { isOwnPageRequest } from "./edit-request-checks.ts";
import { listPresentationFolders } from "../presentation-repository/presentation-repository.ts";
import { shareChrome } from "../presentation-build/chrome-sharing.ts";
import { buildPresentation, namePresentationOutputs } from "../presentation-build/presentation-build.ts";
import type { ExportStatusAnswer, ExportedFileVariant } from "../../shared-between-runtimes/engine-constants.ts";
import type { BuildReport } from "../presentation-build/image-compression.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";
import type { Connect, Logger, Plugin } from "vite";

type ExportVariant = ExportedFileVariant;
type RunningExport = { variant: ExportVariant };
type FinishedExport = { variant: ExportVariant; succeeded: boolean; finishedAt: number };

const exportedFileTypes: Record<ExportVariant, string> = {
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const exportVariantNames = new Set<string>(Object.keys(exportedFileTypes));
const asciiFileNamePattern = /^[\x20-\x7e]+$/;
const methodNotAllowedStatus = 405;
const foreignOriginStatus = 403;
const rejectedExportStatus = 422;
const failedExportStatus = 500;
const successStatus = 200;

// The toolbar export is the build command behind one button: the same variants, built into a temp folder and sent as a download.
// A dev-server plugin, like the edit endpoint: a middleware added after createServer would stand behind Vite's own 404 answer.
export function createPresentationExportPlugin(siteLayout: SiteLayout): Plugin {
  return {
    name: "slidemachina-export-endpoint",
    configureServer(developmentServer) {
      installPresentationExport(developmentServer.middlewares, siteLayout, developmentServer.config.logger);
    },
  };
}

function installPresentationExport(serverMiddlewares: Connect.Server, siteLayout: SiteLayout, buildLogger: Logger): void {
  let exportQueue: Promise<void> = Promise.resolve();
  let runningExport: RunningExport | undefined;
  let finishedExport: FinishedExport | undefined;
  serverMiddlewares.use(presentationExportEndpoint, (incomingRequest, serverResponse) => {
    const sendProblem = (statusCode: number, problemCode: string) => {
      serverResponse.statusCode = statusCode;
      serverResponse.setHeader("Content-Type", "application/json");
      serverResponse.end(JSON.stringify({ problemCode }));
    };
    const requestedAddress = new URL(incomingRequest.url ?? "", "http://localhost");
    const requestedVariant = requestedAddress.searchParams.get("variant") ?? "";
    const presentationPath = requestedAddress.searchParams.get("presentation") ?? "";
    if (incomingRequest.method !== "GET") return sendProblem(methodNotAllowedStatus, "wrongRequest");
    if (!isOwnPageRequest(incomingRequest)) return sendProblem(foreignOriginStatus, "wrongRequest");
    if (!exportVariantNames.has(requestedVariant)) return sendProblem(rejectedExportStatus, "wrongRequest");
    const exportVariant = requestedVariant as ExportVariant;
    const exportLayout = describeExportLayout(siteLayout, presentationPath);
    if (exportLayout === undefined) return sendProblem(rejectedExportStatus, "unknownPresentation");
    // One export at a time: every variant builds the whole presentation and drives Chrome for it.
    exportQueue = exportQueue.catch(() => undefined).then(async () => {
      const temporaryFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-export-"));
      const sharedChrome = shareChrome();
      let exportSucceeded = false;
      runningExport = { variant: exportVariant };
      try {
        const outputPaths = namePresentationOutputs(temporaryFolder, path.basename(exportLayout.rootFolder));
        const buildReport: BuildReport = { savedPictureBytes: new Map(), videoSizes: new Map() };
        await buildPresentation(exportLayout, [exportVariant], outputPaths, {
          isInteractive: false,
          pageSecret: undefined,
          printsHidden: true,
          sharedChrome,
          buildReport,
        });
        const exportedFilePath = outputPaths[exportVariant];
        serverResponse.statusCode = successStatus;
        serverResponse.setHeader("Content-Type", exportedFileTypes[exportVariant]);
        serverResponse.setHeader("Content-Disposition", `attachment; ${describeDispositionFilename(path.basename(exportedFilePath))}`);
        await pipeline(createReadStream(exportedFilePath), serverResponse);
        exportSucceeded = true;
      } catch (exportError) {
        buildLogger.error(exportError instanceof Error ? String(exportError.stack ?? exportError) : String(exportError));
        if (!serverResponse.headersSent) sendProblem(failedExportStatus, "exportFailed");
        else serverResponse.end();
      } finally {
        await sharedChrome.closeChrome();
        rmSync(temporaryFolder, { recursive: true, force: true });
        runningExport = undefined;
        finishedExport = { variant: exportVariant, succeeded: exportSucceeded, finishedAt: Date.now() };
      }
    });
  });
  // The page polls it to move the export button from "building" to "done".
  serverMiddlewares.use(presentationExportStatusEndpoint, (incomingRequest, serverResponse) => {
    const sendProblem = (statusCode: number, problemCode: string) => {
      serverResponse.statusCode = statusCode;
      serverResponse.setHeader("Content-Type", "application/json");
      serverResponse.end(JSON.stringify({ problemCode }));
    };
    if (incomingRequest.method !== "GET") return sendProblem(methodNotAllowedStatus, "wrongRequest");
    if (!isOwnPageRequest(incomingRequest)) return sendProblem(foreignOriginStatus, "wrongRequest");
    const statusAnswer: ExportStatusAnswer = { runningVariant: runningExport?.variant ?? null, finished: finishedExport ?? null };
    serverResponse.statusCode = successStatus;
    serverResponse.setHeader("Content-Type", "application/json");
    serverResponse.end(JSON.stringify(statusAnswer));
  });
}

// A repository presentation builds from its own folder, like the dist build, and keeps the back-to-list link.
function describeExportLayout(siteLayout: SiteLayout, presentationPath: string): SiteLayout | undefined {
  if (!siteLayout.isRepository) return siteLayout;
  const folderName = decodeURIComponent(presentationPath).split("/").filter(Boolean)[0] ?? "";
  const presentationFolder = listPresentationFolders(siteLayout.rootFolder).find((candidateFolder) => path.basename(candidateFolder) === folderName);
  return presentationFolder === undefined
    ? undefined
    : { rootFolder: presentationFolder, isRepository: false, themeStylesheet: siteLayout.themeStylesheet, listAddress: "../index.html" };
}

// RFC 5987: a plain ASCII name goes quoted, anything else goes percent-encoded.
function describeDispositionFilename(exportedFileName: string): string {
  if (asciiFileNamePattern.test(exportedFileName) && !exportedFileName.includes('"')) return `filename="${exportedFileName}"`;
  return `filename*=UTF-8''${encodeURIComponent(exportedFileName)}`;
}
