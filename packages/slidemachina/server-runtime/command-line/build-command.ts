import { mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { styleText } from "node:util";
import { intro, log, outro } from "@clack/prompts";
import { askBuildVariant, askPageSecret, pickFlaggedVariants } from "./build-choice.ts";
import type { BuildFlags, BuildVariant } from "./build-choice.ts";
import { commandLineLanguage, commandLineTexts } from "./command-line-texts.ts";
import { buildPresentation, namePresentationOutputs, reportBuild } from "../presentation-build/presentation-build.ts";
import { isInsideFolder } from "../presentation-repository/presentation-repository.ts";
import { buildRepository } from "../presentation-repository/repository-build.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

// staticrypt warns below this length; the build passes --short, so it repeats the warning itself.
const shortestSafeSecretLength = 14;

async function choosePageSecret(isInteractive: boolean): Promise<string> {
  const givenSecret = process.env.SLIDEMACHINA_PASSWORD;
  if (givenSecret) return givenSecret;
  if (isInteractive) return askPageSecret();
  throw new Error(commandLineTexts.missingPassword);
}

export async function runBuildCommand(siteLayout: SiteLayout, commandOptions: BuildFlags): Promise<void> {
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
  const buildContext = { isInteractive, pageSecret, printsHidden: commandOptions.hidden === true };

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
function prepareOutputFolder(siteLayout: SiteLayout, requestedOutput: string | undefined): string {
  const requestedFolder = path.resolve(requestedOutput ?? path.join(siteLayout.rootFolder, "dist"));
  mkdirSync(requestedFolder, { recursive: true });
  const outputFolder = realpathSync(requestedFolder);
  const coversSources = outputFolder === siteLayout.rootFolder || isInsideFolder(outputFolder, siteLayout.rootFolder);
  if (coversSources) throw new Error(commandLineTexts.outputOverSources(requestedFolder));
  return outputFolder;
}

// Every presentation of a repository opens from <folder>/index.html, so only one variant may take that name.
function checkRepositoryVariants(chosenVariants: BuildVariant[]): void {
  const pageVariants = chosenVariants.filter((variantName) => ["html", "protected", "folder"].includes(variantName));
  if (pageVariants.length > 1) throw new Error(commandLineTexts.repositoryPageConflict);
}
