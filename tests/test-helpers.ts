import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

export const workspaceFolder = fileURLToPath(new URL("..", import.meta.url));
export const commandLineScript = path.join(workspaceFolder, "packages", "slidemachina", "node-tooling", "command-line", "slidemachina.ts");
export const projectCreatorScript = path.join(workspaceFolder, "packages", "create-slidemachina", "create-project.ts");
export const examplesFolder = path.join(workspaceFolder, "examples");
export const demoFolderName = "demo-presentation";

// A copy of examples/ keeps the shared theme: the demo takes Tailwind from examples/theme/style.css.
export function skipsGeneratedFiles(copiedPath: string) {
  return !/(^|\/)(node_modules|dist|\.vite)(\/|$)/.test(copiedPath);
}

export function currentSlide(page: Page) {
  return page.locator("[data-canvas] > [data-slide][data-current]");
}

export async function waitForServer(serverAddress: string) {
  for (let attemptNumber = 0; attemptNumber < 100; attemptNumber += 1) {
    const isAnswering = await fetch(serverAddress).then((serverResponse) => serverResponse.ok, () => false);
    if (isAnswering) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Сервер разработки ${serverAddress} не запустился`);
}
