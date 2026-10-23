import { styleText } from "node:util";
import { cancel, isCancel, password, select } from "@clack/prompts";
import { commandLineTexts } from "./command-line-texts.js";

/** @typedef {"html" | "protected" | "folder" | "zip" | "pdf" | "pdf-steps"} BuildVariant */
/** @typedef {{ html?: boolean, protected?: boolean, folder?: boolean, zip?: boolean, pdf?: boolean, steps?: boolean, out?: string }} BuildFlags */

/** @type {BuildVariant[]} */
const buildVariantNames = ["html", "protected", "folder", "zip", "pdf", "pdf-steps"];
const fileVariantNames = /** @type {const} */ (["html", "protected", "folder", "zip"]);

// Flags combine for CI: --html --pdf builds both; --steps alone means a PDF by steps.
/**
 * @param {BuildFlags} commandOptions
 * @returns {BuildVariant[]}
 */
export function pickFlaggedVariants(commandOptions) {
  /** @type {BuildVariant[]} */
  const flaggedVariants = fileVariantNames.filter((variantName) => commandOptions[variantName]);
  if (commandOptions.pdf || commandOptions.steps) flaggedVariants.push(commandOptions.steps ? "pdf-steps" : "pdf");
  return flaggedVariants;
}

/**
 * @template AnswerType
 * @param {AnswerType} promptAnswer
 * @returns {Exclude<AnswerType, symbol>}
 */
function stopWhenCancelled(promptAnswer) {
  if (!isCancel(promptAnswer)) return /** @type {Exclude<AnswerType, symbol>} */ (promptAnswer);
  cancel(commandLineTexts.buildCancelled);
  process.exit(0);
}

export async function askBuildVariant() {
  const chosenVariant = await select({
    message: `${commandLineTexts.buildQuestion} ${styleText("dim", commandLineTexts.buildKeysHint)}`,
    options: buildVariantNames.map((variantName) => ({ value: variantName, ...commandLineTexts.buildVariants[variantName] })),
    showInstructions: false,
  });
  return [stopWhenCancelled(chosenVariant)];
}

export async function askPageSecret() {
  const typedSecret = await password({
    message: commandLineTexts.passwordQuestion,
    validate: (typedValue) => (typedValue ? undefined : commandLineTexts.emptyPassword),
  });
  return stopWhenCancelled(typedSecret);
}
