import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

export const workspaceFolder = fileURLToPath(new URL("..", import.meta.url));
export const commandLineScript = path.join(workspaceFolder, "packages", "slidemachina", "server-runtime", "command-line", "slidemachina.ts");
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

// Slides are found by what they show, not by number, so tests follow the demo when slides are added.
// Right after load only the shown slide and its neighbours are drawn: the search waits for the rest.
export async function findSlideNumber(page: Page, partSelector: string, partText?: string) {
  let slideNumber = 0;
  await expect
    .poll(
      async () =>
        (slideNumber = await page.locator("[data-canvas] > [data-slide]").evaluateAll(
          (slideElements, [searchedSelector, searchedText]) =>
            slideElements.findIndex((slideElement) =>
              [...slideElement.querySelectorAll(searchedSelector!)].some(
                (partElement) => searchedText === undefined || partElement.textContent.replace(/\s+/g, " ").trim() === searchedText,
              ),
            ) + 1,
          [partSelector, partText],
        )),
      { message: `В демо нет слайда с ${partSelector} ${partText ?? ""}` },
    )
    .toBeGreaterThan(0);
  return slideNumber;
}

export async function waitForServer(serverAddress: string) {
  for (let attemptNumber = 0; attemptNumber < 100; attemptNumber += 1) {
    const isAnswering = await fetch(serverAddress).then((serverResponse) => serverResponse.ok, () => false);
    if (isAnswering) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Сервер разработки ${serverAddress} не запустился`);
}
