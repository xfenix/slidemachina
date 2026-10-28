import { execFile } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { commandLineTexts } from "../command-line/command-line-texts.ts";
import { escapeHtml } from "./html-escaping.ts";
import { faviconLinks } from "../development-server/page-favicon.ts";

const staticryptCommand = createRequire(import.meta.url).resolve("staticrypt/cli/index.js");
const passwordPageTemplate = readFileSync(new URL("./password-page.html", import.meta.url), "utf8");
const runCommand = promisify(execFile);

// The secret goes through the environment, so it never shows up in the process list.
export async function encryptPage(pagePath: string, encryptedPagePath: string, pageSecret: string, presentationTitle: string): Promise<void> {
  const pageTexts = commandLineTexts.passwordPage;
  const encryptionFolder = mkdtempSync(path.join(os.tmpdir(), "slidemachina-encrypted-"));
  // staticrypt fills only its own fields, the engine adds the favicon and the line for Quick Look, which runs no scripts.
  const filledTemplatePath = path.join(encryptionFolder, "password-page.html");
  try {
    writeFileSync(
      filledTemplatePath,
      passwordPageTemplate.replace("<!--slidemachina-favicon-->", faviconLinks).replace("<!--slidemachina-browser-needed-->", escapeHtml(pageTexts.browserNeeded)),
    );
    await runCommand(
      process.execPath,
      [
        staticryptCommand,
        pagePath,
        ["--directory", encryptionFolder],
        ["--config", "false"],
        "--short",
        ["--template", filledTemplatePath],
        // staticrypt puts the title into <title> and <h1> as it is.
        ["--template-title", escapeHtml(presentationTitle)],
        ["--template-instructions", pageTexts.instructions],
        ["--template-placeholder", pageTexts.placeholder],
        ["--template-button", pageTexts.button],
        ["--template-remember", pageTexts.remember],
        ["--template-error", pageTexts.error],
        ["--template-toggle-show", pageTexts.showPassword],
        ["--template-toggle-hide", pageTexts.hidePassword],
        ["--template-color-primary", "#7000d1"],
        ["--template-color-secondary", "#0e1018"],
      ].flat(),
      { env: { ...process.env, STATICRYPT_PASSWORD: pageSecret } },
    );
    copyFileSync(path.join(encryptionFolder, path.basename(pagePath)), encryptedPagePath);
  } finally {
    rmSync(encryptionFolder, { recursive: true, force: true });
  }
}
