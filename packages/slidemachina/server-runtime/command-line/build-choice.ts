import { styleText } from "node:util";
import { cancel, isCancel, password, select } from "@clack/prompts";
import { commandLineTexts } from "./command-line-texts.ts";

export type BuildVariant = "html" | "protected" | "folder" | "zip" | "pdf" | "pdf-steps" | "pptx";
export type BuildFlags = { html?: boolean, protected?: boolean, folder?: boolean, zip?: boolean, pdf?: boolean, steps?: boolean, pptx?: boolean, out?: string };

const buildVariantNames: BuildVariant[] = ["html", "protected", "folder", "zip", "pdf", "pdf-steps", "pptx"];
const fileVariantNames = ["html", "protected", "folder", "zip"] as const;

// Flags combine for CI: --html --pdf --pptx builds all three; --steps alone means a PDF by steps.
export function pickFlaggedVariants(commandOptions: BuildFlags): BuildVariant[] {
  const flaggedVariants: BuildVariant[] = fileVariantNames.filter((variantName) => commandOptions[variantName]);
  if (commandOptions.pdf || commandOptions.steps) flaggedVariants.push(commandOptions.steps ? "pdf-steps" : "pdf");
  if (commandOptions.pptx) flaggedVariants.push("pptx");
  return flaggedVariants;
}

function stopWhenCancelled<AnswerType>(promptAnswer: AnswerType): Exclude<AnswerType, symbol> {
  if (!isCancel(promptAnswer)) return promptAnswer as Exclude<AnswerType, symbol>;
  cancel(commandLineTexts.buildCancelled);
  process.exit(0);
}

export async function askBuildVariant(): Promise<[BuildVariant]> {
  const chosenVariant = await select({
    message: `${commandLineTexts.buildQuestion} ${styleText("dim", commandLineTexts.buildKeysHint)}`,
    options: buildVariantNames.map((variantName) => ({ value: variantName, ...commandLineTexts.buildVariants[variantName] })),
    showInstructions: false,
  });
  return [stopWhenCancelled(chosenVariant)];
}

export async function askPageSecret(): Promise<string> {
  const typedSecret = await password({
    message: commandLineTexts.passwordQuestion,
    validate: (typedValue: string | undefined) => (typedValue ? undefined : commandLineTexts.emptyPassword),
  });
  return stopWhenCancelled(typedSecret);
}
