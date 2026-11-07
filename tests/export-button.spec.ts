import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { commandLineScript, examplesFolder, waitForServer, workspaceFolder } from "./test-helpers.ts";

const exportServerPort = 5197;
const exportServerAddress = `http://localhost:${exportServerPort}`;
const generatedPresentation = `
import { Presentation, Slide } from "slidemachina";
export default (
  <Presentation>
    <Slide>
      <h1>Export check</h1>
    </Slide>
    <Slide hidden>
      <h1>Hidden backup slide</h1>
    </Slide>
    <Slide>
      <h1>Steps check</h1>
      <ul data-steps>
        <li>First point</li>
        <li>Second point</li>
      </ul>
    </Slide>
  </Presentation>
);
`;

// The toolbar fades after two seconds without the mouse and ignores clicks while faded (opacity: 0, pointer-events: none).
// Playwright waits for a visible element without moving the mouse, so the faded toolbar never wakes: a raw move wakes it.
async function wakeToolbar(page: Page) {
  await page.mouse.move(400, 690);
  await page.mouse.move(880, 690);
}

test("кнопка экспорта в тулбаре выгружает HTML, PDF и PowerPoint", async ({ page }) => {
  // Каждый вариант — полная сборка с Chrome: HTML снимает слайды для Quick Look, PDF и PowerPoint печатают страницы.
  test.setTimeout(240_000);
  const repositoryFolder = await mkdtemp(path.join(examplesFolder, "export-test-"));
  const scratchFolder = path.join(repositoryFolder, "sample-talk");
  const downloadsFolder = await mkdtemp(path.join(os.tmpdir(), "slidemachina-export-test-"));
  await mkdir(scratchFolder);
  await writeFile(path.join(scratchFolder, "index.tsx"), generatedPresentation);
  const developmentServer = spawn(process.execPath, [commandLineScript, "dev", repositoryFolder, "--port", String(exportServerPort)], { cwd: workspaceFolder, stdio: "ignore" });
  try {
    await waitForServer(exportServerAddress);
    await page.goto(`${exportServerAddress}/sample-talk/`);
    // A fresh dev server re-optimizes dependencies once and full-reloads the page, which would kill an open
    // export menu mid-click: put a marker on the window and wait until it survives a quiet window.
    for (let settleAttempt = 0; settleAttempt < 4; settleAttempt += 1) {
      await page.evaluate(() => ((window as unknown as { settleMarker: boolean }).settleMarker = true));
      await page.waitForTimeout(6000);
      const markerSurvived = await page.evaluate(() => "settleMarker" in window).catch(() => false);
      if (markerSurvived) break;
    }
    await expect(page.getByRole("toolbar")).toBeVisible();

    await test.step("HTML: файл качается одним куском и открывает слайд", async () => {
      await wakeToolbar(page);
      await page.getByRole("button", { name: "Export" }).click();
      const htmlDownloadPromise = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: /One HTML file/ }).click();
      const htmlDownload = await htmlDownloadPromise;
      expect(htmlDownload.suggestedFilename()).toBe("sample-talk.html");
      const htmlPath = path.join(downloadsFolder, "sample-talk.html");
      await htmlDownload.saveAs(htmlPath);
      const htmlText = await readFile(htmlPath, "utf8");
      expect(htmlText).toContain("Export check");
      expect(htmlText).toContain("data-static-cover");
      await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
    });

    await test.step("PDF: файл качается и начинается с сигнатуры PDF", async () => {
      await wakeToolbar(page);
      await page.getByRole("button", { name: "Export" }).click();
      const pdfDownloadPromise = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: /^PDF/ }).click();
      const pdfDownload = await pdfDownloadPromise;
      expect(pdfDownload.suggestedFilename()).toBe("sample-talk.pdf");
      const pdfPath = path.join(downloadsFolder, "sample-talk.pdf");
      await pdfDownload.saveAs(pdfPath);
      expect((await readFile(pdfPath)).subarray(0, 4).toString("latin1")).toBe("%PDF");
    });

    await test.step("PowerPoint: файл качается, это zip со слайдами", async () => {
      await wakeToolbar(page);
      await page.getByRole("button", { name: "Export" }).click();
      const pptxDownloadPromise = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: /PowerPoint/ }).click();
      const pptxDownload = await pptxDownloadPromise;
      expect(pptxDownload.suggestedFilename()).toBe("sample-talk.pptx");
      const pptxPath = path.join(downloadsFolder, "sample-talk.pptx");
      await pptxDownload.saveAs(pptxPath);
      const pptxFiles = unzipSync(new Uint8Array(await readFile(pptxPath)));
      expect(Object.keys(pptxFiles).filter((fileName) => fileName.startsWith("ppt/slides/slide"))).not.toHaveLength(0);
      expect(strFromU8(pptxFiles["docProps/app.xml"]!)).toContain("Slides");
    });

    await test.step("чужие запросы отклоняются", async () => {
      const sameOriginHeaders = { "Sec-Fetch-Site": "same-origin" };
      expect((await fetch(`${exportServerAddress}/@slidemachina/export?presentation=/sample-talk&variant=doc`, { headers: sameOriginHeaders })).status).toBe(422);
      expect((await fetch(`${exportServerAddress}/@slidemachina/export?presentation=/sample-talk&variant=html`)).status).toBe(403);
      expect((await fetch(`${exportServerAddress}/@slidemachina/export?presentation=/nowhere&variant=html`, { headers: sameOriginHeaders })).status).toBe(422);
    });
  } finally {
    developmentServer.kill();
    await rm(repositoryFolder, { recursive: true, force: true });
    await rm(downloadsFolder, { recursive: true, force: true });
  }
});
