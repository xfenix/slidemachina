import { test } from "@playwright/test";

test("debug: app remote flow", async ({ page, context }) => {
  test.setTimeout(30_000);
  page.on("console", (consoleMessage) => console.log("HOST:", consoleMessage.text()));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?remote-broker=localhost:9300");
  await page.getByRole("button", { name: "Пульт с телефона" }).click();
  const hostingCode = await page.locator("[data-remote-code]").inputValue();
  console.log("code:", hostingCode);

  const phonePage = await context.newPage();
  phonePage.on("console", (consoleMessage) => console.log("PHONE:", consoleMessage.text()));
  await phonePage.setViewportSize({ width: 390, height: 844 });
  await phonePage.goto("/?remote-broker=localhost:9300");
  await phonePage.getByRole("button", { name: "Пульт с телефона" }).click();
  await phonePage.locator("[data-remote-code]").fill(hostingCode);
  await phonePage.waitForTimeout(10_000);
  console.log("phone panel:", (await phonePage.locator("[data-remote-panel]").innerText()).replace(/\n/g, " | "));
});
