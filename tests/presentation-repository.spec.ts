import { execFile, spawn } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { commandLineScript, examplesFolder, projectCreatorScript, skipsGeneratedFiles, waitForServer, workspaceFolder } from "./test-helpers.ts";

const runCommand = promisify(execFile);
const repositoryServerPort = 5197;
const repositoryServerAddress = `http://localhost:${repositoryServerPort}`;
// Newest first, by <Presentation date>.
const presentationTitles = ["slidemachina", "Итоги квартала", "Python 3.15: что нового"];
// The ELK worker itself and three.js: a cover of a first slide without a diagram or a scene needs neither.
const heavyRequestPattern = /elk-worker\.min\.js(?!\?url)|\/three\/|scene-view/;


function readThemeVariable(page: Page, variableName: string) {
  return page.locator("[data-canvas] > [data-current]").evaluate(
    (slideElement, readName) => getComputedStyle(slideElement).getPropertyValue(readName).trim(),
    variableName,
  );
}

// Engine defaults, the shared theme/style.css, then the presentation's own style.css with the brand it imports: each later one wins.
async function expectThemeCascade(page: Page, ownSectionBackground: string) {
  expect(await readThemeVariable(page, "--frame-padding"), "переменная движка").toBe("64px");
  expect(await readThemeVariable(page, "--list-accent-color"), "общая тема").toBe("#fee600");
  expect(await readThemeVariable(page, "--slide-background"), "бренд из своей темы").toBe("#f6f3e9");
  expect(await readThemeVariable(page, "--section-background"), "своя тема сильнее бренда").toBe(ownSectionBackground);
}

async function runFailingCommand(commandArguments: string[]) {
  const commandFailure = await runCommand(process.execPath, [commandLineScript, ...commandArguments]).then(
    () => undefined,
    (commandError: { code: number; stdout: string; stderr: string }) => commandError,
  );
  expect(commandFailure?.code, commandArguments.join(" ")).toBe(1);
  return `${commandFailure!.stdout}${commandFailure!.stderr}`;
}

