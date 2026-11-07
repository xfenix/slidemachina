import { copyFileSync, cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { styleText } from "node:util";
import { log, spinner } from "@clack/prompts";
import { build } from "vite";
import { commandLineTexts, formatFileSize } from "../command-line/command-line-texts.ts";
import { zipFolder } from "./folder-archive.ts";
import { createBuildCache } from "./build-cache.ts";
import { presentationFileName } from "../presentation-repository/presentation-repository.ts";
import { readPresentationFile } from "../source-transforms/presentation-settings.ts";
import { createBuildConfiguration } from "../development-server/vite-configuration.ts";
import type { BuildVariant } from "../command-line/build-choice.ts";
import type { BuildReport } from "./image-compression.ts";
import type { SharedChrome } from "./chrome-sharing.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

export type OutputPaths = Record<BuildVariant, string>;
export type BuildContext = { isInteractive: boolean, pageSecret: string | undefined, printsHidden: boolean, sharedChrome: SharedChrome, buildReport: BuildReport, stepPrefix?: string };
export type StepTitler = (shownTitle: string) => string;
// A step may leave a message for after the spinner, such as why the Quick Look pictures are missing.
type ChromeStep = { stepTitle: string; stepWork: () => Promise<(() => void) | void> };

const singleFileVariants = new Set<BuildVariant>(["html", "protected", "pdf", "pdf-steps", "pptx", "hyperframes"]);
const pdfVariantNames: BuildVariant[] = ["pdf", "pdf-steps"];
const largeFileLimit = 50 * 1024 * 1024;

export async function runBuildStep<StepOutcome>(stepTitle: string, buildStepWork: () => StepOutcome | Promise<StepOutcome>, isInteractive: boolean): Promise<StepOutcome> {
  if (!isInteractive) {
    log.step(stepTitle);
    return buildStepWork();
  }
  const stepSpinner = spinner();
  stepSpinner.start(stepTitle);
  try {
    const stepResult = await buildStepWork();
    stepSpinner.stop(stepTitle);
    return stepResult;
  } catch (stepError) {
    stepSpinner.error(stepTitle);
    throw stepError;
  }
}

function measureOutput(outputPath: string): number {
  if (!statSync(outputPath).isDirectory()) return statSync(outputPath).size;
  return readdirSync(outputPath, { recursive: true, withFileTypes: true })
    .filter((folderEntry) => folderEntry.isFile())
    .reduce((folderSize, folderEntry) => folderSize + statSync(path.join(folderEntry.parentPath, folderEntry.name)).size, 0);
}

function sumMapValues(numbersByKey: Map<string, number>): number {
  return [...numbersByKey.values()].reduce((valueTotal, mapValue) => valueTotal + mapValue, 0);
}

// A build never writes index.tsx, so a folder holding one is sources: the build stops instead of wiping it.
export function removeOldOutput(outputPath: string): void {
  if (!existsSync(outputPath)) return;
  const holdsSources = readdirSync(outputPath, { recursive: true }).some((entryPath) => path.basename(String(entryPath)) === presentationFileName);
  if (holdsSources) throw new Error(commandLineTexts.outputHoldsSources(outputPath));
  rmSync(outputPath, { recursive: true, force: true });
}

// One line of the summary: the path from the current folder and the size.
export function reportBuiltOutput(outputPath: string): { shownPath: string, outputSize: number } {
  const outputSize = measureOutput(outputPath);
  const relativePath = path.relative(process.cwd(), outputPath);
  const shownPath = relativePath.startsWith("..") ? outputPath : relativePath;
  log.success(commandLineTexts.builtOutput(styleText("bold", shownPath), styleText("dim", formatFileSize(outputSize))));
  return { shownPath, outputSize };
}

// A repository prints the hint about serving folders once, after all presentations.
export function reportBuild(chosenVariants: BuildVariant[], outputPaths: OutputPaths, buildReport: BuildReport, showsServingHint = true): void {
  if (buildReport.savedPictureBytes.size > 0) {
    log.info(commandLineTexts.compressedPictures(buildReport.savedPictureBytes.size, formatFileSize(sumMapValues(buildReport.savedPictureBytes))));
  }
  for (const [videoPath, videoSize] of buildReport.videoSizes) {
    log.info(commandLineTexts.keptVideo(path.basename(videoPath), formatFileSize(videoSize)));
  }
  for (const variantName of chosenVariants) {
    const outputPath = outputPaths[variantName];
    const { shownPath, outputSize } = reportBuiltOutput(outputPath);
    const isSingleHtmlFile = variantName === "html" || variantName === "protected";
    if (isSingleHtmlFile && outputSize > largeFileLimit) {
      log.warn(commandLineTexts.largeSingleFile(path.basename(outputPath), formatFileSize(outputSize)));
    }
    if (variantName === "folder" && showsServingHint) log.message(styleText("dim", commandLineTexts.folderServingHint(shownPath)));
  }
}

// The pictures never stop the build: a missing Chrome or a too big file only leaves a message.
async function shootPreviewQuietly(builtPage: string, htmlPath: string, sharedChrome: SharedChrome, printedPdfPath?: string): Promise<(() => void) | void> {
  try {
    const { addScriptFreePreview, quickLookSizeLimit } = await import("./script-free-preview.ts");
    const hasPreview = await addScriptFreePreview(builtPage, htmlPath, sharedChrome, printedPdfPath);
    if (!hasPreview) return () => log.info(commandLineTexts.previewTooLarge(formatFileSize(quickLookSizeLimit)));
  } catch (previewError) {
    // The shared tab never came: the PDF prints on its own, as it does without the html variant.
    if (printedPdfPath !== undefined) {
      try {
        await (await import("./pdf-printing.ts")).printPdf(builtPage, printedPdfPath, { printsSteps: false, printsHidden: true }, sharedChrome);
      } catch {
        // The preview problem below says why the build has no pictures; a failed PDF rescue adds nothing.
      }
    }
    const previewProblem = previewError instanceof Error ? previewError.message : String(previewError);
    return () => log.warn(previewProblem === commandLineTexts.missingChrome ? commandLineTexts.previewWithoutChrome : commandLineTexts.previewFailed(previewProblem));
  }
}

// The plain PDF wants the same print view as the Quick Look pictures: one step prints it from a picture tab instead of loading the page again.
function listChromeSteps(chosenVariants: BuildVariant[], builtPage: string, outputPaths: OutputPaths, printsHidden: boolean, sharedChrome: SharedChrome): ChromeStep[] {
  const printsPdfFromPreviewTab = chosenVariants.includes("html") && chosenVariants.includes("pdf") && printsHidden;
  const previewSteps = chosenVariants.includes("html") ? [{ stepTitle: commandLineTexts.shootingPreview, stepWork: () => shootPreviewQuietly(builtPage, outputPaths.html, sharedChrome, printsPdfFromPreviewTab ? outputPaths.pdf : undefined) }] : [];
  const pdfSteps = pdfVariantNames
    .filter((variantName) => chosenVariants.includes(variantName))
    .filter((variantName) => !(variantName === "pdf" && printsPdfFromPreviewTab))
    .map((pdfVariant) => {
      const printsSteps = pdfVariant === "pdf-steps";
      return { stepTitle: commandLineTexts.printingPdf(printsSteps), stepWork: async () => (await import("./pdf-printing.ts")).printPdf(builtPage, outputPaths[pdfVariant], { printsSteps, printsHidden }, sharedChrome) };
    });
  const pptxSteps = chosenVariants.includes("pptx") ? [{ stepTitle: commandLineTexts.exportingPptx, stepWork: async () => (await import("../pptx-export/pptx-export.ts")).exportPptx(builtPage, outputPaths.pptx, printsHidden, sharedChrome) }] : [];
  return [...previewSteps, ...pdfSteps, ...pptxSteps];
}

// The folder output is wiped before the phase and filled after it: in a repository downloads land inside it during the phase.
async function addFolderCoverQuietly(folderBuild: string, sharedChrome: SharedChrome): Promise<(() => void) | void> {
  try {
    await (await import("./folder-cover.ts")).addFolderCover(folderBuild, sharedChrome);
  } catch (coverError) {
    const coverProblem = coverError instanceof Error ? coverError.message : String(coverError);
    return () => log.warn(commandLineTexts.staticCoverFailed(coverProblem));
  }
}

// Every step that reads the built pages in Chrome or encrypts them stands alone: they touch nothing but their own outputs,
// so one shared step runs them side by side on the tabs of one Chrome instead of waiting for each other.
export async function buildPresentation(
  presentationLayout: SiteLayout,
  chosenVariants: BuildVariant[],
  outputPaths: OutputPaths,
  buildContext: BuildContext,
  processBuiltPage?: (builtFolder: string, stepTitle: StepTitler) => Promise<void>,
): Promise<void> {
  const { buildReport, isInteractive, pageSecret, printsHidden, sharedChrome, stepPrefix } = buildContext;
  const projectFolder = presentationLayout.rootFolder;
  const nameStepTitle: StepTitler = (shownTitle) => (stepPrefix === undefined ? shownTitle : `${stepPrefix} · ${shownTitle}`);
  const temporaryFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-build-"));
  const builtPages: string[] = [];
  const buildsFolder = chosenVariants.includes("folder") || chosenVariants.includes("zip");
  const buildsSingleFile = chosenVariants.some((variantName) => singleFileVariants.has(variantName));
  const folderBuild = path.join(temporaryFolder, "folder");
  const singleFileFolder = path.join(temporaryFolder, "single-file");
  const builtPage = path.join(singleFileFolder, "index.html");
  const singleFileChromeSteps = buildsSingleFile ? listChromeSteps(chosenVariants, builtPage, outputPaths, printsHidden, sharedChrome) : [];
  // Chrome launch is a second of mostly waiting: it starts before the bundle and the first tab finds it running.
  const singleFileNeedsChrome = buildsSingleFile && (singleFileChromeSteps.length > 0 || chosenVariants.includes("hyperframes") || pageSecret !== undefined);
  const folderNeedsChrome = buildsFolder && !presentationLayout.isRepository;
  if (singleFileNeedsChrome || folderNeedsChrome) void sharedChrome.openChrome().catch(() => undefined);
  try {
    const buildCache = createBuildCache(presentationLayout, outputPaths);
    const restoredFolderBuild = buildsFolder && buildCache.restoreCachedBuild(folderBuild, false, buildReport);
    const restoredSingleFileBuild = buildsSingleFile && buildCache.restoreCachedBuild(singleFileFolder, true, buildReport);
    // The two builds share nothing but the compressed-picture cache, so they run at the same time.
    const bundleTitles = [buildsFolder && commandLineTexts.buildingFiles(false), buildsSingleFile && commandLineTexts.buildingFiles(true)].filter(
      (bundleTitle): bundleTitle is string => bundleTitle !== false,
    );
    if (bundleTitles.length > 0) {
      await runBuildStep(
        nameStepTitle(bundleTitles.join(" · ")),
        () =>
          Promise.all([
            buildsFolder && !restoredFolderBuild ? build(createBuildConfiguration(presentationLayout, folderBuild, false, buildReport)) : undefined,
            buildsSingleFile && !restoredSingleFileBuild ? build(createBuildConfiguration(presentationLayout, singleFileFolder, true, buildReport)) : undefined,
          ]),
        isInteractive,
      );
      if (buildsSingleFile && !restoredSingleFileBuild) buildCache.saveBuiltOutput(singleFileFolder, true, buildReport);
    }
    if (buildsFolder && chosenVariants.includes("folder")) removeOldOutput(outputPaths.folder);
    const chromeSteps: ChromeStep[] = [];
    if (folderNeedsChrome) chromeSteps.push({ stepTitle: commandLineTexts.staticCoverStep, stepWork: () => addFolderCoverQuietly(folderBuild, sharedChrome) });
    let staticCoverMarkup: string | undefined;
    if (buildsSingleFile) {
      const wantsCover = chosenVariants.includes("html") || pageSecret !== undefined;
      // The protected page is encrypted from the covered file, so there the capture stays ahead of the encryption;
      // with no secret the cover is captured side by side with the other Chrome work.
      const coverWithChromeSteps = wantsCover && pageSecret === undefined && (singleFileChromeSteps.length > 0 || chosenVariants.includes("hyperframes") || folderNeedsChrome);
      const captureCoverQuietly = async (): Promise<(() => void) | void> => {
        try {
          staticCoverMarkup = (await (await import("./static-cover.ts")).captureStaticCover(builtPage, sharedChrome)) ?? undefined;
        } catch (coverError) {
          const coverProblem = coverError instanceof Error ? coverError.message : String(coverError);
          return () => log.warn(commandLineTexts.staticCoverFailed(coverProblem));
        }
      };
      if (wantsCover && !coverWithChromeSteps) {
        const coverReport = await runBuildStep(nameStepTitle(commandLineTexts.staticCoverStep), captureCoverQuietly, isInteractive);
        coverReport?.();
      }
      if (coverWithChromeSteps) chromeSteps.push({ stepTitle: commandLineTexts.staticCoverStep, stepWork: captureCoverQuietly });
      if (pageSecret !== undefined) {
        if (staticCoverMarkup !== undefined) (await import("./static-cover.ts")).injectStaticCover(builtPage, staticCoverMarkup);
        const presentationTitle = readPresentationFile(projectFolder).presentationTitle ?? path.basename(projectFolder);
        chromeSteps.push({
          stepTitle: commandLineTexts.encryptingFile,
          stepWork: async () => (await import("./page-encryption.ts")).encryptPage(builtPage, outputPaths.protected, pageSecret, presentationTitle),
        });
      }
      if (chosenVariants.includes("html")) copyFileSync(builtPage, outputPaths.html);
      if (chosenVariants.includes("hyperframes")) {
        const hyperframesFolder = path.join(temporaryFolder, "hyperframes");
        chromeSteps.push({
          stepTitle: commandLineTexts.exportingHyperframes,
          stepWork: async () => {
            await (await import("./script-free-preview.ts")).exportHyperframes(builtPage, projectFolder, hyperframesFolder, printsHidden, sharedChrome);
            removeOldOutput(outputPaths.hyperframes);
            cpSync(hyperframesFolder, outputPaths.hyperframes, { recursive: true });
          },
        });
      }
      chromeSteps.push(...singleFileChromeSteps);
    }
    if (chromeSteps.length > 0) {
      const stepReports = await runBuildStep(
        nameStepTitle(chromeSteps.map(({ stepTitle }) => stepTitle).join(" · ")),
        () => Promise.all(chromeSteps.map(({ stepWork }) => stepWork())),
        isInteractive,
      );
      for (const stepReport of stepReports) stepReport?.();
    }
    if (buildsFolder) {
      if (!restoredFolderBuild) buildCache.saveBuiltOutput(folderBuild, false, buildReport);
      if (chosenVariants.includes("folder")) cpSync(folderBuild, outputPaths.folder, { recursive: true, preserveTimestamps: true });
      if (chosenVariants.includes("zip")) zipFolder(folderBuild, outputPaths.zip);
      builtPages.push(folderBuild);
    }
    if (buildsSingleFile) {
      if (chosenVariants.includes("html") && staticCoverMarkup !== undefined) {
        const { injectStaticCover } = await import("./static-cover.ts");
        injectStaticCover(outputPaths.html, staticCoverMarkup);
      }
      builtPages.push(singleFileFolder);
    }
    const [firstBuiltPage] = builtPages;
    if (processBuiltPage !== undefined && firstBuiltPage !== undefined) await processBuiltPage(firstBuiltPage, nameStepTitle);
  } finally {
    rmSync(temporaryFolder, { recursive: true, force: true });
  }
}

export function namePresentationOutputs(outputFolder: string, projectName: string): OutputPaths {
  return {
    html: path.join(outputFolder, `${projectName}.html`),
    protected: path.join(outputFolder, `${projectName}-protected.html`),
    folder: path.join(outputFolder, projectName),
    zip: path.join(outputFolder, `${projectName}.zip`),
    pdf: path.join(outputFolder, `${projectName}.pdf`),
    "pdf-steps": path.join(outputFolder, `${projectName}-steps.pdf`),
    pptx: path.join(outputFolder, `${projectName}.pptx`),
    hyperframes: path.join(outputFolder, `${projectName}-hyperframes`),
  };
}
