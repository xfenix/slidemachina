import { execFile } from "node:child_process";
import { createServer, type ServerResponse } from "node:http";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { sampleSceneCanvas } from "./scene-sampling.ts";
import { commandLineScript, demoFolderName, examplesFolder, findSlideNumber } from "./test-helpers.ts";

const runCommand = promisify(execFile);
// Marks, the edit endpoint and the editor's own attributes: none of them may reach a build.
const editorTraces = /data-source-location|@slidemachina\/edit|data-editor-status/;
// Library code only: the demo names Agentation in its slide text.
const agentationTraces = /data-agentation|--agentation-/;
// Russian and English slides need only these subsets; Vietnamese, Greek, math and symbols only add weight. Oswald comes with the demo's meme.
const keptFontFile = /^(onest|jetbrains-mono|oswald)-(latin|cyrillic)-wght-normal-.*\.woff2$/;

// The folder build runs only from a web server, as on a real site.
function serveFolder(servedFolder: string) {
  const folderServer = createServer((request, response) => void sendServedFile(servedFolder, request.url!, response));
  return new Promise<typeof folderServer>((resolveServer) => folderServer.listen(0, () => resolveServer(folderServer)));
}

async function sendServedFile(servedFolder: string, requestedUrl: string, response: ServerResponse) {
  try {
    const requestedPath = decodeURIComponent(new URL(requestedUrl, "http://localhost").pathname);
    const fileBytes = await readFile(path.join(servedFolder, requestedPath.endsWith("/") ? `${requestedPath}index.html` : requestedPath));
    const fileType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(requestedPath) || ".html"];
    response.writeHead(200, fileType === undefined ? {} : { "content-type": fileType });
    response.end(fileBytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
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

test("сборка: один HTML-файл листается без сервера, папка держит ELK и three.js отдельно, печатная версия, PDF по шагам и PowerPoint", async ({ page }) => {
  // Vite, the PDF and the PowerPoint export each drive Chrome through the whole demo.
  test.setTimeout(180_000);
  const outputFolder = await mkdtemp(path.join(os.tmpdir(), "slidemachina-test-build-"));
  try {
    await runCommand(process.execPath, [commandLineScript, "build", path.join(examplesFolder, demoFolderName), "--html", "--folder", "--steps", "--pptx", "--out", outputFolder]);
    const singleFile = path.join(outputFolder, "demo-presentation.html");
    const assetFolder = path.join(outputFolder, "demo-presentation", "assets");

    await test.step("один файл: всё внутри, без agentation", async () => {
      // Booleans, not the text itself: a failed match would print the whole 5 MB file.
      const singleFileText = await readFile(singleFile, "utf8");
      expect(agentationTraces.test(singleFileText), "agentation в файле").toBe(false);
      expect(editorTraces.test(singleFileText), "редактор в файле").toBe(false);
      expect(/(src|href)="\.\/assets/.test(singleFileText), "ссылки на соседние файлы").toBe(false);
      expect(singleFileText.includes("data:image/webp;base64"), "картинка WebP внутри").toBe(true);
      expect(singleFileText.match(/data:font\/woff2;base64/g)?.length, "внутри только латиница и кириллица Onest, JetBrains Mono и Oswald").toBe(6);
    });

    await test.step("один файл открывается с диска, листается, схемы раскладываются", async () => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(pathToFileURL(singleFile).href);
      await expect(page).toHaveURL(/#1$/);
      await page.keyboard.press("PageDown");
      await expect(page).toHaveURL(/#2$/);
      await page.goto(`${pathToFileURL(singleFile).href}#${await findSlideNumber(page, "[data-diagram]")}`);
      await expect(page.locator("[data-canvas] > [data-current] [data-diagram]")).toHaveAttribute("data-laid-out");
      const stretchedPicture = page.locator("[data-canvas] [data-media-frame=stretch] img").first();
      expect(await stretchedPicture.evaluate((pictureElement: HTMLImageElement) => pictureElement.currentSrc.slice(0, 15))).toBe("data:image/webp");
      const firstSceneSlideNumber = await findSlideNumber(page, "[data-scene]");
      await page.goto(`${pathToFileURL(singleFile).href}#${firstSceneSlideNumber}`);
      const sceneCanvas = page.locator("[data-canvas] > [data-current] [data-scene-canvas]");
      await expect.poll(async () => (await sampleSceneCanvas(sceneCanvas)).paintedPixels, { message: "сцена рисуется из файла" }).toBeGreaterThan(250);
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
      expect((await sampleSceneCanvas(printedScenes.first().locator("[data-scene-canvas]"))).paintedPixels).toBeGreaterThan(250);
      await page.emulateMedia({ media: "screen" });
    });

    await test.step("PowerPoint: слайд на слайд, текст и стрелки схем — объекты PowerPoint, шаги схемы — анимация по щелчку", async () => {
      const pptxFiles = unzipSync(await readFile(path.join(outputFolder, "demo-presentation.pptx")));
      const readSlideXml = (slideNumber: number) => strFromU8(pptxFiles[`ppt/slides/slide${slideNumber}.xml`] ?? new Uint8Array());
      const pptxSlideCount = Object.keys(pptxFiles).filter((filePath) => /^ppt\/slides\/slide\d+\.xml$/.test(filePath)).length;
      // A slide with code line steps becomes a slide per step, every other slide stays one.
      const pptxSlidesPerSlide = await page.locator("[data-canvas] > [data-slide]").evaluateAll((slideElements) =>
        slideElements.map((slideElement) =>
          slideElement.querySelector("[data-code-step]") === null ? 1 : new Set([...slideElement.querySelectorAll<HTMLElement>("[data-step-index]")].map((stepElement) => stepElement.dataset.stepIndex)).size + 1,
        ),
      );
      const findPptxSlideNumber = (slideNumber: number) => pptxSlidesPerSlide.slice(0, slideNumber).reduce((slideTotal, slideCount) => slideTotal + slideCount, 0);
      expect(pptxSlidesPerSlide.filter((slideCount) => slideCount > 1).length, "шаги строк кода — отдельные слайды").toBeGreaterThan(0);
      expect(pptxSlideCount).toBe(findPptxSlideNumber(pptxSlidesPerSlide.length));
      expect(readSlideXml(1), "заголовок обложки — текстовое поле").toMatch(/<p:sp>(?:(?!<\/p:sp>).)*<a:t>Слайды из.кода<\/a:t>/s);
      expect(readSlideXml(1), "логотип — картинка").toContain("<p:pic>");
      // A code box in a line is the highlight of its run, so it moves with the letters in any font.
      const inlineCodeSlideXml = readSlideXml(findPptxSlideNumber(await findSlideNumber(page, "li code", "index.tsx")));
      expect(inlineCodeSlideXml, "плашка кода — подсветка текста").toMatch(/<a:highlight>(?:(?!<\/a:r>).)*<a:t>index\.tsx<\/a:t>/s);
      const pictureCodeSlideXml = readSlideXml(findPptxSlideNumber(await findSlideNumber(page, ".machina-lead code", "plain")));
      expect(pictureCodeSlideXml, "плашка кода над картинкой — тоже подсветка").toMatch(/<a:highlight>(?:(?!<\/a:r>).)*<a:t>plain<\/a:t>/s);
      // PowerPoint strokes over the fill: the outline goes on a copy underneath, the caption itself stays white.
      const memeSlideXml = readSlideXml(findPptxSlideNumber(await findSlideNumber(page, "[data-meme-field]", "Схема, код, 3D")));
      expect(memeSlideXml, "подпись мема белая").toMatch(/<a:solidFill><a:srgbClr val="FFFFFF"\/><\/a:solidFill>(?:(?!<\/a:r>).)*<a:t>СХЕМА, КОД, 3D<\/a:t>/s);
      const diagramSlideNumber = findPptxSlideNumber(await findSlideNumber(page, "[data-diagram] [data-step]"));
      const diagramSteps = await page.locator("[data-canvas] > [data-slide]").nth((await findSlideNumber(page, "[data-diagram] [data-step]")) - 1).evaluate((slideElement) => {
        const appearingSteps = [...slideElement.querySelectorAll<HTMLElement>("[data-step-index]")].filter((stepElement) => !["highlight", "dim"].includes(stepElement.dataset.stepEffect ?? ""));
        return new Set(appearingSteps.map((stepElement) => stepElement.dataset.stepIndex)).size;
      });
      const diagramSlideXml = readSlideXml(diagramSlideNumber);
      expect(diagramSlideXml, "стрелка — фигура").toContain("<a:custGeom>");
      expect(diagramSlideXml.match(/delay="indefinite"/g)?.length, "щелчок на каждый шаг").toBe(diagramSteps);
    });

    await test.step("папка: ELK и three.js отдельными файлами, в основном модуле нет ни ELK, ни three.js, ни agentation, редактора нет нигде", async () => {
      const assetNames = await readdir(assetFolder);
      expect(assetNames.filter((assetName) => assetName.endsWith(".woff2") && !keptFontFile.test(assetName))).toEqual([]);
      // A GIF becomes an animated WebP, all frames kept: the RIFF file carries an ANIM chunk.
      expect(assetNames.filter((assetName) => assetName.endsWith(".gif"))).toEqual([]);
      // The GIF is the picture of the demo's own meme, images/memes/orbit.gif.
      const memePictures = await Promise.all(
        assetNames.filter((assetName) => /^orbit-[\w-]{8}\.webp$/.test(assetName)).map((assetName) => readFile(path.join(assetFolder, assetName))),
      );
      expect(memePictures.some((memePicture) => memePicture.includes("ANIM")), "анимация в WebP").toBe(true);
      expect(assetNames.filter((assetName) => /^elk-worker.*\.js$/.test(assetName))).toHaveLength(1);
      const mainModuleName = assetNames.find((assetName) => /^index-.*\.js$/.test(assetName))!;
      const mainModuleText = await readFile(path.join(assetFolder, mainModuleName), "utf8");
      expect(mainModuleText.includes("org.eclipse.elk"), "ELK в основном модуле").toBe(false);
      expect(agentationTraces.test(mainModuleText), "agentation в основном модуле").toBe(false);
      expect(mainModuleText.includes("THREE.WebGLRenderer"), "three.js в основном модуле").toBe(false);
      const sceneModuleName = assetNames.find((assetName) => /^scene-view-.*\.js$/.test(assetName))!;
      expect((await readFile(path.join(assetFolder, sceneModuleName), "utf8")).includes("THREE.WebGLRenderer"), "three.js в своём файле").toBe(true);
      for (const assetName of assetNames) {
        const assetText = await readFile(path.join(assetFolder, assetName), "latin1");
        expect(editorTraces.test(assetText), `редактор в ${assetName}`).toBe(false);
      }
    });

    await test.step("печатная версия и PDF по шагам: страница на каждый шаг, раскадровка выключается", async () => {
      const pdfBytes = await readFile(path.join(outputFolder, "demo-presentation-steps.pdf"));
      const pdfPageCount = countPdfPages(pdfBytes);
      // Blurred shadows, masks and gradient text become soft masks, and macOS Preview draws them as grey and blue patches.
      expect(pdfBytes.toString("latin1").match(/\/S\s*\/(Luminosity|Alpha)/g), "мягкие маски в PDF").toBeNull();
      await page.emulateMedia({ media: "screen" });
      await page.goto(`${pathToFileURL(singleFile).href}?print=steps`);
      await expect(page.locator("[data-print-pages][data-print-view]")).toHaveAttribute("data-print-ready");
      await expect(page.locator("[data-print-page]")).toHaveCount(pdfPageCount);
      await expect(page.locator("[data-canvas]")).toBeHidden();
      const slideCount = await page.locator("[data-canvas] > [data-slide]").count();
      expect(pdfPageCount).toBeGreaterThan(slideCount);
      await page.getByRole("switch").click();
      await expect(page.locator("[data-print-page]")).toHaveCount(slideCount);
      await expect(page).toHaveURL(/\?print(#|$)/);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-canvas]")).toBeVisible();
      await expect(page.locator("[data-print-page]")).toHaveCount(0);
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
