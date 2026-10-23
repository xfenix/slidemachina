import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { sampleSceneCanvas } from "./scene-sampling.ts";

const runCommand = promisify(execFile);
// Marks, the edit endpoint and the editor's own attributes: none of them may reach a build.
const editorTraces = /data-source-location|@slidemachina\/edit|data-editor-status/;
// Russian and English slides need only these subsets; Vietnamese, Greek, math and symbols only add weight.
const keptFontFile = /^(onest|jetbrains-mono)-(latin|cyrillic)-wght-normal-.*\.woff2$/;

// The folder build runs only from a web server, as on a real site.
function serveFolder(servedFolder: string) {
  const folderServer = createServer(async (request, response) => {
    const requestedPath = decodeURIComponent(new URL(request.url!, "http://localhost").pathname);
    try {
      const fileBytes = await readFile(path.join(servedFolder, requestedPath.endsWith("/") ? `${requestedPath}index.html` : requestedPath));
      const fileType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(requestedPath) || ".html"];
      response.writeHead(200, fileType === undefined ? {} : { "content-type": fileType });
      response.end(fileBytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise<typeof folderServer>((resolveServer) => folderServer.listen(0, () => resolveServer(folderServer)));
}

function countPdfPages(pdfBytes: Buffer) {
  return pdfBytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
}

function countPrintedPages(page: Page) {
  return page.evaluate(() => {
    window.dispatchEvent(new Event("beforeprint"));
    return document.querySelectorAll("[data-print-page]").length;
  });
}

test("сборка: один HTML-файл листается без сервера, папка держит ELK и three.js отдельно, PDF по шагам", async ({ page }) => {
  const outputFolder = await mkdtemp(path.join(os.tmpdir(), "slidemachina-test-build-"));
  try {
    await runCommand(process.execPath, ["bin/slidemachina.js", "build", "demo-presentation", "--html", "--folder", "--steps", "--out", outputFolder]);
    const singleFile = path.join(outputFolder, "demo-presentation.html");
    const assetFolder = path.join(outputFolder, "demo-presentation", "assets");

    await test.step("один файл: всё внутри, без agentation", async () => {
      // Booleans, not the text itself: a failed match would print the whole 5 MB file.
      const singleFileText = await readFile(singleFile, "utf8");
      expect(/agentation/i.test(singleFileText), "agentation в файле").toBe(false);
      expect(editorTraces.test(singleFileText), "редактор в файле").toBe(false);
      expect(/(src|href)="\.\/assets/.test(singleFileText), "ссылки на соседние файлы").toBe(false);
      expect(singleFileText.includes("data:image/webp;base64"), "картинка WebP внутри").toBe(true);
      expect(singleFileText.match(/data:font\/woff2;base64/g)?.length, "внутри только латиница и кириллица Onest и JetBrains Mono").toBe(4);
    });

    await test.step("один файл открывается с диска, листается, схемы раскладываются", async () => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(pathToFileURL(singleFile).href);
      await expect(page).toHaveURL(/#1$/);
      await page.keyboard.press("PageDown");
      await expect(page).toHaveURL(/#2$/);
      await page.goto(`${pathToFileURL(singleFile).href}#26`);
      await expect(page.locator("[data-canvas] > [data-current] [data-diagram]")).toHaveAttribute("data-laid-out");
      const stretchedPicture = page.locator("[data-canvas] [data-media-frame=stretch] img").first();
      expect(await stretchedPicture.evaluate((pictureElement: HTMLImageElement) => pictureElement.currentSrc.slice(0, 15))).toBe("data:image/webp");
      // Counted on the page, so the test follows the demo when slides are added.
      const firstSceneSlideNumber = await page.locator("[data-canvas] > [data-slide]").evaluateAll(
        (slideElements) => slideElements.findIndex((slideElement) => slideElement.querySelector("[data-scene]") !== null) + 1,
      );
      await page.goto(`${pathToFileURL(singleFile).href}#${firstSceneSlideNumber}`);
      const sceneCanvas = page.locator("[data-canvas] > [data-current] [data-scene-canvas]");
      await expect.poll(async () => (await sampleSceneCanvas(sceneCanvas)).paintedPixels, { message: "сцена рисуется из файла" }).toBeGreaterThan(400);
    });

    await test.step("печать из браузера: страница на слайд, без панели управления", async () => {
      const demoSlideCount = await page.locator("[data-canvas] > [data-slide]").count();
      const demoSceneCount = await page.locator("[data-canvas] > [data-slide] [data-scene]").count();
      expect(await countPrintedPages(page)).toBe(demoSlideCount);
      await page.emulateMedia({ media: "print" });
      await expect(page.locator("[data-toolbar]")).toBeHidden();
      await expect(page.locator("[data-print-page]").first()).toBeVisible();
      // Printed copies keep a still frame in a 2D canvas: Chrome prints that kind, so the PDF shows the scene.
      const printedScenes = page.locator("[data-print-pages] [data-scene]");
      await expect(printedScenes).toHaveCount(demoSceneCount);
      await expect(page.locator("[data-print-pages] [data-scene][data-drawn]")).toHaveCount(demoSceneCount);
      expect((await sampleSceneCanvas(printedScenes.first().locator("[data-scene-canvas]"))).paintedPixels).toBeGreaterThan(400);
      await page.emulateMedia({ media: "screen" });
    });

    await test.step("папка: ELK и three.js отдельными файлами, в основном модуле нет ни ELK, ни three.js, ни agentation, редактора нет нигде", async () => {
      const assetNames = await readdir(assetFolder);
      expect(assetNames.filter((assetName) => assetName.endsWith(".woff2") && !keptFontFile.test(assetName))).toEqual([]);
      expect(assetNames.filter((assetName) => /^elk-worker.*\.js$/.test(assetName))).toHaveLength(1);
      const mainModuleName = assetNames.find((assetName) => /^index-.*\.js$/.test(assetName))!;
      const mainModuleText = await readFile(path.join(assetFolder, mainModuleName), "utf8");
      expect(mainModuleText.includes("org.eclipse.elk"), "ELK в основном модуле").toBe(false);
      expect(/agentation/i.test(mainModuleText), "agentation в основном модуле").toBe(false);
      expect(mainModuleText.includes("THREE.WebGLRenderer"), "three.js в основном модуле").toBe(false);
      const sceneModuleName = assetNames.find((assetName) => /^scene-view-.*\.js$/.test(assetName))!;
      expect((await readFile(path.join(assetFolder, sceneModuleName), "utf8")).includes("THREE.WebGLRenderer"), "three.js в своём файле").toBe(true);
      for (const assetName of assetNames) {
        const assetText = await readFile(path.join(assetFolder, assetName), "latin1");
        expect(editorTraces.test(assetText), `редактор в ${assetName}`).toBe(false);
      }
    });

    await test.step("PDF по шагам: страница на каждый шаг, как при печати из браузера", async () => {
      const pdfPageCount = countPdfPages(await readFile(path.join(outputFolder, "demo-presentation-steps.pdf")));
      await page.evaluate(() => localStorage.setItem("slidemachina-print-steps", "true"));
      await page.reload();
      expect(await countPrintedPages(page)).toBe(pdfPageCount);
      expect(pdfPageCount).toBeGreaterThan(await page.locator("[data-canvas] > [data-slide]").count());
    });

    await test.step("папка: первый экран не грузит ELK, three.js и видео", async () => {
      const folderServer = await serveFolder(path.join(outputFolder, "demo-presentation"));
      try {
        const serverAddress = folderServer.address() as { port: number };
        await page.goto(`http://localhost:${serverAddress.port}/#1`);
        await page.waitForTimeout(3000);
        const loadedFiles = await page.evaluate(() => performance.getEntriesByType("resource").map((resourceEntry) => resourceEntry.name));
        expect(loadedFiles.filter((loadedFile) => /elk-worker|scene-view|\.webm/.test(loadedFile))).toEqual([]);
      } finally {
        folderServer.closeAllConnections();
        folderServer.close();
      }
    });
  } finally {
    await rm(outputFolder, { recursive: true, force: true });
  }
});