// Works on a copy outside the repository, without node_modules, opened through a link as macOS opens /tmp.
test("репозиторий презентаций: список с обложками, общая тема, правка темы на лету, сборка всех", async ({ page }) => {
  const scratchFolder = await mkdtemp(path.join(os.tmpdir(), "slidemachina-test-repository-"));
  const copyFolder = path.join(scratchFolder, "examples");
  const linkedFolder = path.join(scratchFolder, "linked-examples");
  const outputFolder = path.join(scratchFolder, "dist");
  await cp(examplesFolder, copyFolder, { recursive: true, filter: skipsGeneratedFiles });
  await symlink(copyFolder, linkedFolder);
  const developmentServer = spawn(process.execPath, [commandLineScript, "dev", linkedFolder, "--port", String(repositoryServerPort)], {
    cwd: workspaceFolder,
    stdio: "ignore",
  });
  const requestedAddresses: string[] = [];
  page.on("request", (sentRequest) => requestedAddresses.push(sentRequest.url()));
  try {
    await waitForServer(repositoryServerAddress);
    await page.setViewportSize({ width: 1440, height: 900 });

    await test.step("список: карточки по дате, живые обложки, без ELK и three.js", async () => {
      await page.goto(repositoryServerAddress);
      await expect(page.locator("h1")).toHaveText("Презентации");
      await expect(page.locator("[data-list-title]")).toHaveText(presentationTitles);
      await expect(page.locator("[data-list-meta] time").first()).toHaveText("23 октября 2026");
      for (const [cardIndex, presentationTitle] of presentationTitles.entries()) {
        const coverFrame = page.frameLocator("[data-list-cover] iframe").nth(cardIndex);
        await expect(coverFrame.locator("[data-cover-preview] [data-slide] h1")).toHaveText(presentationTitle.split(":")[0]!);
      }
      await expect(page.frameLocator("[data-list-cover] iframe").first().locator("[data-toolbar]")).toHaveCount(0);
      expect(requestedAddresses.filter((requestedAddress) => heavyRequestPattern.test(requestedAddress))).toEqual([]);
      // The cards share the width of the page instead of huddling in the left corner.
      const cardWidths = await page.locator("[data-list-card]").evaluateAll((cardElements) => cardElements.map((cardElement) => cardElement.getBoundingClientRect().width));
      expect(cardWidths[0]! * cardWidths.length, "карточки занимают ширину страницы").toBeGreaterThan(1440 * 0.8);
    });

    await test.step("клик по карточке открывает презентацию, тема: движок → общая → своя", async () => {
      await page.locator("[data-list-link]").nth(2).click();
      await expect(page).toHaveURL(/\/python-news\/#1$/);
      await expect(page.locator("[data-canvas] > [data-current] h1")).toHaveText("Python 3.15");
      await expect(page.locator("[data-toolbar]")).toBeVisible();
      await expectThemeCascade(page, "#3c91cd");
      await page.getByRole("link", { name: "Все презентации" }).click();
      await expect(page.locator("[data-list-title]")).toHaveText(presentationTitles);
      await page.goto(`${repositoryServerAddress}/team-sync/`);
      expect(await readThemeVariable(page, "--section-background"), "раздел из бренда, своего цвета нет").toBe("#fee600");
    });

    await test.step("правка общей темы видна в открытой презентации без перезагрузки", async () => {
      const themeFile = path.join(copyFolder, "theme", "style.css");
      const themeBefore = await readFile(themeFile, "utf8");
      await writeFile(themeFile, themeBefore.replace("--list-accent-color: #fee600;", "--list-accent-color: #00ff00;"));
      await expect.poll(() => readThemeVariable(page, "--list-accent-color")).toBe("#00ff00");
      expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
      await writeFile(themeFile, themeBefore);
    });

    await test.step("кривой адрес не роняет сервер", async () => {
      expect((await fetch(`${repositoryServerAddress}/%E0%A4%A/`)).status).toBe(404);
      expect((await fetch(repositoryServerAddress)).ok).toBe(true);
    });

    await test.step("сборка не стирает исходники и говорит понятно, а не стеком", async () => {
      expect(await runFailingCommand(["build", linkedFolder, "--html", "--out", linkedFolder])).toContain("--out");
      expect(await runFailingCommand(["build", path.join(linkedFolder, "team-sync"), "--folder", "--out", linkedFolder])).toContain("--out");
      // Another copy of the same presentation in the output folder: its folder would be replaced by the build.
      const otherCopy = path.join(scratchFolder, "backup", "team-sync");
      await mkdir(otherCopy, { recursive: true });
      await writeFile(path.join(otherCopy, "index.tsx"), "export default null;\n");
      expect(await runFailingCommand(["build", path.join(linkedFolder, "team-sync"), "--folder", "--out", path.dirname(otherCopy)])).toContain("index.tsx");
      await access(path.join(otherCopy, "index.tsx"));
      for (const folderName of ["team-sync", "python-news"]) await access(path.join(copyFolder, folderName, "index.tsx"));
      const teamSyncFile = path.join(copyFolder, "team-sync", "index.tsx");
      const teamSyncSource = await readFile(teamSyncFile, "utf8");
      await writeFile(teamSyncFile, teamSyncSource.replace('aspectRatio="4:3"', 'aspectRatio="4:0"'));
      expect(await runFailingCommand(["build", path.join(linkedFolder, "team-sync"), "--html", "--out", outputFolder])).toContain('aspectRatio="4:0"');
      await writeFile(teamSyncFile, teamSyncSource);
      for (const wrongArguments of [["build", linkedFolder, "--pfd"], ["dev", linkedFolder, "--port", "abc"]]) {
        const commandOutput = await runFailingCommand(wrongArguments);
        expect(commandOutput).toContain(wrongArguments.at(-1));
        expect(commandOutput).not.toMatch(/\n\s+at /);
      }
    });

    await test.step("сборка всех: список, обложки, PDF рядом, презентация открывается с диска", async () => {
      await runCommand(process.execPath, [commandLineScript, "build", linkedFolder, "--html", "--pdf", "--out", outputFolder]);
      await page.goto(pathToFileURL(path.join(outputFolder, "index.html")).href);
      await expect(page.locator("[data-list-title]")).toHaveText(presentationTitles);
      const coverPictures = page.locator("[data-list-cover] img");
      await expect(coverPictures).toHaveCount(presentationTitles.length);
      // team-sync is 4:3: its cover, card and PDF pages keep that format.
      const coverSizes = presentationTitles.map((presentationTitle) => (presentationTitle === "Итоги квартала" ? "960×720" : "960×540"));
      await expect
        .poll(() => coverPictures.evaluateAll((pictureElements: HTMLImageElement[]) => pictureElements.map(({ naturalWidth, naturalHeight }) => `${naturalWidth}×${naturalHeight}`)))
        .toEqual(coverSizes);
      expect(await page.locator("[data-list-cover]").nth(1).evaluate((coverElement) => getComputedStyle(coverElement).aspectRatio)).toBe("1440 / 1080");
      await expect(page.locator("[data-list-downloads] a")).toHaveText(presentationTitles.map(() => "PDF"));
      const teamSyncPdf = (await readFile(path.join(outputFolder, "team-sync", "team-sync.pdf"))).toString("latin1");
      expect(teamSyncPdf.startsWith("%PDF")).toBe(true);
      // 1440×1080 CSS pixels are 1080×810 points.
      expect(teamSyncPdf.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/)?.slice(1)).toEqual(["1080", "810"]);
      await page.locator("[data-list-link]").nth(2).click();
      await expect(page).toHaveURL(/python-news\/index\.html#1$/);
      await expect(page.locator("[data-canvas] > [data-current] h1")).toHaveText("Python 3.15");
      await expectThemeCascade(page, "#3c91cd");
      await page.getByRole("link", { name: "Все презентации" }).click();
      await expect(page).toHaveURL(/\/dist\/index\.html$/);
    });

    await test.step("npm create slidemachina: презентация с README и главными переменными темы", async () => {
      const createdFolder = path.join(scratchFolder, "created");
      await mkdir(createdFolder);
      await runCommand(process.execPath, [projectCreatorScript, "my-talk"], { cwd: createdFolder });
      const projectReadme = await readFile(path.join(createdFolder, "my-talk", "README.md"), "utf8");
      for (const readmePart of ["npm run dev", "--pdf", "<Diagram>", "Esc", "--accent-color"]) expect(projectReadme).toContain(readmePart);
      const projectStyle = await readFile(path.join(createdFolder, "my-talk", "style.css"), "utf8");
      for (const themeVariable of ["--accent-color", "--section-background", "--dark-background", "--transition-stage-background"]) {
        expect(projectStyle).toContain(`/* ${themeVariable}:`);
      }
    });
  } finally {
    developmentServer.kill();
    await rm(scratchFolder, { recursive: true, force: true });
  }
});
