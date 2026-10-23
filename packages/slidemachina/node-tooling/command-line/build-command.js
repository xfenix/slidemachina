import { mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { styleText } from "node:util";
import { intro, log, outro } from "@clack/prompts";
import { askBuildVariant, askPageSecret, pickFlaggedVariants } from "./build-choice.js";
import { commandLineLanguage, commandLineTexts } from "./command-line-texts.js";
import { buildPresentation, namePresentationOutputs, reportBuild } from "../presentation-build/presentation-build.js";
import { isInsideFolder } from "../presentation-repository/presentation-repository.js";
import { buildRepository } from "../presentation-repository/repository-build.js";

// staticrypt warns below this length; the build passes --short, so it repeats the warning itself.
const shortestSafeSecretLength = 14;

/** @param {boolean} isInteractive */
async function choosePageSecret(isInteractive) {
  const givenSecret = process.env.SLIDEMACHINA_PASSWORD;
  if (givenSecret) return givenSecret;
  if (isInteractive) return askPageSecret();
  throw new Error(commandLineTexts.missingPassword);
}

/**
 * @param {import("../presentation-repository/presentation-repository.js").SiteLayout} siteLayout
 * @param {import("./build-choice.js").BuildFlags} commandOptions
 */
export async function runBuildCommand(siteLayout, commandOptions) {
  const buildStart = performance.now();
  const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  intro(styleText(["bgBlue", "white"], " slidemachina build "));
  const chosenVariants = pickFlaggedVariants(commandOptions);
  if (chosenVariants.length === 0) {
    if (!isInteractive) throw new Error(commandLineTexts.nonInteractiveBuild);
    chosenVariants.push(...(await askBuildVariant()));
  }
  if (siteLayout.isRepository) checkRepositoryVariants(chosenVariants);
  const outputFolder = prepareOutputFolder(siteLayout, commandOptions.out);
  const pageSecret = chosenVariants.includes("protected") ? await choosePageSecret(isInteractive) : undefined;
  if (pageSecret !== undefined && pageSecret.length < shortestSafeSecretLength) log.warn(commandLineTexts.shortSecret);
  const buildContext = { isInteractive, pageSecret };

  if (siteLayout.isRepository) {
    await buildRepository(siteLayout, chosenVariants, outputFolder, buildContext);
  } else {
    const outputPaths = namePresentationOutputs(outputFolder, path.basename(siteLayout.rootFolder));
    const buildReport = { savedPictureBytes: new Map(), videoSizes: new Map() };
    await buildPresentation(siteLayout, chosenVariants, outputPaths, { ...buildContext, buildReport });
    reportBuild(chosenVariants, outputPaths, buildReport);
  }
  const elapsedSeconds = ((performance.now() - buildStart) / 1000).toLocaleString(commandLineLanguage, { maximumFractionDigits: 1 });
  outro(commandLineTexts.buildFinished(elapsedSeconds));
}

// Results replace <out>/<folder>: an output folder that is the sources or holds them would wipe the slides.
/**
 * @param {import("../presentation-repository/presentation-repository.js").SiteLayout} siteLayout
 * @param {string | undefined} requestedOutput
 */
function prepareOutputFolder(siteLayout, requestedOutput) {
  const requestedFolder = path.resolve(requestedOutput ?? path.join(siteLayout.rootFolder, "dist"));
  mkdirSync(requestedFolder, { recursive: true });
  const outputFolder = realpathSync(requestedFolder);
  const coversSources = outputFolder === siteLayout.rootFolder || isInsideFolder(outputFolder, siteLayout.rootFolder);
  if (coversSources) throw new Error(commandLineTexts.outputOverSources(requestedFolder));
  return outputFolder;
}

// Every presentation of a repository opens from <folder>/index.html, so only one variant may take that name.
/** @param {import("./build-choice.js").BuildVariant[]} chosenVariants */
function checkRepositoryVariants(chosenVariants) {
  const pageVariants = chosenVariants.filter((variantName) => ["html", "protected", "folder"].includes(variantName));
  if (pageVariants.length > 1) throw new Error(commandLineTexts.repositoryPageConflict);
}
