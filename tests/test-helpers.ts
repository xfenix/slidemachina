import type { Page } from "@playwright/test";

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
