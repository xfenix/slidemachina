import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { commandLineScript, currentSlide, demoFolderName, examplesFolder, skipsGeneratedFiles, waitForServer, workspaceFolder } from "./test-helpers.ts";

const editorServerPort = 5198;
const editorServerAddress = `http://localhost:${editorServerPort}`;
const playgroundSlideNumber = 50;
const tinyPicture = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");



async function sendEdit(editBody: object, requestHeaders: Record<string, string> = {}) {
  const editResponse = await fetch(`${editorServerAddress}/@slidemachina/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin", ...requestHeaders },
    body: JSON.stringify(editBody),
  });
  return editResponse.status;
}

// The editor writes to disk: a copy of the demo outside the repository, opened through a link as macOS opens /tmp.
test("редактор правит текст, двигает блок схемы и меняет картинку прямо в файле", async ({ page }) => {
  const scratchFolder = await mkdtemp(path.join(os.tmpdir(), "slidemachina-editor-"));
  const examplesCopyFolder = path.join(scratchFolder, "examples");
  const copyFolder = path.join(examplesCopyFolder, demoFolderName);
  const linkedFolder = path.join(scratchFolder, "linked-talk");
  const copiedPresentation = path.join(copyFolder, "index.tsx");
  const readPresentation = () => readFile(copiedPresentation, "utf8");
  await cp(examplesFolder, examplesCopyFolder, { recursive: true, filter: skipsGeneratedFiles });
  await symlink(copyFolder, linkedFolder);
  // Typograf took "= for a quote it cannot open and closed it: align="center».
  await writeFile(
    copiedPresentation,
    (await readPresentation()).replace("<h1>slidemachina</h1>", '<h1>slidemachina</h1>\n      <p data-typography-probe>Пишите align="center" и "кавычки"</p>'),
  );
  // Files the editor must refuse: a dependency and a link that leads out of the project.
  const dependencyFile = path.join(copyFolder, "node_modules", "fake", "fake.tsx");
  const outsideFile = path.join(scratchFolder, "outside.tsx");
  const refusedSource = "export default <p>Не трогать</p>;\n";
  await mkdir(path.dirname(dependencyFile), { recursive: true });
  await writeFile(dependencyFile, refusedSource);
  await writeFile(outsideFile, refusedSource);
  await symlink(outsideFile, path.join(copyFolder, "outside-link.tsx"));
  const developmentServer = spawn(process.execPath, [commandLineScript, "dev", linkedFolder, "--port", String(editorServerPort)], {
    cwd: workspaceFolder,
    stdio: "ignore",
  });
  try {
    await waitForServer(editorServerAddress);
    await page.setViewportSize({ width: 1280, height: 720 });

    await test.step("метки «файл:строка» ведут на свой тег", async () => {
      await page.goto(`${editorServerAddress}/#1`);
      const sourceLocation = await currentSlide(page).locator("h1").getAttribute("data-source-location");
      const [, lineNumber = 0, columnNumber = 0] = sourceLocation!.split(":").map(Number);
      const markedLine = (await readPresentation()).split("\n")[lineNumber - 1];
      expect(markedLine?.slice(columnNumber - 1)).toMatch(/^<h1>slidemachina<\/h1>/);
      await expect(currentSlide(page).locator("[data-typography-probe]")).toHaveText(/^Пишите align="center"\sи\s«кавычки»$/);
    });

    await test.step("правку принимают только со своей страницы, только в файл слайдов и только с полями нужного типа", async () => {
      await page.goto(`${editorServerAddress}/#${playgroundSlideNumber}`);
      const boxLocation = await currentSlide(page).locator("[data-node-id=file]").getAttribute("data-source-location");
      const sourceVersion = await page.evaluate(() => window.slidemachinaSourceVersions!["index.tsx"]);
      const presentationBefore = await readPresentation();
      const boxEditRequest = { editKind: "box", sourceLocation: boxLocation, sourceVersion, columnNumber: 2 };
      expect(await sendEdit(boxEditRequest, { "Sec-Fetch-Site": "same-site", Origin: "http://localhost:3000" }), "чужая страница").toBe(403);
      expect(await sendEdit({ ...boxEditRequest, columnNumber: "2} onClick={() => alert(1)" }), "код вместо номера колонки").toBe(422);
      expect(await sendEdit({ ...boxEditRequest, anchorLocation: boxLocation, anchorSide: "inside" }), "неизвестная сторона").toBe(422);
      for (const refusedLocation of ["node_modules/fake/fake.tsx:1:16", "outside-link.tsx:1:16"]) {
        expect(await sendEdit({ editKind: "text", sourceLocation: refusedLocation, typedText: "Взлом" }), refusedLocation).toBe(422);
      }
      expect(await readPresentation()).toBe(presentationBefore);
      expect(await readFile(dependencyFile, "utf8")).toBe(refusedSource);
      expect(await readFile(outsideFile, "utf8")).toBe(refusedSource);
    });

    await page.goto(`${editorServerAddress}/#${playgroundSlideNumber}`);
    const slideHeading = currentSlide(page).locator("h2");
    const slideCaption = currentSlide(page).locator("figcaption");
    await expect(slideHeading).toHaveText("Попробуйте: нажмите E");

    await test.step("E включает редактор", async () => {
      await page.keyboard.press("e");
      await expect(page.getByRole("button", { name: "Редактор · E" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("[data-editor-status]")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-source-editor");
    });

    await test.step("текст: пробел не листает, Enter пишет в файл, слайд обновляется без перезагрузки, вторая правка ждёт первую", async () => {
      await slideHeading.click();
      await expect(slideHeading).toHaveAttribute("contenteditable", "plaintext-only");
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("Пробуем редактор {вживую}");
      await expect(page).toHaveURL(new RegExp(`#${playgroundSlideNumber}$`));
      await page.keyboard.press("Enter");
      // Sent before the first edit comes back as a hot update: without the queue it would carry the old version of the file.
      await slideCaption.click();
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("Своя подпись");
      await page.keyboard.press("Enter");
      await expect.poll(readPresentation).toContain("<h2>Пробуем редактор &#123;вживую&#125;</h2>");
      await expect.poll(readPresentation).toContain("<figcaption>Своя подпись</figcaption>");
      await expect(slideHeading).toHaveText("Пробуем редактор {вживую}");
      await expect(slideHeading).not.toHaveAttribute("contenteditable");
      await expect(page.locator("[data-editor-status]")).toHaveText("Сохранено в index.tsx");
      expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
    });

    await test.step("Esc отменяет правку и не открывает навигатор", async () => {
      const presentationBefore = await readPresentation();
      await slideCaption.click();
      await page.keyboard.type(" и ещё");
      await page.keyboard.press("Escape");
      await expect(slideCaption).toHaveText("Своя подпись");
      await expect(page.locator("[data-navigator]")).toHaveCount(0);
      expect(await readPresentation()).toBe(presentationBefore);
    });

    await test.step("блок схемы прилипает к колонке: в файле column и новое место строки, стрелки целы", async () => {
      const slideDiagram = currentSlide(page).locator("[data-diagram]");
      const pictureBox = slideDiagram.locator("[data-node-id=picture]");
      await expect(pictureBox).toHaveAttribute("data-flow-column", "1");
      const pictureFrame = (await pictureBox.boundingBox())!;
      const fileFrame = (await slideDiagram.locator("[data-node-id=file]").boundingBox())!;
      await page.mouse.move(pictureFrame.x + pictureFrame.width / 2, pictureFrame.y + pictureFrame.height / 2);
      await page.mouse.down();
      for (let moveStep = 1; moveStep <= 8; moveStep += 1) {
        const stepShare = moveStep / 8;
        await page.mouse.move(
          pictureFrame.x + pictureFrame.width / 2 + (fileFrame.x - pictureFrame.x) * stepShare,
          pictureFrame.y + pictureFrame.height / 2 + (fileFrame.y + fileFrame.height * 1.5 - pictureFrame.y) * stepShare,
        );
      }
      await expect(page.locator("[data-editor-column-band]")).toBeVisible();
      await expect(page.locator("[data-editor-insertion-line]")).toBeVisible();
      await page.mouse.up();
      await expect.poll(readPresentation).toMatch(/<Machina.Box id="file">index\.tsx<\/Machina.Box>\n\s*<Machina.Box id="picture" column=\{3\}>Картинка<\/Machina.Box>\n/);
      await expect(pictureBox).toHaveAttribute("data-flow-column", "3");
      await expect(slideDiagram.locator("[data-arrow-line]")).toHaveCount(3);
      for (const arrowLine of await slideDiagram.locator("[data-arrow-line]").all()) await expect(arrowLine).toHaveAttribute("d", /^M[\d.,-]+ L/);
      await expect.poll(() => pictureBox.evaluate((boxElement: HTMLElement) => boxElement.style.transform)).toBe("");
    });

    await test.step("картинка: выбранный файл ложится в images/, импорт меняется", async () => {
      const slidePicture = currentSlide(page).locator("img[data-media]");
      const fileChooser = page.waitForEvent("filechooser");
      await slidePicture.click();
      await (await fileChooser).setFiles({ name: "My Photo.png", mimeType: "image/png", buffer: tinyPicture });
      await expect.poll(readPresentation).toContain('import editorPicture from "./images/my-photo.png";');
      expect(await readFile(path.join(copyFolder, "images", "my-photo.png"))).toEqual(tinyPicture);
      await expect(slidePicture).toHaveAttribute("src", /my-photo\.png/);
    });

    await test.step("файл изменили в редакторе кода: правка из браузера его не перезаписывает", async () => {
      const presentationBefore = await readPresentation();
      await page.evaluate(() => {
        window.slidemachinaSourceVersions!["index.tsx"] = "older-version";
      });
      await slideHeading.click();
      await page.keyboard.type("!");
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-editor-status]")).toHaveText(/^Файл изменили в редакторе кода/);
      await expect(slideHeading).toHaveText("Пробуем редактор {вживую}");
      expect(await readPresentation()).toBe(presentationBefore);
    });

    await test.step("E выключает редактор: текст больше не правится", async () => {
      await page.keyboard.press("e");
      await expect(page.locator("html")).not.toHaveAttribute("data-source-editor");
      await slideHeading.click();
      await expect(slideHeading).not.toHaveAttribute("contenteditable");
    });
  } finally {
    developmentServer.kill();
    await rm(scratchFolder, { recursive: true, force: true });
  }
});
