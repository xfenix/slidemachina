import { copyFileSync, cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { styleText } from "node:util";
import { log, spinner } from "@clack/prompts";
import { build } from "vite";
import { commandLineTexts, formatFileSize } from "../command-line/command-line-texts.ts";
import { zipFolder } from "./folder-archive.ts";
import { encryptPage } from "./page-encryption.ts";
import { printPdf } from "./pdf-printing.ts";
import { presentationFileName } from "../presentation-repository/presentation-repository.ts";
import { readPresentationFile } from "../source-transforms/presentation-settings.ts";
import { createBuildConfiguration } from "../development-server/vite-configuration.ts";
import type { BuildVariant } from "../command-line/build-choice.ts";
import type { BuildReport } from "./image-compression.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

export type OutputPaths = Record<BuildVariant, string>;
export type BuildContext = { isInteractive: boolean, pageSecret: string | undefined, buildReport: BuildReport, stepPrefix?: string };
export type StepTitler = (shownTitle: string) => string;

const singleFileVariants = new Set<BuildVariant>(["html", "protected", "pdf", "pdf-steps"]);
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

// Folder and zip come first: in a repository the folder is the presentation's own output folder, other files go into it after.
export async function buildPresentation(
  presentationLayout: SiteLayout,
  chosenVariants: BuildVariant[],
  outputPaths: OutputPaths,
  buildContext: BuildContext,
  processBuiltPage?: (builtFolder: string, stepTitle: StepTitler) => Promise<void>,
): Promise<void> {
  const { buildReport, isInteractive, pageSecret, stepPrefix } = buildContext;
  const projectFolder = presentationLayout.rootFolder;
  const nameStepTitle: StepTitler = (shownTitle) => (stepPrefix === undefined ? shownTitle : `${stepPrefix} · ${shownTitle}`);
  const temporaryFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-build-"));
  const builtPages: string[] = [];
  try {
    if (chosenVariants.includes("folder") || chosenVariants.includes("zip")) {
      const folderBuild = path.join(temporaryFolder, "folder");
      await runBuildStep(
        nameStepTitle(commandLineTexts.buildingFiles(false)),
        () => build(createBuildConfiguration(presentationLayout, folderBuild, false, buildReport)),
        isInteractive,
      );
      if (chosenVariants.includes("folder")) {
        removeOldOutput(outputPaths.folder);
        cpSync(folderBuild, outputPaths.folder, { recursive: true });
      }
      if (chosenVariants.includes("zip")) zipFolder(folderBuild, outputPaths.zip);
      builtPages.push(folderBuild);
    }
    if (chosenVariants.some((variantName) => singleFileVariants.has(variantName))) {
      const singleFileFolder = path.join(temporaryFolder, "single-file");
      await runBuildStep(
        nameStepTitle(commandLineTexts.buildingFiles(true)),
        () => build(createBuildConfiguration(presentationLayout, singleFileFolder, true, buildReport)),
        isInteractive,
      );
      const builtPage = path.join(singleFileFolder, "index.html");
      if (chosenVariants.includes("html")) copyFileSync(builtPage, outputPaths.html);
      if (pageSecret !== undefined) {
        const presentationTitle = readPresentationFile(projectFolder).presentationTitle ?? path.basename(projectFolder);
        await runBuildStep(
          nameStepTitle(commandLineTexts.encryptingFile),
          () => encryptPage(builtPage, outputPaths.protected, pageSecret, presentationTitle),
          isInteractive,
        );
      }
      for (const pdfVariant of pdfVariantNames.filter((variantName) => chosenVariants.includes(variantName))) {
        const printsSteps = pdfVariant === "pdf-steps";
        await runBuildStep(
          nameStepTitle(commandLineTexts.printingPdf(printsSteps)),
          () => printPdf(builtPage, outputPaths[pdfVariant], printsSteps),
          isInteractive,
        );
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
  };
}
