import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { sampleSceneCanvas } from "./scene-sampling.ts";
import { currentSlide, demoFolderName, examplesFolder, workspaceFolder } from "./test-helpers.ts";

// playwright.config.ts serves a copy of the demo: edits here never reach the real files or the dev server on 5173.
const demoCopyFolder = process.env.SLIDEMACHINA_TEST_DEMO_COPY!;
const demoPresentationFile = path.join(demoCopyFolder, "index.tsx");
const demoCodeFile = path.join(demoCopyFolder, "agent.py");
const publicInterfaceFile = path.join(workspaceFolder, "packages", "slidemachina", "browser-runtime", "slidemachina.ts");
// The copy has no tsconfig.json above it, so the editor hint is asked about the real demo with the same slides.
const realDemoPresentationFile = path.join(examplesFolder, demoFolderName, "index.tsx");
const editorTypeScriptServer = path.join(workspaceFolder, "packages", "slidemachina", "node_modules", "typescript", "lib", "tsserver.js");

async function editFileWhile(filePath: string, editText: (originalText: string) => string, checkEditedPage: () => Promise<void>) {
  const originalText = await readFile(filePath, "utf8");
  try {
    await writeFile(filePath, editText(originalText));
    await checkEditedPage();
  } finally {
    await writeFile(filePath, originalText);
  }
}

// Hovers the first tag that starts like each given text, the way VS Code asks TypeScript; the plugin comes from tsconfig.json.
async function askEditorHints(hoveredTags: string[]) {
  const sourceLines = (await readFile(realDemoPresentationFile, "utf8")).split("\n");
  const serverRequests = [
    { command: "open", arguments: { file: realDemoPresentationFile } },
    ...hoveredTags.map((hoveredTag) => {
      const lineIndex = sourceLines.findIndex((sourceLine) => sourceLine.includes(hoveredTag));
      const tagNameOffset = sourceLines[lineIndex]!.indexOf(hoveredTag) + 2;
      return { command: "quickinfo", arguments: { file: realDemoPresentationFile, line: lineIndex + 1, offset: tagNameOffset } };
    }),
  ];
  const typeScriptServer = spawn(process.execPath, [editorTypeScriptServer, "--disableAutomaticTypingAcquisition"]);
  let serverOutput = "";
  const serverResponses = await new Promise<{ request_seq: number; body?: { documentation: string } }[]>((resolveResponses) => {
    typeScriptServer.stdout.on("data", (outputChunk: Buffer) => {
      serverOutput += outputChunk.toString();
      const parsedResponses = [...serverOutput.matchAll(/^\{.*\}$/gm)]
        .map((messageMatch) => JSON.parse(messageMatch[0]))
        .filter((serverMessage) => serverMessage.type === "response");
      if (parsedResponses.some((serverResponse) => serverResponse.request_seq === serverRequests.length)) resolveResponses(parsedResponses);
    });
    const requestLines = serverRequests.map((serverRequest, requestIndex) => JSON.stringify({ seq: requestIndex + 1, type: "request", ...serverRequest }));
    typeScriptServer.stdin.write(`${requestLines.join("\n")}\n`);
  });
  typeScriptServer.kill();
  return serverResponses
    .filter((serverResponse) => serverResponse.request_seq > 1)
    .toSorted((firstResponse, secondResponse) => firstResponse.request_seq - secondResponse.request_seq)
    .map((serverResponse) => serverResponse.body?.documentation);
}

// Edges of the first element for each selector on the current slide, in pixels of the canvas.
function measureOnCanvas(page: Page, elementSelectors: string[]) {
  return page.evaluate((selectorList) => {
    const canvasElement = document.querySelector<HTMLElement>("[data-canvas]")!;
    const canvasBox = canvasElement.getBoundingClientRect();
    const canvasScale = canvasBox.width / canvasElement.offsetWidth;
    return selectorList.map((elementSelector) => {
      const elementBox = document.querySelector(`[data-canvas] > [data-current] [data-content] > ${elementSelector}`)!.getBoundingClientRect();
      return {
        top: (elementBox.top - canvasBox.top) / canvasScale,
        bottom: (elementBox.bottom - canvasBox.top) / canvasScale,
        left: (elementBox.left - canvasBox.left) / canvasScale,
        right: (elementBox.right - canvasBox.left) / canvasScale,
      };
    });
  }, elementSelectors);
}

function listLitLines(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-canvas] > [data-current] [data-code-line]")].flatMap((lineElement, lineIndex) =>
      lineElement.hasAttribute("data-lit") ? [lineIndex + 1] : [],
    ),
  );
}

// Animations live on pseudo-elements and are sampled every frame: one look may come before the transition starts.
function collectTransitionAnimations(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolveAnimations) => {
        const seenAnimations = new Set<string>();
        const samplingStart = performance.now();
        const sampleAnimations = () => {
          for (const runningAnimation of document.getAnimations()) {
            seenAnimations.add(`${(runningAnimation.effect as KeyframeEffect).pseudoElement} ${(runningAnimation as CSSAnimation).animationName}`);
          }
          if (performance.now() - samplingStart < 500) requestAnimationFrame(sampleAnimations);
          else resolveAnimations([...seenAnimations]);
        };
        sampleAnimations();
      }),
  );
}

function listTransitionAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .map((runningAnimation) => `${(runningAnimation.effect as KeyframeEffect).pseudoElement} ${(runningAnimation as CSSAnimation).animationName}`),
  );
}

async function swipeAcross(page: Page, horizontalDistance: number, verticalDistance = 0) {
  const canvasElement = page.locator("[data-canvas]");
  const touchStart = { identifier: 1, clientX: 600, clientY: 300 };
  const touchEnd = { identifier: 1, clientX: 600 + horizontalDistance, clientY: 300 + verticalDistance };
  await canvasElement.dispatchEvent("touchstart", { touches: [touchStart], changedTouches: [touchStart] });
  await canvasElement.dispatchEvent("touchend", { touches: [], changedTouches: [touchEnd] });
}

async function jumpToSlide(page: Page, slideNumber: number) {
  await page.keyboard.type(String(slideNumber));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`#${slideNumber}$`));
}

test("демо листается, показывает шаги и навигатор, переживает перезагрузку и правку файла", async ({ page }) => {
  // Errors reach window as events, not as console lines: a ResizeObserver loop is one of them.
  const pageErrors: string[] = [];
  await page.exposeFunction("reportPageError", (errorMessage: string) => pageErrors.push(errorMessage));
  await page.addInitScript(() => addEventListener("error", (errorEvent) => (window as unknown as { reportPageError: (errorMessage: string) => void }).reportPageError(errorEvent.message)));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  // The demo opened with ?overview is the published showcase, so a new component has to appear in it.
  await test.step("каждый компонент движка есть в демо", async () => {
    const publicInterfaceSource = await readFile(publicInterfaceFile, "utf8");
    const componentNames = [...publicInterfaceSource.matchAll(/^export \{([^}]+)\}/gm)].flatMap((exportMatch) =>
      exportMatch[1]!.split(",").map((exportedName) => exportedName.trim()).filter((exportedName) => exportedName !== "" && !exportedName.startsWith("type ")),
    );
    const demoSource = await readFile(demoPresentationFile, "utf8");
    expect(componentNames.filter((componentName) => !demoSource.includes(`Machina.${componentName}`)), "компоненты, которых нет в демо").toEqual([]);
  });

  await test.step("обложка, тема и Tailwind", async () => {
    await expect(page).toHaveURL(/#1$/);
    await expect(page).toHaveTitle("slidemachina");
    await expect(currentSlide(page).locator("h1")).toHaveText("slidemachina");
    await expect(currentSlide(page)).toHaveAttribute("data-align", "center");
    await expect(currentSlide(page).locator("p")).toHaveCSS("color", "rgb(108, 112, 128)");
    await expect(currentSlide(page).locator("[data-slide-number]")).toHaveCount(0);
    // Trimmed to letters: the capitals of the title and the baseline of the lead stand evenly around the middle of the slide.
    const coverEdges = await measureOnCanvas(page, ["h1", "p"]);
    expect(coverEdges[0]!.top + coverEdges[1]!.bottom).toBeCloseTo(1080, 0);
  });

  await test.step("листание и шаги", async () => {
    await page.keyboard.press("PageDown");
    // The whole slide moves with its background and frame; the page root keeps only the letterbox.
    const movingLayerHeight = await page.evaluate(
      () =>
        new Promise<string>((resolveHeight) => {
          const waitForLayer = () => {
            const hasLayer = document.getAnimations().some((runningAnimation) => (runningAnimation.effect as KeyframeEffect).pseudoElement === "::view-transition-old(slide-out)");
            if (hasLayer) resolveHeight(getComputedStyle(document.documentElement, "::view-transition-group(slide-out)").height);
            else requestAnimationFrame(waitForLayer);
          };
          waitForLayer();
        }),
    );
    expect(movingLayerHeight, "уезжает весь слайд, а не только содержимое").toBe("1080px");
    expect(await collectTransitionAnimations(page)).toEqual(
      expect.arrayContaining(["::view-transition-old(slide-out) slidemachina-slide-out", "::view-transition-new(slide-in) slidemachina-slide-in"]),
    );
    await expect(page).toHaveURL(/#2$/);
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "slide");
    await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "forward");
    await expect(currentSlide(page).locator("h1")).toHaveText("Как устроено");
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");

    await page.keyboard.press("ArrowRight");
    const listItems = currentSlide(page).locator("li");
    await expect(listItems.and(page.locator("[data-step-reached]"))).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/#3\.1$/);
    await expect(listItems.nth(0)).toHaveAttribute("data-step-reached");
    await expect(listItems.nth(1)).not.toHaveAttribute("data-step-reached");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("PageDown");
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(/#4$/);
    await page.keyboard.press("PageUp");
    await expect(page).toHaveURL(/#3\.3$/);
    await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "backward");
    await expect(currentSlide(page).locator("[data-step-reached]")).toHaveCount(3);
    await expect(currentSlide(page).locator("[data-breadcrumbs]")).toHaveText("Как устроено");
  });

  await test.step("шаг с номером и крошки подраздела", async () => {
    await jumpToSlide(page, 5);
    await expect(currentSlide(page).locator("[data-breadcrumbs] span")).toHaveText(["Как устроено", "Шаги"]);
    await expect(currentSlide(page).locator("[data-slide-number]")).toHaveText("5");
    await page.keyboard.press("ArrowRight");
    await expect(currentSlide(page).locator("p")).toHaveAttribute("data-step-reached");
    await expect(currentSlide(page).locator("[data-step-effect=highlight]")).not.toHaveAttribute("data-step-reached");
  });

  await test.step("фон: цвет и картинка", async () => {
    await jumpToSlide(page, 9);
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");
    const darkSlideLogo = currentSlide(page).locator("[data-logo]");
    await expect(darkSlideLogo).toHaveAttribute("data-logo", "dark");
    await expect(darkSlideLogo).toHaveCSS("filter", "none");
    await jumpToSlide(page, 10);
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");
    await expect(currentSlide(page).locator("[data-logo], [data-breadcrumbs], [data-slide-number]")).toHaveCount(0);
  });

  await test.step("обложки: место текста, картинка сбоку, обтекание", async () => {
    await jumpToSlide(page, 11);
    const bottomLeftEdges = await measureOnCanvas(page, ["h1", "p"]);
    expect(bottomLeftEdges[0]!.left).toBeCloseTo(64, 0);
    expect(bottomLeftEdges[1]!.bottom).toBeCloseTo(1080 - 64, 0);
    await jumpToSlide(page, 12);
    const [leftPicture, titleBeside, leadBeside] = await measureOnCanvas(page, ["img", "h1", "p"]);
    expect(leftPicture!.left).toBeCloseTo(64, 0);
    expect(titleBeside!.left - leftPicture!.right).toBeCloseTo(64, 0);
    expect(leftPicture!.top + leftPicture!.bottom).toBeCloseTo(titleBeside!.top + leadBeside!.bottom, 0);
    await jumpToSlide(page, 13);
    const [rightTitle, , rightPicture] = await measureOnCanvas(page, ["h1", "p", "img"]);
    expect(rightPicture!.right).toBeCloseTo(1920 - 64, 0);
    expect(rightPicture!.left - rightTitle!.right).toBeCloseTo(64, 0);
    await jumpToSlide(page, 14);
    const [floatingPicture, wrappingText] = await measureOnCanvas(page, ["img", "p"]);
    expect(floatingPicture!.top, "верх картинки на линии заглавных букв").toBeCloseTo(wrappingText!.top, 0);
  });

  await test.step("блоки: колонки и строки таблицы по шагам, источник сноской под блоком", async () => {
    await jumpToSlide(page, 16);
    const columnElements = currentSlide(page).locator(".machina-columns > *");
    await expect(columnElements).toHaveCount(3);
    await expect(columnElements.and(page.locator("[data-step-reached]"))).toHaveCount(0);
    // data-step-effect on the columns goes to every column; the columns themselves stay visible.
    await expect(columnElements.and(page.locator("[data-step-effect=scale]"))).toHaveCount(3);
    await expect(currentSlide(page).locator(".machina-columns")).toHaveCSS("opacity", "1");
    await page.keyboard.press("ArrowRight");
    await expect(columnElements.nth(0)).toHaveAttribute("data-step-reached");
    await expect(columnElements.nth(1)).not.toHaveAttribute("data-step-reached");
    // The source is a footnote right under the blocks it cites, set apart by a hairline.
    const sourceElement = currentSlide(page).locator("[data-source]");
    const sourceBox = await sourceElement.boundingBox();
    const columnsBox = await currentSlide(page).locator(".machina-columns").boundingBox();
    const slideScale = (await currentSlide(page).boundingBox())!.height / 1080;
    expect(sourceBox!.y - (columnsBox!.y + columnsBox!.height)).toBeCloseTo(80 * slideScale, 0);
    await expect(sourceElement).toHaveCSS("border-top-width", "1px");

    await jumpToSlide(page, 17);
    await expect(currentSlide(page).locator("thead th")).toHaveCount(3);
    const tableRows = currentSlide(page).locator("tbody tr");
    await expect(tableRows).toHaveCount(4);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(tableRows.and(page.locator("[data-step-reached]"))).toHaveCount(2);
  });

  await test.step("картинка на свободное место и на весь слайд, видео играет только на своём слайде", async () => {
    await jumpToSlide(page, 18);
    const stretchedPicture = currentSlide(page).locator("[data-media-frame=stretch] img");
    await expect.poll(async () => (await stretchedPicture.boundingBox())?.height).toBeGreaterThan(300);
    const pictureBox = await stretchedPicture.boundingBox();
    const captionBox = await currentSlide(page).locator("figcaption").boundingBox();
    expect(captionBox!.y).toBeGreaterThan(pictureBox!.y + pictureBox!.height);
    // A caption inside the picture keeps to its left edge, not to the edge of the content.
    expect(captionBox!.x).toBeCloseTo(pictureBox!.x, 0);
    expect(pictureBox!.x).toBeGreaterThan((await currentSlide(page).locator("[data-content]").boundingBox())!.x + 50);

    await jumpToSlide(page, 19);
    const fullPictureBox = await currentSlide(page).locator("[data-media-frame=full] img").boundingBox();
    expect(fullPictureBox).toEqual(await currentSlide(page).boundingBox());

    await jumpToSlide(page, 20);
    const videoElement = page.locator("[data-canvas] > [data-slide] video");
    await expect.poll(() => videoElement.evaluate((pausedVideo: HTMLVideoElement) => pausedVideo.paused)).toBe(false);
    await jumpToSlide(page, 21);
    await expect.poll(() => videoElement.evaluate((pausedVideo: HTMLVideoElement) => pausedVideo.paused)).toBe(true);
    await expect(currentSlide(page).locator("figcaption")).toHaveText("Антуан де Сент-Экзюпери, «Планета людей»");
  });

  await test.step("код: подсветка при сборке, шрифт, строки по шагам с прокруткой", async () => {
    await jumpToSlide(page, 23);
    const codeElement = currentSlide(page).locator("[data-code]");
    await expect(codeElement).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(codeElement.locator("[data-code-token]").first()).toHaveAttribute("style", /--token-light: #[0-9A-Fa-f]{6}; --token-dark: #/);
    expect(await listLitLines(page)).toEqual([]);
    await page.keyboard.press("ArrowRight");
    expect(await listLitLines(page)).toEqual([4]);
    await page.keyboard.press("ArrowRight");
    expect(await listLitLines(page)).toEqual([5, 6, 7]);
    const loadedFiles = await page.evaluate(() => performance.getEntriesByType("resource").map((resourceEntry) => resourceEntry.name));
    expect(loadedFiles.filter((loadedFile) => /shiki|typograf/i.test(loadedFile))).toEqual([]);

    await jumpToSlide(page, 24);
    await expect(currentSlide(page).locator("[data-code-title]")).toHaveText("agent.py");
    expect(await listLitLines(page)).toEqual([10, 11, 12, 13]);
    // Numbers are file lines drawn by CSS: copying the code leaves them out.
    const numberedCode = await currentSlide(page).locator("[data-code]").evaluate((codeElement) => {
      const lineElements = [...codeElement.querySelectorAll<HTMLElement>("[data-code-line]")];
      const selectedCode = window.getSelection()!;
      selectedCode.selectAllChildren(codeElement.querySelector("code")!);
      const copiedText = selectedCode.toString();
      selectedCode.removeAllRanges();
      return {
        shownNumbers: lineElements.slice(0, 3).map((lineElement) => getComputedStyle(lineElement, "::before").content),
        copiedStart: copiedText.slice(0, 11),
      };
    });
    expect(numberedCode).toEqual({ shownNumbers: ['"1"', '"2"', '"3"'], copiedStart: "import json" });
    const codeViewport = currentSlide(page).locator("[data-code-viewport]");
    const firstScrollTop = await codeViewport.evaluate((scrolledViewport) => scrolledViewport.scrollTop);
    for (let stepPress = 0; stepPress < 4; stepPress += 1) await page.keyboard.press("ArrowRight");
    expect(await listLitLines(page)).toEqual([46, 47, 48]);
    await expect.poll(() => codeViewport.evaluate((scrolledViewport) => scrolledViewport.scrollTop)).toBeGreaterThan(firstScrollTop + 800);
    await expect(codeViewport).toHaveAttribute("data-clipped-top");
  });

  await test.step("морфинг кода: совпавшие куски переезжают, имена слоёв потом снимаются", async () => {
    await jumpToSlide(page, 25);
    await page.keyboard.press("PageDown");
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    expect(await collectTransitionAnimations(page)).toEqual(
        expect.arrayContaining([
          "::view-transition-group(code-piece-0-0) -ua-view-transition-group-anim-code-piece-0-0",
          "::view-transition-group(code-box-0) -ua-view-transition-group-anim-code-box-0",
        ]),
      );
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);
    await expect(page.locator("[style*=view-transition]")).toHaveCount(0);
    expect(await listLitLines(page)).toEqual([2, 3, 4]);
  });

  await test.step("типограф правит текст, но не код, кавычка в начале строки висит за краем", async () => {
    await jumpToSlide(page, 27);
    const typographedParagraph = currentSlide(page).locator(".machina-columns > div > p").last();
    // toHaveText folds non-breaking spaces into plain ones, so the raw text is read.
    expect(await typographedParagraph.textContent()).toMatch(/^«Кавычки» и\u00A0тире\u00A0— как\u00A0на\u00A0клавиатуре/);
    await expect(currentSlide(page).locator("[data-code]")).toContainText('"Кавычки" и тире - как на клавиатуре.');
    const hangingEdges = await typographedParagraph.evaluate((paragraphElement) => {
      const measureFirstCharacter = (textNode: Node) => {
        const characterRange = document.createRange();
        characterRange.setStart(textNode, 0);
        characterRange.setEnd(textNode, 1);
        return characterRange.getBoundingClientRect();
      };
      const markElement = paragraphElement.querySelector("[data-hanging-mark]")!;
      return {
        paragraphLeft: paragraphElement.getBoundingClientRect().left,
        markRight: measureFirstCharacter(markElement.firstChild!).right,
        letterLeft: measureFirstCharacter(markElement.nextSibling!).left,
      };
    });
    expect(hangingEdges.letterLeft).toBeCloseTo(hangingEdges.paragraphLeft, 0);
    expect(hangingEdges.markRight).toBeLessThanOrEqual(hangingEdges.paragraphLeft + 1);
  });

  await test.step("схемы: раскладка ELK в фоне, шаги держат место, фокус, морфинг и sequence", async () => {
    await jumpToSlide(page, 30);
    const diagramElement = currentSlide(page).locator("[data-diagram]");
    await expect(diagramElement).toHaveAttribute("data-laid-out");
    const loadedFiles = await page.evaluate(() => performance.getEntriesByType("resource").map((resourceEntry) => resourceEntry.name));
    expect(loadedFiles.filter((loadedFile) => loadedFile.endsWith("elk-worker.min.js"))).toHaveLength(1);
    const firstBoxBox = await diagramElement.locator("[data-box]").first().boundingBox();
    const contentBox = await currentSlide(page).locator("[data-content]").boundingBox();
    expect(firstBoxBox!.x).toBeCloseTo(contentBox!.x, 0);
    const hiddenBox = diagramElement.locator("[data-node-id=elk]");
    await expect(hiddenBox).toBeHidden();
    // Layout offsets, not the screen box: a hidden step is shifted down by its rise effect.
    const readPlace = () => hiddenBox.evaluate((placedBox: HTMLElement) => [placedBox.offsetLeft, placedBox.offsetTop, placedBox.offsetWidth]);
    const hiddenBoxPlace = await readPlace();
    for (let stepPress = 0; stepPress < 3; stepPress += 1) await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#30\.3$/);
    await expect(hiddenBox).toBeVisible();
    expect(await readPlace()).toEqual(hiddenBoxPlace);
    await expect(diagramElement.locator("[data-arrow-line]").first()).toHaveAttribute("d", /^M[\d.,]+ L/);

    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#31$/);
    const focusedDiagram = currentSlide(page).locator("[data-diagram]");
    await expect(focusedDiagram.locator("[data-focus]")).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect(focusedDiagram.locator("[data-node-id=build]")).toHaveAttribute("data-focus", "on");
    await expect(focusedDiagram.locator("[data-node-id=shiki]")).toHaveAttribute("data-focus", "on");
    await expect(focusedDiagram.locator("[data-node-id=react]")).toHaveAttribute("data-focus", "off");
    await page.keyboard.press("ArrowRight");
    await expect(focusedDiagram.locator("[data-node-id=react]")).toHaveAttribute("data-focus", "on");
    await expect(focusedDiagram.locator("[data-node-id=vite]")).toHaveAttribute("data-focus", "off");
    await page.keyboard.press("ArrowRight");
    await expect(focusedDiagram.locator("[data-focus]")).toHaveCount(0);

    await page.keyboard.press("ArrowRight");
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    const morphAnimations = await collectTransitionAnimations(page);
    expect(morphAnimations).toEqual(expect.arrayContaining(["::view-transition-group(morph-0) -ua-view-transition-group-anim-morph-0"]));
    // Arrows of both slides morph as pairs; only the arrows the new layout adds arrive on their own.
    expect(morphAnimations.some((morphAnimation) => morphAnimation.startsWith("::view-transition-new(apart-in-"))).toBe(true);
    expect(morphAnimations.some((morphAnimation) => morphAnimation.startsWith("::view-transition-old(apart-out-"))).toBe(false);
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);
    await expect(page.locator("[style*=view-transition]")).toHaveCount(0);

    // Arrow labels stay clear of every box and of every other label.
    const partBoxes = await currentSlide(page).evaluate((slideElement) =>
      [...slideElement.querySelectorAll("[data-box], [data-arrow-label]")].map((partElement) => ({
        isLabel: partElement.hasAttribute("data-arrow-label"),
        partFrame: partElement.getBoundingClientRect().toJSON() as DOMRect,
      })),
    );
    const overlaps = (firstBox: DOMRect, secondBox: DOMRect) =>
      firstBox.left < secondBox.right && secondBox.left < firstBox.right && firstBox.top < secondBox.bottom && secondBox.top < firstBox.bottom;
    const labelBoxes = partBoxes.filter((partFrame) => partFrame.isLabel);
    expect(labelBoxes).toHaveLength(2);
    for (const labelBox of labelBoxes) {
      const overlappedParts = partBoxes.filter((partFrame) => partFrame !== labelBox && overlaps(labelBox.partFrame, partFrame.partFrame));
      expect(overlappedParts).toEqual([]);
    }

    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#33$/);
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");
    const sequenceElement = currentSlide(page).locator("[data-sequence]");
    await expect(sequenceElement.locator("[data-actor]")).toHaveCount(3);
    const messageElements = sequenceElement.locator("[data-message]");
    await expect(messageElements).toHaveCount(5);
    await expect(messageElements.and(page.locator("[data-step-reached]"))).toHaveCount(0);
    for (let stepPress = 0; stepPress < 6; stepPress += 1) await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#33\.6$/);
    await expect(messageElements.nth(2)).toHaveAttribute("data-focus", "on");
    await expect(messageElements.nth(1)).toHaveAttribute("data-focus", "off");
    await expect(sequenceElement.locator("[data-actor]").first()).toHaveAttribute("data-focus", "off");
    const requestBox = await messageElements.nth(2).locator("[data-message-line]").boundingBox();
    const actorBoxes = await sequenceElement.locator("[data-actor] > [data-box]").evaluateAll((boxElements) =>
      boxElements.map((boxElement) => boxElement.getBoundingClientRect().toJSON() as DOMRect),
    );
    expect(requestBox!.x).toBeCloseTo(actorBoxes[1]!.x + actorBoxes[1]!.width / 2, 0);
    expect(requestBox!.x + requestBox!.width).toBeCloseTo(actorBoxes[2]!.x + actorBoxes[2]!.width / 2, 0);
  });

  await test.step("морфинг сам включается, когда у слайдов есть общие элементы", async () => {
    await jumpToSlide(page, 35);
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(/#36$/);
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    await page.keyboard.press("PageUp");
    await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "backward");
  });

  await test.step("морфинг по словам: общие слова едут, разметка возвращается как была", async () => {
    await jumpToSlide(page, 37);
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);
    // Two presses within one task: the skipped transition to 34 must not show 35 before the next snapshot.
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    });
    await expect(page).toHaveURL(/#39$/);
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    expect(await collectTransitionAnimations(page)).toEqual(
        expect.arrayContaining([
          "::view-transition-group(morph-word-0-0) -ua-view-transition-group-anim-morph-word-0-0",
          "::view-transition-group(morph-word-1-1) -ua-view-transition-group-anim-morph-word-1-1",
        ]),
      );
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);
    await expect(currentSlide(page).locator("h2")).toHaveText("Версия 0.2");
    await expect(currentSlide(page).locator("[data-content] span")).toHaveCount(0);
    await expect(page.locator("[style*=view-transition]")).toHaveCount(0);
  });

  await test.step("куб и переворот в обе стороны", async () => {
    await jumpToSlide(page, 40);
    await page.keyboard.press("PageDown");
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "cube");
    expect(await collectTransitionAnimations(page)).toEqual(expect.arrayContaining(["::view-transition-new(slide-in) slidemachina-cube-in"]));
    await page.keyboard.press("PageDown");
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "flip");
    // Back only after the flip has switched the slide: a press within the same frame never shows the flipped slide.
    await expect(page).toHaveURL(/#42$/);
    await page.keyboard.press("PageUp");
    await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "backward");
    expect(await collectTransitionAnimations(page)).toEqual(expect.arrayContaining(["::view-transition-old(slide-out) slidemachina-flip-out"]));
    await expect(page).toHaveURL(/#41$/);
  });

  await test.step("свайп листает, вертикальный жест и короткое касание — нет", async () => {
    await swipeAcross(page, -200);
    await expect(page).toHaveURL(/#42$/);
    await swipeAcross(page, 200);
    await expect(page).toHaveURL(/#41$/);
    await swipeAcross(page, -80, 200);
    await swipeAcross(page, -30);
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(/#42$/);
  });

  await test.step("чёрный экран закрывает всё, и Agentation тоже", async () => {
    // Agentation is off in tests; a stand-in with its class shows whether the black screen hides it.
    await page.evaluate(() => document.body.append(Object.assign(document.createElement("div"), { className: "slidemachina-feedback" })));
    const feedbackStandIn = page.locator("body > .slidemachina-feedback");
    await page.keyboard.press("b");
    await expect(page.locator("[data-blackout]")).toBeVisible();
    await expect(feedbackStandIn).toHaveCSS("visibility", "hidden");
    await page.keyboard.press("Period");
    await expect(page.locator("[data-blackout]")).toHaveCount(0);
    await page.mouse.move(640, 300);
    await expect(feedbackStandIn).toHaveCSS("visibility", "visible");
  });

  await test.step("навигатор", async () => {
    await page.keyboard.press("o");
    const slideNavigator = page.locator("[data-navigator]");
    await expect(slideNavigator.locator("[data-thumbnail]")).toHaveCount(63);
    // One of the two dark steps of the theme, the same as the dark slides: --dark-background.
    await expect(slideNavigator).toHaveCSS("background-color", "rgb(20, 22, 29)");
    await expect(slideNavigator.locator("[data-thumbnail-number]").nth(41)).toHaveText("42");
    const firstThumbnailBox = await slideNavigator.locator("[data-thumbnail]").first().boundingBox();
    // Six columns on a 16:9 screen: 1920 logical pixels give thumbnails of 240–280.
    expect(firstThumbnailBox!.width / (await page.locator("[data-canvas]").boundingBox())!.width).toBeCloseTo(268 / 1920, 2);
    await expect(slideNavigator.locator("[data-thumbnail][data-selected]")).toContainText("Переворот");
    await expect(slideNavigator.locator("[data-navigator-heading]").nth(1).locator("span")).toHaveText(["Как устроено", "Шаги"]);
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(slideNavigator).toHaveCount(0);
    await expect(page).toHaveURL(/#2$/);
    await page.keyboard.press("Escape");
    await slideNavigator.locator("[data-thumbnail]").nth(42).click();
    await expect(page).toHaveURL(/#43$/);
    await expect(currentSlide(page).locator("[data-breadcrumbs]")).toHaveText("Шпаргалка");
    // The editor hovers the same slide in index.tsx and names the number from the corner of the slide.
    const cornerNumber = await currentSlide(page).locator("[data-slide-number]").textContent();
    expect(await askEditorHints(['<Machina.Section title="Управление"', '<Machina.Slide breadcrumbs="Шпаргалка"'])).toEqual([
      `Раздел 07 · слайд ${cornerNumber} · #${cornerNumber}`,
      `Слайд ${cornerNumber} · #${cornerNumber}`,
    ]);
    await page.mouse.move(640, 300);
    const navigatorButton = page.getByRole("button", { name: "Все слайды · Esc" });
    await navigatorButton.click();
    await expect(slideNavigator).toBeVisible();
    await expect(page).toHaveURL(/\/\?overview#43$/);
    await navigatorButton.click();
    await expect(slideNavigator).toHaveCount(0);
    await expect(page).toHaveURL(/\/#43$/);
    const feedbackStandIn = page.locator("body > .slidemachina-feedback");
    await page.getByRole("button", { name: "Скрыть панель · H" }).click();
    await expect(navigatorButton).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Показать панель · H" })).toBeVisible();
    await expect(feedbackStandIn).toHaveCSS("visibility", "hidden");
    await page.keyboard.press("h");
    await expect(navigatorButton).toBeVisible();
    await expect(feedbackStandIn).toHaveCSS("visibility", "visible");
    const overviewPage = await page.context().newPage();
    await overviewPage.goto("/?overview");
    await expect(overviewPage.locator("[data-navigator] [data-thumbnail]")).toHaveCount(63);
    await overviewPage.keyboard.press("Escape");
    await expect(overviewPage.locator("[data-navigator]")).toHaveCount(0);
    await overviewPage.close();
  });

  await test.step("панель гаснет без движения мыши и возвращается при движении, Agentation — вместе с ней", async () => {
    const presentationToolbar = page.locator("[data-toolbar]");
    const feedbackStandIn = page.locator("body > .slidemachina-feedback");
    await page.mouse.move(600, 300);
    await expect(presentationToolbar).not.toHaveAttribute("data-idle");
    await page.waitForTimeout(1500);
    await expect(presentationToolbar).not.toHaveAttribute("data-idle");
    await expect(presentationToolbar).toHaveAttribute("data-idle", { timeout: 1500 });
    await expect(presentationToolbar).toHaveCSS("opacity", "0");
    await expect(feedbackStandIn).toHaveCSS("visibility", "hidden");
    await page.mouse.move(620, 320);
    await expect(presentationToolbar).not.toHaveAttribute("data-idle");
    await expect(presentationToolbar).toHaveCSS("opacity", "1");
    await expect(feedbackStandIn).toHaveCSS("visibility", "visible");
    await feedbackStandIn.evaluate((standInElement) => standInElement.remove());
  });

  await test.step("3D-сцена: кадр готов до перехода, шаги двигают объекты, анимируется только текущий слайд", async () => {
    await jumpToSlide(page, 52);
    const heroCanvas = page.locator("[data-canvas] > [data-slide]").nth(52).locator("[data-scene-canvas]");
    // The next slide is hidden, yet its still frame is drawn: the transition snapshot is never empty.
    await expect.poll(async () => (await sampleSceneCanvas(heroCanvas)).paintedPixels, { timeout: 10_000 }).toBeGreaterThan(400);
    const stillFrame = (await sampleSceneCanvas(heroCanvas)).frameFingerprint;
    await page.waitForTimeout(300);
    expect((await sampleSceneCanvas(heroCanvas)).frameFingerprint, "сцена на скрытом слайде стоит").toBe(stillFrame);
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(/#53$/);
    await expect.poll(async () => (await sampleSceneCanvas(heroCanvas)).frameFingerprint, { message: "камера облетает сцену" }).not.toBe(stillFrame);

    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(/#54$/);
    const stepCanvas = currentSlide(page).locator("[data-scene-canvas]");
    await expect.poll(async () => (await sampleSceneCanvas(stepCanvas)).paintedPixels).toBeGreaterThan(100);
    const cubeOnlyPixels = (await sampleSceneCanvas(stepCanvas)).paintedPixels;
    await page.keyboard.press("PageDown");
    await expect(currentSlide(page).locator("[data-scene-step][data-step-reached]")).toHaveCount(1);
    await expect.poll(async () => (await sampleSceneCanvas(stepCanvas)).paintedPixels, { message: "сфера появилась" }).toBeGreaterThan(cubeOnlyPixels * 1.3);
    await page.keyboard.press("o");
    const sceneThumbnail = page.locator("[data-navigator] [data-thumbnail]").nth(53).locator("[data-scene-canvas]");
    await expect.poll(async () => (await sampleSceneCanvas(sceneThumbnail)).paintedPixels).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
  });

  await test.step("перезагрузка оставляет на том же шаге", async () => {
    await page.goto("/#6");
    await expect(currentSlide(page).locator("li[data-step]").first()).toBeHidden();
    await page.goto("/#6.3");
    await page.reload();
    await expect(currentSlide(page).locator("h2")).toHaveText("Эффекты шагов");
    await expect(currentSlide(page).locator("[data-step-reached]")).toHaveCount(3);
  });

  await test.step("правка index.tsx обновляет слайд без перезагрузки", async () => {
    await editFileWhile(
      demoPresentationFile,
      (originalPresentation) => originalPresentation.replace("Эффекты шагов", "Эффекты шагов после правки"),
      async () => {
        await expect(currentSlide(page).locator("h2")).toHaveText("Эффекты шагов после правки");
        await expect(page).toHaveURL(/#6\.3$/);
        await expect(currentSlide(page).locator("[data-step-reached]")).toHaveCount(3);
        expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
      },
    );
    await expect(currentSlide(page).locator("h2")).toHaveText("Эффекты шагов");
  });

  // File edits go last: a late hot update in the middle of a morph would make the transition steps flaky.
  await test.step("правка файла с кодом обновляет слайд без перезагрузки", async () => {
    await page.goto("/#24.4");
    await editFileWhile(
      demoCodeFile,
      (originalCode) => originalCode.replace("Which files are in the examples folder?", "Какие файлы в папке?"),
      () => expect(currentSlide(page).locator("[data-code]")).toContainText("Какие файлы в папке?"),
    );
    await expect(currentSlide(page).locator("[data-code]")).toContainText("Which files are in the examples folder?");
    await expect(page).toHaveURL(/#24\.4$/);
    expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
  });

  await test.step("typography={false} выключает типограф", async () => {
    await jumpToSlide(page, 27);
    const typographedParagraph = currentSlide(page).locator(".machina-columns > div > p").last();
    await editFileWhile(
      demoPresentationFile,
      (originalPresentation) => originalPresentation.replace('<Machina.Presentation title="slidemachina"', '<Machina.Presentation typography={false} title="slidemachina"'),
      () => expect(typographedParagraph).toHaveText(/^"Кавычки" и тире - как на клавиатуре/),
    );
    await expect(typographedParagraph).toHaveText(/^«Кавычки»/);
  });

  const setAspectRatio = (aspectRatio: string) => (originalPresentation: string) =>
    originalPresentation.replace('<Machina.Presentation title="slidemachina"', `<Machina.Presentation aspectRatio="${aspectRatio}" title="slidemachina"`);

  await test.step("формат 16:9 по умолчанию и 9:16: окно меняет только масштаб, остальное — поля", async () => {
    const canvasElement = page.locator("[data-canvas]");
    await page.setViewportSize({ width: 1024, height: 1024 });
    await expect(canvasElement).toHaveCSS("width", "1920px");
    await expect(canvasElement).toHaveCSS("height", "1080px");
    await expect.poll(async () => Math.round((await canvasElement.boundingBox())!.height)).toBe(576);
    await editFileWhile(demoPresentationFile, setAspectRatio("9:16"), async () => {
      await expect(canvasElement).toHaveCSS("height", "1920px");
      await expect(canvasElement).toHaveCSS("width", "1080px");
      await expect.poll(async () => Math.round((await canvasElement.boundingBox())!.width)).toBe(576);
    });
    await expect(canvasElement).toHaveCSS("width", "1920px");
  });

  await test.step("вёрстка на 4:3: код не обрезан, числа не слипаются, схемы занимают свободное место", async () => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await editFileWhile(demoPresentationFile, setAspectRatio("4:3"), async () => {
      await expect(page.locator("[data-canvas]")).toHaveCSS("width", "1440px");
      await page.waitForTimeout(500);
      const layoutProblems = await page.evaluate(() => {
        const foundProblems: string[] = [];
        const describeSlide = (blockElement: Element) => `слайд ${[...document.querySelectorAll("[data-canvas] > [data-slide]")].indexOf(blockElement.closest("[data-slide]")!) + 1}`;
        for (const codeViewport of document.querySelectorAll<HTMLElement>("[data-canvas] > [data-slide] [data-code-viewport]")) {
          const roomElement = codeViewport.closest(".machina-columns > div, [data-content]")!;
          const codeRight = codeViewport.closest("[data-code]")!.getBoundingClientRect().right;
          if (codeViewport.scrollWidth > codeViewport.clientWidth + 1) foundProblems.push(`${describeSlide(codeViewport)}: код прокручивается`);
          if (codeRight > roomElement.getBoundingClientRect().right + 1) foundProblems.push(`${describeSlide(codeViewport)}: код шире своей области`);
          const textLine = roomElement.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(roomElement).paddingLeft);
          const codeStart = codeViewport.querySelector("[data-code-line]")!.getBoundingClientRect().left;
          const hangsCode = !codeViewport.closest("[data-align='center']");
          if (hangsCode && Math.abs(codeStart - textLine) > 1) foundProblems.push(`${describeSlide(codeViewport)}: код не на линии текста`);
        }
        for (const numberElement of document.querySelectorAll<HTMLElement>("[data-canvas] > [data-slide] .machina-big-number > p")) {
          const numberRange = document.createRange();
          numberRange.selectNodeContents(numberElement);
          if (numberRange.getBoundingClientRect().right > numberElement.parentElement!.getBoundingClientRect().right + 1) {
            foundProblems.push(`${describeSlide(numberElement)}: число «${numberElement.textContent}» шире колонки`);
          }
        }
        for (const diagramElement of document.querySelectorAll<HTMLElement>("[data-canvas] > [data-slide] [data-diagram]")) {
          const diagramBox = diagramElement.getBoundingClientRect();
          const roomFrame = diagramElement.parentElement!.getBoundingClientRect();
          const takesWidth = diagramBox.width >= roomFrame.width * 0.9;
          const takesHeight = diagramBox.height >= (roomFrame.bottom - diagramBox.top) * 0.9;
          if (!takesWidth && !takesHeight) foundProblems.push(`${describeSlide(diagramElement)}: схема не заняла свободное место`);
        }
        return foundProblems;
      });
      expect(layoutProblems).toEqual([]);
    });
    expect(pageErrors).toEqual([]);
  });
});
