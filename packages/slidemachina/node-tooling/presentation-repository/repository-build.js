import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { styleText } from "node:util";
import { log } from "@clack/prompts";
import { build } from "vite";
import { commandLineTexts } from "../command-line/command-line-texts.js";
import { createCoverCamera } from "../presentation-build/cover-shooting.js";
import { buildPresentation, removeOldOutput, reportBuild, reportBuiltOutput, runBuildStep } from "../presentation-build/presentation-build.js";
import { readPresentationCards } from "./presentation-list-page.js";
import { createListBuildConfiguration } from "../development-server/vite-configuration.js";

/** @typedef {import("../command-line/build-choice.js").BuildVariant} BuildVariant */

/** @type {BuildVariant[]} */
const pageVariantNames = ["html", "protected", "folder"];
/** @type {("pdf" | "pdf-steps" | "zip")[]} */
const downloadVariantNames = ["pdf", "pdf-steps", "zip"];
const coverFileName = "cover.webp";

// <folder>/index.html opens the presentation, downloads and the cover lie next to it: dist/ goes to a server as it is.
/**
 * @param {string} presentationOutput
 * @param {string} folderName
 * @returns {import("../presentation-build/presentation-build.js").OutputPaths}
 */
function nameRepositoryOutputs(presentationOutput, folderName) {
  return {
    html: path.join(presentationOutput, "index.html"),
    protected: path.join(presentationOutput, "index.html"),
    folder: presentationOutput,
    zip: path.join(presentationOutput, `${folderName}.zip`),
    pdf: path.join(presentationOutput, `${folderName}.pdf`),
    "pdf-steps": path.join(presentationOutput, `${folderName}-steps.pdf`),
  };
}

// Links name index.html: they open from a web server and from disk alike.
/**
 * @param {import("./presentation-list-page.js").PresentationCard} presentationCard
 * @param {BuildVariant[]} chosenVariants
 * @param {import("../presentation-build/presentation-build.js").OutputPaths} outputPaths
 * @param {boolean} hasCover
 * @returns {import("./presentation-list-page.js").ListedCard}
 */
function describeBuiltCard(presentationCard, chosenVariants, outputPaths, hasCover) {
  const toListAddress = (/** @type {string} */ outputPath) => `./${encodeURIComponent(presentationCard.folderName)}/${encodeURIComponent(path.basename(outputPath))}`;
  const downloads = downloadVariantNames
    .filter((variantName) => chosenVariants.includes(variantName))
    .map((variantName) => ({ variantName, downloadAddress: toListAddress(outputPaths[variantName]) }));
  const opensPage = chosenVariants.some((variantName) => pageVariantNames.includes(variantName));
  return {
    ...presentationCard,
    pageAddress: opensPage ? toListAddress(outputPaths.html) : downloads[0].downloadAddress,
    isProtected: chosenVariants.includes("protected"),
    coverKind: hasCover ? "picture" : "none",
    coverAddress: toListAddress(coverFileName),
    downloads,
  };
}

/**
 * @param {import("./presentation-repository.js").SiteLayout} siteLayout
 * @param {import("./presentation-list-page.js").ListedCard[]} builtCards
 * @param {string} outputFolder
 */
async function buildListPage(siteLayout, builtCards, outputFolder) {
  const listFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-list-"));
  try {
    await build(createListBuildConfiguration(siteLayout, listFolder, builtCards));
    removeOldOutput(path.join(outputFolder, "assets"));
    cpSync(listFolder, outputFolder, { recursive: true });
  } finally {
    rmSync(listFolder, { recursive: true, force: true });
  }
}

// Every presentation gets its own folder in dist/, the list goes to dist/index.html.
/**
 * @param {import("./presentation-repository.js").SiteLayout} siteLayout
 * @param {BuildVariant[]} chosenVariants
 * @param {string} outputFolder
 * @param {Omit<import("../presentation-build/presentation-build.js").BuildContext, "buildReport">} buildContext
 */
export async function buildRepository(siteLayout, chosenVariants, outputFolder, buildContext) {
  const { isInteractive } = buildContext;
  const coverCamera = createCoverCamera();
  // A cover of a protected presentation would show what the password hides: its card keeps only the title.
  let shootsCovers = chosenVariants.some((variantName) => variantName !== "protected");
  /** @type {import("./presentation-list-page.js").ListedCard[]} */
  const builtCards = [];
  try {
    for (const presentationCard of readPresentationCards(siteLayout.rootFolder)) {
      const { folderName } = presentationCard;
      const presentationOutput = path.join(outputFolder, folderName);
      removeOldOutput(presentationOutput);
      mkdirSync(presentationOutput, { recursive: true });
      const outputPaths = nameRepositoryOutputs(presentationOutput, folderName);
      const buildReport = { savedPictureBytes: new Map(), videoSizes: new Map() };
      let hasCover = false;
      /** @type {(builtFolder: string, stepTitle: import("../presentation-build/presentation-build.js").StepTitler) => Promise<void>} */
      const shootCover = async (builtFolder, stepTitle) => {
        if (!shootsCovers) return;
        try {
          const coverPath = path.join(presentationOutput, coverFileName);
          await runBuildStep(stepTitle(commandLineTexts.shootingCover), () => coverCamera.shootCover(builtFolder, coverPath), isInteractive);
          hasCover = true;
        } catch (coverError) {
          const coverProblem = coverError instanceof Error ? coverError.message : String(coverError);
          const isChromeMissing = coverProblem === commandLineTexts.missingChrome;
          if (isChromeMissing) shootsCovers = false;
          log.warn(isChromeMissing ? commandLineTexts.coversWithoutChrome : commandLineTexts.coverFailed(folderName, coverProblem));
        }
      };
      const presentationFolder = path.join(siteLayout.rootFolder, folderName);
      const presentationLayout = { rootFolder: presentationFolder, isRepository: false, themeStylesheet: siteLayout.themeStylesheet, listAddress: "../index.html" };
      await buildPresentation(presentationLayout, chosenVariants, outputPaths, { ...buildContext, buildReport, stepPrefix: folderName }, shootCover);
      reportBuild(chosenVariants, outputPaths, buildReport, false);
      builtCards.push(describeBuiltCard(presentationCard, chosenVariants, outputPaths, hasCover));
    }
  } finally {
    await coverCamera.close();
  }
  await runBuildStep(commandLineTexts.buildingList, () => buildListPage(siteLayout, builtCards, outputFolder), isInteractive);
  const { shownPath } = reportBuiltOutput(path.join(outputFolder, "index.html"));
  log.message(styleText("dim", commandLineTexts.listServingHint(path.dirname(shownPath))));
}
