import { copyFileSync, cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { styleText } from "node:util";
import { log, spinner } from "@clack/prompts";
import { build } from "vite";
import { commandLineTexts, formatFileSize } from "./command-line-texts.js";
import { zipFolder } from "./folder-archive.js";
import { encryptPage } from "./page-encryption.js";
import { printPdf } from "./pdf-printing.js";
import { presentationFileName } from "./presentation-repository.js";
import { readPresentationFile } from "./presentation-settings.js";
import { createBuildConfiguration } from "./vite-configuration.js";

/** @typedef {import("./build-choice.js").BuildVariant} BuildVariant */
/** @typedef {Record<BuildVariant, string>} OutputPaths */
/** @typedef {{ isInteractive: boolean, pageSecret: string | undefined, buildReport: import("./image-compression.js").BuildReport, stepPrefix?: string }} BuildContext */
/** @typedef {(shownTitle: string) => string} StepTitler */

/** @type {Set<BuildVariant>} */
const singleFileVariants = new Set(["html", "protected", "pdf", "pdf-steps"]);
/** @type {BuildVariant[]} */
const pdfVariantNames = ["pdf", "pdf-steps"];
const largeFileLimit = 50 * 1024 * 1024;

/**
 * @template StepOutcome
 * @param {string} stepTitle
 * @param {() => StepOutcome | Promise<StepOutcome>} buildStepWork
 * @param {boolean} isInteractive
 * @returns {Promise<StepOutcome>}
 */
export async function runBuildStep(stepTitle, buildStepWork, isInteractive) {
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

/** @param {string} outputPath */
function measureOutput(outputPath) {
  if (!statSync(outputPath).isDirectory()) return statSync(outputPath).size;
  return readdirSync(outputPath, { recursive: true, withFileTypes: true })
    .filter((folderEntry) => folderEntry.isFile())
    .reduce((folderSize, folderEntry) => folderSize + statSync(path.join(folderEntry.parentPath, folderEntry.name)).size, 0);
}

/** @param {Map<string, number>} numbersByKey */
function sumMapValues(numbersByKey) {
  return [...numbersByKey.values()].reduce((valueTotal, mapValue) => valueTotal + mapValue, 0);
}

// A build never writes index.tsx, so a folder holding one is sources: the build stops instead of wiping it.
/** @param {string} outputPath */
export function removeOldOutput(outputPath) {
  if (!existsSync(outputPath)) return;
  const holdsSources = readdirSync(outputPath, { recursive: true }).some((entryPath) => path.basename(String(entryPath)) === presentationFileName);
  if (holdsSources) throw new Error(commandLineTexts.outputHoldsSources(outputPath));
  rmSync(outputPath, { recursive: true, force: true });
}

// One line of the summary: the path from the current folder and the size.
/** @param {string} outputPath */
export function reportBuiltOutput(outputPath) {
  const outputSize = measureOutput(outputPath);
  const relativePath = path.relative(process.cwd(), outputPath);
  const shownPath = relativePath.startsWith("..") ? outputPath : relativePath;
  log.success(commandLineTexts.builtOutput(styleText("bold", shownPath), styleText("dim", formatFileSize(outputSize))));
  return { shownPath, outputSize };
}

// A repository prints the hint about serving folders once, after all presentations.
/**
 * @param {BuildVariant[]} chosenVariants
 * @param {OutputPaths} outputPaths
 * @param {import("./image-compression.js").BuildReport} buildReport
 */
export function reportBuild(chosenVariants, outputPaths, buildReport, showsServingHint = true) {
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
/**
 * @param {import("./presentation-repository.js").SiteLayout} presentationLayout
 * @param {BuildVariant[]} chosenVariants
 * @param {OutputPaths} outputPaths
 * @param {BuildContext} buildContext
 * @param {(builtFolder: string, stepTitle: StepTitler) => Promise<void>} [useBuiltPage]
 */
export async function buildPresentation(presentationLayout, chosenVariants, outputPaths, buildContext, useBuiltPage) {
  const { buildReport, isInteractive, pageSecret, stepPrefix } = buildContext;
  const projectFolder = presentationLayout.rootFolder;
  /** @type {StepTitler} */
  const stepTitle = (shownTitle) => (stepPrefix === undefined ? shownTitle : `${stepPrefix} · ${shownTitle}`);
  const temporaryFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-build-"));
  /** @type {string[]} */
  const builtPages = [];
  try {
    if (chosenVariants.includes("folder") || chosenVariants.includes("zip")) {
      const folderBuild = path.join(temporaryFolder, "folder");
      await runBuildStep(
        stepTitle(commandLineTexts.buildingFiles(false)),
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
        stepTitle(commandLineTexts.buildingFiles(true)),
        () => build(createBuildConfiguration(presentationLayout, singleFileFolder, true, buildReport)),
        isInteractive,
      );
      const builtPage = path.join(singleFileFolder, "index.html");
      if (chosenVariants.includes("html")) copyFileSync(builtPage, outputPaths.html);
      if (pageSecret !== undefined) {
        const presentationTitle = readPresentationFile(projectFolder).presentationTitle ?? path.basename(projectFolder);
        await runBuildStep(
          stepTitle(commandLineTexts.encryptingFile),
          () => encryptPage(builtPage, outputPaths.protected, pageSecret, presentationTitle),
          isInteractive,
        );
      }
      for (const pdfVariant of pdfVariantNames.filter((variantName) => chosenVariants.includes(variantName))) {
        const printsSteps = pdfVariant === "pdf-steps";
        await runBuildStep(
          stepTitle(commandLineTexts.printingPdf(printsSteps)),
          () => printPdf(builtPage, outputPaths[pdfVariant], printsSteps),
          isInteractive,
        );
      }
      builtPages.push(singleFileFolder);
    }
    if (useBuiltPage !== undefined) await useBuiltPage(builtPages[0], stepTitle);
  } finally {
    rmSync(temporaryFolder, { recursive: true, force: true });
  }
}

/**
 * @param {string} outputFolder
 * @param {string} projectName
 * @returns {OutputPaths}
 */
export function namePresentationOutputs(outputFolder, projectName) {
  return {
    html: path.join(outputFolder, `${projectName}.html`),
    protected: path.join(outputFolder, `${projectName}-protected.html`),
    folder: path.join(outputFolder, projectName),
    zip: path.join(outputFolder, `${projectName}.zip`),
    pdf: path.join(outputFolder, `${projectName}.pdf`),
    "pdf-steps": path.join(outputFolder, `${projectName}-steps.pdf`),
  };
}

