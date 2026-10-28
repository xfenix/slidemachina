import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { sampleSceneCanvas } from "./scene-sampling.ts";
import { currentSlide, findSlideNumber, workspaceFolder } from "./test-helpers.ts";

// playwright.config.ts serves a copy of the demo: edits here never reach the real files or the dev server on 5173.
const demoCopyFolder = process.env.SLIDEMACHINA_TEST_DEMO_COPY!;
const demoPresentationFile = path.join(demoCopyFolder, "index.tsx");
const demoCodeFile = path.join(demoCopyFolder, "agent.py");
const publicInterfaceFile = path.join(workspaceFolder, "packages", "slidemachina", "browser-runtime", "slidemachina.ts");

async function editFileWhile(filePath: string, editText: (originalText: string) => string, checkEditedPage: () => Promise<void>) {
  const originalText = await readFile(filePath, "utf8");
  try {
    await writeFile(filePath, editText(originalText));
    await checkEditedPage();
  } finally {
    await writeFile(filePath, originalText);
  }
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
            seenAnimations.add(`${(runningAnimation.effect as KeyframeEffect).pseudoElement} ${(runningAnimation instanceof CSSAnimation ? runningAnimation.animationName : runningAnimation.id)}`);
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
      .map((runningAnimation) => `${(runningAnimation.effect as KeyframeEffect).pseudoElement} ${(runningAnimation instanceof CSSAnimation ? runningAnimation.animationName : runningAnimation.id)}`),
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

async function jumpToHeading(page: Page, headingText: string) {
  const slideNumber = await findSlideNumber(page, ":is(h1, h2)", headingText);
  await jumpToSlide(page, slideNumber);
  return slideNumber;
}

test("демо листается, показывает шаги и навигатор, переживает перезагрузку и правку файла", async ({ page }) => {
  // One run walks the whole demo and takes about 30 seconds, the default limit.
  test.setTimeout(60_000);
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
    // No title on <Presentation>: the tab reads the h1 of the opening cover, typographed like the slide.
    await expect(page).toHaveTitle(/^Слайды из\sкода$/);
    await expect(currentSlide(page).locator("h1")).toHaveText("Слайды из кода");
    await expect(currentSlide(page)).toHaveAttribute("data-align", "center");
    await expect(currentSlide(page).locator("p")).toHaveCSS("color", "rgb(108, 112, 128)");
    await expect(currentSlide(page).locator("[data-slide-number]")).toHaveCount(0);
    // The logo above the title and the baseline of the lead stand evenly around the middle of the slide.
    const coverEdges = await measureOnCanvas(page, ["[data-logo]", "p"]);
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
    await expect(currentSlide(page).locator("h1")).toHaveText("Зачем");
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");

    const listSlideNumber = await jumpToHeading(page, "Вся презентация в одном файле");
    const listItems = currentSlide(page).locator("li");
    await expect(listItems.and(page.locator("[data-step-reached]"))).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(new RegExp(`#${listSlideNumber}\\.1$`));
    await expect(listItems.nth(0)).toHaveAttribute("data-step-reached");
    await expect(listItems.nth(1)).not.toHaveAttribute("data-step-reached");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("PageDown");
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(new RegExp(`#${listSlideNumber + 1}$`));
    await page.keyboard.press("PageUp");
    await expect(page).toHaveURL(new RegExp(`#${listSlideNumber}\\.3$`));
    await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "backward");
    await expect(currentSlide(page).locator("[data-step-reached]")).toHaveCount(3);
    await expect(currentSlide(page).locator("[data-breadcrumbs]")).toHaveText("Как устроено");
  });

  await test.step("шаг с номером и крошки подраздела", async () => {
    const stepsSlideNumber = await jumpToHeading(page, "Рассказ по шагам");
    await expect(currentSlide(page).locator("[data-breadcrumbs] span")).toHaveText(["Как устроено", "Шаги"]);
    await expect(currentSlide(page).locator("[data-slide-number]")).toHaveText(String(stepsSlideNumber));
    await page.keyboard.press("ArrowRight");
    await expect(currentSlide(page).locator("p")).toHaveAttribute("data-step-reached");
    await expect(currentSlide(page).locator("[data-step-effect=highlight]")).not.toHaveAttribute("data-step-reached");
  });

  await test.step("фон: цвет и картинка", async () => {
    await jumpToHeading(page, "Тёмный фон");
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");
    const darkSlideLogo = currentSlide(page).locator("[data-logo]");
    await expect(darkSlideLogo).toHaveAttribute("data-logo", "dark");
    await expect(darkSlideLogo).toHaveCSS("filter", "none");
    await jumpToHeading(page, "Картинка на весь слайд");
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");
    await expect(currentSlide(page).locator("[data-logo], [data-breadcrumbs], [data-slide-number]")).toHaveCount(0);
  });

  await test.step("обложки: место текста, картинка сбоку", async () => {
    await jumpToHeading(page, "Итоги квартала");
    const bottomLeftEdges = await measureOnCanvas(page, ["h1", ".machina-note"]);
    expect(bottomLeftEdges[0]!.left).toBeCloseTo(64, 0);
    expect(bottomLeftEdges[1]!.bottom).toBeCloseTo(1080 - 64, 0);
    await jumpToHeading(page, "Сто слайдов за минуту");
    const [leftPicture, titleBeside, leadBeside] = await measureOnCanvas(page, ["img", "h1", "p"]);
    expect(leftPicture!.left).toBeCloseTo(64, 0);
    expect(titleBeside!.left - leftPicture!.right).toBeCloseTo(96, 0);
    expect(leftPicture!.top + leftPicture!.bottom).toBeCloseTo(titleBeside!.top + leadBeside!.bottom, 0);
    await jumpToHeading(page, "Метрики продукта");
    const [rightTitle, , rightPicture] = await measureOnCanvas(page, ["h1", "p", "img"]);
    expect(rightPicture!.right).toBeCloseTo(1920 - 64, 0);
    expect(rightPicture!.left - rightTitle!.right).toBeCloseTo(96, 0);
    // A picture across the bottom edge is a band: valign="bottom" puts the text the gap under a heading above it.
    await jumpToSlide(page, await findSlideNumber(page, "p", "Над полосой справа снизу: align=\"right\", valign=\"bottom\""));
    const [bandLead, bandPicture] = await measureOnCanvas(page, [".machina-lead", ".machina-pin-left"]);
    expect(Math.abs(bandPicture!.top - bandLead!.bottom - 80)).toBeLessThan(2);
  });

  await test.step("блоки: колонки и строки таблицы по шагам, источник сноской под блоком", async () => {
    await jumpToHeading(page, "Коротко в цифрах");
    const columnElements = currentSlide(page).locator(".machina-columns > *");
    await expect(columnElements).toHaveCount(3);
    await expect(columnElements.and(page.locator("[data-step-reached]"))).toHaveCount(0);
    // data-step-effect on the columns goes to every column; the columns themselves stay visible.
    await expect(columnElements.and(page.locator("[data-step-effect=scale]"))).toHaveCount(3);
    await expect(currentSlide(page).locator(".machina-columns")).toHaveCSS("opacity", "1");
    await page.keyboard.press("ArrowRight");
    await expect(columnElements.nth(0)).toHaveAttribute("data-step-reached");
    await expect(columnElements.nth(1)).not.toHaveAttribute("data-step-reached");
    // The source is a footnote one block gap under the baseline of the blocks it cites, set apart by a hairline across them.
    const sourceElement = currentSlide(page).locator(".machina-source");
    const sourceBox = await sourceElement.boundingBox();
    const columnsBox = await currentSlide(page).locator(".machina-columns").boundingBox();
    const slideScale = (await currentSlide(page).boundingBox())!.height / 1080;
    expect(sourceBox!.y - (columnsBox!.y + columnsBox!.height)).toBeCloseTo(40 * slideScale, 0);
    expect(sourceBox!.width).toBeCloseTo(columnsBox!.width, 0);
    await expect(sourceElement).toHaveCSS("border-top-width", "1px");

    await jumpToHeading(page, "Сборка");
    await expect(currentSlide(page).locator("thead th")).toHaveCount(3);
    const tableRows = currentSlide(page).locator("tbody tr");
    await expect(tableRows).toHaveCount(4);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(tableRows.and(page.locator("[data-step-reached]"))).toHaveCount(2);

    await jumpToHeading(page, "Что вы получаете");
    const optionHeadings = currentSlide(page).locator("table.machina-compare thead th:not(:first-child)");
    const optionWidths = await optionHeadings.evaluateAll((headingElements) => headingElements.map((headingElement) => Math.round(headingElement.getBoundingClientRect().width)));
    expect(new Set(optionWidths).size, "решения в колонках равной ширины").toBe(1);
    // The whole table is one face and one size; only the head is muted.
    const tableTextStyles = await currentSlide(page).locator("table :is(th, td)").evaluateAll((cellElements) =>
      cellElements.map((cellElement) => {
        const cellStyle = getComputedStyle(cellElement);
        return { faceAndSize: `${cellStyle.fontWeight} ${cellStyle.fontSize}`, textColor: cellStyle.color };
      }),
    );
    expect(new Set(tableTextStyles.map((tableTextStyle) => tableTextStyle.faceAndSize)).size, "одно начертание и кегль").toBe(1);
    expect(new Set(tableTextStyles.map((tableTextStyle) => tableTextStyle.textColor)).size, "основной цвет и приглушённый у шапки").toBe(2);
  });

  await test.step("картинка на свободное место, обтекание и на весь слайд, видео играет только на своём слайде", async () => {
    // The list screenshot is narrower than the free place, so the caption is seen keeping to the picture, not to the content.
    await jumpToHeading(page, "Список презентаций");
    const stretchedPicture = currentSlide(page).locator("[data-media-frame=stretch] img");
    await expect.poll(async () => (await stretchedPicture.boundingBox())?.height).toBeGreaterThan(300);
    const pictureBox = await stretchedPicture.boundingBox();
    const captionBox = await currentSlide(page).locator("figcaption").boundingBox();
    expect(captionBox!.y).toBeGreaterThan(pictureBox!.y + pictureBox!.height);
    // A caption inside the picture keeps to its left edge, not to the edge of the content.
    expect(captionBox!.x).toBeCloseTo(pictureBox!.x, 0);
    expect(pictureBox!.x).toBeGreaterThan((await currentSlide(page).locator("[data-content]").boundingBox())!.x + 50);

    await jumpToHeading(page, "Текст обтекает картинку");
    const [floatingPicture, wrappingText] = await measureOnCanvas(page, ["img", "p"]);
    expect(floatingPicture!.top, "верх картинки на линии заглавных букв").toBeCloseTo(wrappingText!.top, 0);

    // The same picture grows from the float to the full slide: its snapshot morphs, it is not drawn as an empty shape.
    await jumpToSlide(page, (await findSlideNumber(page, "[data-media-frame=full] img")) - 1);
    await page.keyboard.press("ArrowRight");
    // Its layer group rounds both snapshots, so the corners turn square smoothly instead of at the swap of snapshots.
    expect(await collectTransitionAnimations(page)).toEqual(
      expect.arrayContaining(["::view-transition-new(morph-0) -ua-view-transition-fade-in", "::view-transition-group(morph-0) slidemachina-shape-paint"]),
    );
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);
    const fullPictureBox = await currentSlide(page).locator("[data-media-frame=full] img").boundingBox();
    expect(fullPictureBox).toEqual(await currentSlide(page).boundingBox());

    await jumpToHeading(page, "Видео на весь слайд");
    const videoElement = page.locator("[data-canvas] > [data-slide] video[data-media]");
    await expect.poll(() => videoElement.evaluate((pausedVideo: HTMLVideoElement) => pausedVideo.paused)).toBe(false);
    await jumpToSlide(page, await findSlideNumber(page, "blockquote"));
    await expect.poll(() => videoElement.evaluate((pausedVideo: HTMLVideoElement) => pausedVideo.paused)).toBe(true);
    await expect(currentSlide(page).locator("figcaption")).toHaveText("Антуан де Сент-Экзюпери, «Планета людей»");
    // The author stands the gap under a heading below the last baseline of the quote, further than the lines of the quote from each other.
    const [quoteText, quoteAuthor] = await measureOnCanvas(page, ["figure > blockquote", "figure > figcaption"]);
    expect(Math.abs(quoteAuthor!.top - quoteText!.bottom - 80)).toBeLessThan(1);
  });

  await test.step("свободная вёрстка: в рамке под заголовком до низа области, на весь слайд — от края до края", async () => {
    await jumpToHeading(page, "Свободная вёрстка в рамке");
    const freeformBox = (await currentSlide(page).locator(".machina-freeform").boundingBox())!;
    const contentBox = (await currentSlide(page).locator("[data-content]").boundingBox())!;
    const headingBox = (await currentSlide(page).locator("h2").boundingBox())!;
    expect(freeformBox.y).toBeGreaterThan(headingBox.y + headingBox.height);
    expect(freeformBox.y + freeformBox.height).toBeCloseTo(contentBox.y + contentBox.height, 0);
    expect(freeformBox.width).toBeCloseTo(contentBox.width, 0);
    await expect(currentSlide(page).locator(".machina-freeform")).toHaveCSS("text-box-trim", "none");
    await expect(currentSlide(page).locator("[data-slide-number]")).toHaveCount(1);

    await jumpToHeading(page, "Слайд без правил");
    expect(await currentSlide(page).locator(".machina-freeform-full").boundingBox()).toEqual(await currentSlide(page).boundingBox());
    await expect(currentSlide(page)).toHaveCSS("background-color", "rgb(2, 3, 10)");
    const sunriseCanvas = currentSlide(page).locator(".machina-freeform-full canvas");
    await expect(sunriseCanvas).toHaveJSProperty("width", 1280);
    // In development React runs effects twice: a canvas whose WebGL context was lost paints white over the slide.
    await expect.poll(async () => (await sampleSceneCanvas(sunriseCanvas)).paintedPixels, { message: "шейдер рисует Землю" }).toBeGreaterThan(250);
    const slidePictureWidths = await currentSlide(page).locator("img").evaluateAll((pictureElements: HTMLImageElement[]) => pictureElements.map(({ naturalWidth }) => naturalWidth));
    expect(slidePictureWidths, "на слайде нет битых картинок").not.toContain(0);
  });

  await test.step("мем: подписи — текст в полях шаблона, шрифт Oswald подогнан под поле", async () => {
    await jumpToSlide(page, await findSlideNumber(page, "[data-meme-field] > p", "Извольте вставить мем"));
    const memeElement = currentSlide(page).locator("[data-meme]");
    await expect(memeElement.locator("img")).toHaveJSProperty("complete", true);
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 40px "Oswald Variable"', "Мем"))).toBe(true);
    const memeBox = (await memeElement.boundingBox())!;
    // jd/config.yml: two bands a fifth of the picture high, at the top and from 0.8 down.
    for (const [fieldIndex, fieldTopShare] of [0, 0.8].entries()) {
      const fieldElement = memeElement.locator("[data-meme-field]").nth(fieldIndex);
      const fieldBox = (await fieldElement.boundingBox())!;
      expect(fieldBox.y - memeBox.y).toBeCloseTo(memeBox.height * fieldTopShare, 0);
      expect(fieldBox.height).toBeCloseTo(memeBox.height * 0.2, 0);
      const captionBox = (await fieldElement.locator("p").boundingBox())!;
      expect(captionBox.y).toBeGreaterThanOrEqual(fieldBox.y);
      expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(fieldBox.y + fieldBox.height);
      expect(await fieldElement.locator("p").evaluate((captionElement) => captionElement.scrollWidth <= captionElement.clientWidth)).toBe(true);
      expect(Number.parseFloat(await fieldElement.evaluate((fieldNode: HTMLElement) => fieldNode.style.fontSize))).toBeGreaterThan(40);
    }
    await expect(memeElement.locator("[data-meme-field] > p").first()).toHaveText("Извольте вставить мем");
    await expect(memeElement.locator("[data-meme-field] > p").first()).toHaveCSS("text-transform", "uppercase");

    // A floated meme gets the height left under the list: it ends on the bottom line of the content, clear of the slide number.
    await jumpToHeading(page, "Мем настраивается в теге");
    const floatedMemeBox = (await currentSlide(page).locator("[data-meme]").boundingBox())!;
    const contentBox = (await currentSlide(page).locator("[data-content]").boundingBox())!;
    expect(floatedMemeBox.y + floatedMemeBox.height).toBeLessThanOrEqual(contentBox.y + contentBox.height + 1);
  });

  await test.step("код: подсветка при сборке, шрифт, строки по шагам с прокруткой", async () => {
    await jumpToHeading(page, "Строки по шагам");
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

    await jumpToHeading(page, "Код из файла");
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
    await jumpToHeading(page, "Морфинг кода");
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

  await test.step("типограф правит текст, но не код, длинные слова переносит браузер, кавычка в начале строки висит за краем", async () => {
    await jumpToHeading(page, "Типограф");
    const typographedParagraph = currentSlide(page).locator(".machina-columns > div > p").last();
    // toHaveText folds non-breaking spaces into plain ones, so the raw text is read.
    expect(await typographedParagraph.textContent()).toMatch(/^«Кавычки» станут ёлочками, дефис\u00A0— тире/);
    // Words break by the browser's dictionary: no soft hyphens in the text, nothing to strip on copy. Headings keep words whole.
    await expect(typographedParagraph).toHaveCSS("hyphens", "auto");
    await expect(currentSlide(page).locator("h2")).toHaveCSS("hyphens", "manual");
    expect(await page.locator("[data-canvas]").textContent()).not.toContain("\u00AD");
    await expect(currentSlide(page).locator("[data-code]")).toContainText('"Кавычки" станут ёлочками, дефис - тире.');
    // Technical words in plain text keep their spelling: the address part ?print and a place in a file.
    const listedTexts = (await page.locator("[data-canvas] li").allTextContents()).join("\n");
    expect(listedTexts).toContain("?print");
    expect(listedTexts).toContain("index.tsx:42:7");
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
    const diagramSlideNumber = await jumpToHeading(page, "Схема собирается по шагам");
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
    await expect(page).toHaveURL(new RegExp(`#${diagramSlideNumber}\\.3$`));
    await expect(hiddenBox).toBeVisible();
    expect(await readPlace()).toEqual(hiddenBoxPlace);
    await expect(diagramElement.locator("[data-arrow-line]").first()).toHaveAttribute("d", /^M[\d.,]+ L/);

    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(new RegExp(`#${diagramSlideNumber + 1}$`));
    const focusedDiagram = currentSlide(page).locator("[data-diagram]");
    await expect(focusedDiagram.locator("[data-focus]")).toHaveCount(0);
    // Groups side by side start on one line, and a diagram almost as wide as the content reaches its right edge.
    const groupBoxes = await focusedDiagram.locator("[data-group]").evaluateAll((groupElements) =>
      groupElements.map((groupElement) => groupElement.getBoundingClientRect().toJSON() as DOMRect),
    );
    expect(groupBoxes[0]!.top).toBeCloseTo(groupBoxes[1]!.top, 0);
    expect(groupBoxes[1]!.right).toBeCloseTo(contentBox!.x + contentBox!.width, 0);
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
    await expect(page).toHaveURL(new RegExp(`#${diagramSlideNumber + 3}$`));
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");
    const sequenceElement = currentSlide(page).locator("[data-sequence]");
    await expect(sequenceElement.locator("[data-actor]")).toHaveCount(3);
    const messageElements = sequenceElement.locator("[data-message]");
    await expect(messageElements).toHaveCount(5);
    await expect(messageElements.and(page.locator("[data-step-reached]"))).toHaveCount(0);
    for (let stepPress = 0; stepPress < 6; stepPress += 1) await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(new RegExp(`#${diagramSlideNumber + 3}\\.6$`));
    await expect(messageElements.nth(2)).toHaveAttribute("data-focus", "on");
    await expect(messageElements.nth(1)).toHaveAttribute("data-focus", "off");
    await expect(sequenceElement.locator("[data-actor]").first()).toHaveAttribute("data-focus", "off");
    const requestBox = await messageElements.nth(2).locator("[data-message-line]").boundingBox();
    const actorBoxes = await sequenceElement.locator("[data-actor] > [data-box]").evaluateAll((boxElements) =>
      boxElements.map((boxElement) => boxElement.getBoundingClientRect().toJSON() as DOMRect),
    );
    expect(requestBox!.x).toBeCloseTo(actorBoxes[1]!.x + actorBoxes[1]!.width / 2, 0);
    expect(requestBox!.x + requestBox!.width).toBeCloseTo(actorBoxes[2]!.x + actorBoxes[2]!.width / 2, 0);
    // Columns share the content width: the last actor ends on the right edge of the content.
    const sequenceContentBox = await currentSlide(page).locator("[data-content]").boundingBox();
    expect(actorBoxes[2]!.x + actorBoxes[2]!.width).toBeCloseTo(sequenceContentBox!.x + sequenceContentBox!.width, 0);
  });

  await test.step("морфинг сам включается, когда у слайдов есть общие элементы", async () => {
    const cardSlideNumber = await jumpToHeading(page, "Морфинг любых блоков");
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(new RegExp(`#${cardSlideNumber + 1}$`));
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    // No morph names: the card pairs by its order, the empty bars by their place in the row, and their layers draw them as plain shapes.
    expect(await collectTransitionAnimations(page)).toEqual(
      expect.arrayContaining(
        [0, 1, 2, 3, 4].map((pairPosition) => `::view-transition-group(morph-${pairPosition}) slidemachina-shape-paint`),
      ),
    );
    await page.keyboard.press("PageUp");
    await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "backward");
  });

  await test.step("морфинг по словам: общие слова едут, разметка возвращается как была", async () => {
    const versionSlideNumber = await findSlideNumber(page, "h2", "Версия 0.2");
    await jumpToSlide(page, versionSlideNumber - 2);
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);
    // Two presses within one task: the skipped transition must not show the slide after it before the next snapshot.
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    });
    await expect(page).toHaveURL(new RegExp(`#${versionSlideNumber}$`));
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "morph");
    // The changed word rides with its line, and the two slide numbers take turns instead of overlapping.
    expect(await collectTransitionAnimations(page)).toEqual(
        expect.arrayContaining([
          "::view-transition-group(morph-word-0-0) -ua-view-transition-group-anim-morph-word-0-0",
          "::view-transition-group(morph-word-1-1) -ua-view-transition-group-anim-morph-word-1-1",
          "::view-transition-group(morph-word-0-leaving-word-1) slidemachina-word-carry",
          "::view-transition-old(frame-out-2) -ua-view-transition-fade-out",
          "::view-transition-new(frame-in-2) -ua-view-transition-fade-in",
        ]),
      );
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);
    await expect(currentSlide(page).locator("h2")).toHaveText("Версия 0.2");
    await expect(currentSlide(page).locator("[data-content] span")).toHaveCount(0);
    await expect(page.locator("[style*=view-transition]")).toHaveCount(0);
  });

  await test.step("куб и переворот в обе стороны", async () => {
    const flipSlideNumber = (await jumpToHeading(page, "Тринадцать переходов")) + 2;
    await page.keyboard.press("PageDown");
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "cube");
    expect(await collectTransitionAnimations(page)).toEqual(expect.arrayContaining(["::view-transition-new(slide-in) slidemachina-cube-in"]));
    await page.keyboard.press("PageDown");
    await expect(page.locator("html")).toHaveAttribute("data-slide-transition", "flip");
    // Back only after the flip has switched the slide: a press within the same frame never shows the flipped slide.
    await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber}$`));
    await page.keyboard.press("PageUp");
    await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "backward");
    expect(await collectTransitionAnimations(page)).toEqual(expect.arrayContaining(["::view-transition-old(slide-out) slidemachina-flip-out"]));
    await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber - 1}$`));
  });

  await test.step("шторка, круг, жалюзи, плитки и сбой в обе стороны", async () => {
    const flipSlideNumber = await findSlideNumber(page, "h2", "Переворот");
    const transitionLayers = [
      ["wipe", "::view-transition-new(slide-in) slidemachina-wipe", "::view-transition-old(slide-out) slidemachina-wipe"],
      ["iris", "::view-transition-new(slide-in) slidemachina-color-flood", "::view-transition-old(slide-out) slidemachina-color-flood"],
      ["blinds", "::view-transition-new(slide-in) slidemachina-blinds", "::view-transition-old(slide-out) slidemachina-blinds"],
      ["mosaic", "::view-transition-new(slide-in) slidemachina-mosaic", "::view-transition-old(slide-out) slidemachina-mosaic"],
      ["glitch", "::view-transition-new(slide-content-in) slidemachina-glitch-away", "::view-transition-old(slide-content-out) slidemachina-glitch-away"],
    ] as const;
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber}$`));
    for (const [slidePosition, [transitionName, forwardLayer]] of transitionLayers.entries()) {
      await page.keyboard.press("PageDown");
      await expect(page.locator("html")).toHaveAttribute("data-slide-transition", transitionName);
      expect(await collectTransitionAnimations(page)).toEqual(expect.arrayContaining([forwardLayer]));
      await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber + slidePosition + 1}$`));
    }
    for (const [slidePosition, [transitionName, , backwardLayer]] of [...transitionLayers.entries()].reverse()) {
      await page.keyboard.press("PageUp");
      await expect(page.locator("html")).toHaveAttribute("data-slide-transition", transitionName);
      await expect(page.locator("html")).toHaveAttribute("data-slide-direction", "backward");
      expect(await collectTransitionAnimations(page)).toEqual(expect.arrayContaining([backwardLayer]));
      await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber + slidePosition}$`));
    }
    await page.keyboard.press("PageUp");
    await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber - 1}$`));
    await expect(page.locator("[style*=view-transition]")).toHaveCount(0);
  });

  await test.step("свайп листает, вертикальный жест и короткое касание — нет", async () => {
    const flipSlideNumber = await findSlideNumber(page, "h2", "Переворот");
    await swipeAcross(page, -200);
    await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber}$`));
    await swipeAcross(page, 200);
    await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber - 1}$`));
    await swipeAcross(page, -80, 200);
    await swipeAcross(page, -30);
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(new RegExp(`#${flipSlideNumber}$`));
  });

  await test.step("пауза закрывает всё, и Agentation тоже; листание в паузе только возвращает слайд", async () => {
    // Agentation is off in tests; a stand-in with its class shows whether the black screen hides it.
    await page.evaluate(() => document.body.append(Object.assign(document.createElement("div"), { className: "slidemachina-feedback" })));
    const feedbackStandIn = page.locator("body > .slidemachina-feedback");
    const addressBeforePause = page.url();
    await page.keyboard.press("b");
    await expect(page.locator("[data-pause-screen]")).toBeVisible();
    await expect(page.locator("[data-pause-return]")).toHaveText("Вернуться к слайду · B");
    await expect(feedbackStandIn).toHaveCSS("visibility", "hidden");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-pause-screen]")).toHaveCount(0);
    expect(page.url()).toBe(addressBeforePause);
    await page.keyboard.press("Period");
    await page.locator("[data-pause-return]").click();
    await expect(page.locator("[data-pause-screen]")).toHaveCount(0);
    await page.mouse.move(640, 300);
    await expect(feedbackStandIn).toHaveCSS("visibility", "visible");
  });

  await test.step("прогресс, миникарта, тезис, фон-видео и свой компонент с useSlide", async () => {
    const demoSlideCount = await page.locator("[data-canvas] > [data-slide]").count();
    const shownSlideCount = await page.locator("[data-canvas] > [data-slide]:not([data-hidden])").count();
    await jumpToSlide(page, 3);
    // The hidden slide of the demo is left out of the progress line.
    await expect(page.locator("[data-progress]")).toHaveAttribute("style", `--progress-share: ${2 / (shownSlideCount - 1)};`);
    // The minimap of slidemachina dev lies over the right edge: off by default, M or its toolbar button shows it, the slide keeps its size.
    const slideMinimap = page.locator("[data-minimap]");
    await expect(slideMinimap).toHaveCount(0);
    await page.keyboard.press("m");
    await expect(slideMinimap.locator("[data-minimap-thumbnail]")).toHaveCount(demoSlideCount);
    await expect(slideMinimap.locator("[data-minimap-thumbnail][aria-current] > [data-thumbnail-number]")).toHaveText("3");
    expect((await page.locator("[data-canvas]").boundingBox())!.width).toBeCloseTo(1280, 0);
    await slideMinimap.locator("[data-minimap-thumbnail]").nth(4).click();
    await expect(page).toHaveURL(/#5$/);
    await page.mouse.move(640, 500);
    await page.getByRole("button", { name: "Миникарта · M" }).click();
    await expect(slideMinimap).toHaveCount(0);

    // A thesis stands in the middle of the slide both ways; its soft accent background is light, so the text is a deep shade of its hue.
    await jumpToSlide(page, await findSlideNumber(page, ".machina-thesis"));
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "light");
    await expect(currentSlide(page)).toHaveAttribute("data-background", "color");
    const [thesisBox] = await measureOnCanvas(page, [".machina-thesis"]);
    expect((thesisBox!.left + thesisBox!.right) / 2).toBeCloseTo(960, 0);
    expect(Math.abs((thesisBox!.top + thesisBox!.bottom) / 2 - 540)).toBeLessThan(40);
    // The bottom line of a coloured slide is the text colour let through, so it takes the hue of the slide.
    await expect(currentSlide(page).locator("[data-slide-number]")).toHaveCSS("color", /\/ 0\.7\)$/);
    // The next thesis has a colour of its own: it floods the slide in a circle over the old one.
    await page.keyboard.press("ArrowRight");
    expect(await collectTransitionAnimations(page)).toEqual(expect.arrayContaining(["::view-transition-new(slide-color) slidemachina-color-flood"]));
    await expect.poll(() => listTransitionAnimations(page)).toEqual([]);

    await jumpToHeading(page, "Видео вместо фона");
    await expect(currentSlide(page).locator(":scope > video[data-slide-background]")).toHaveCount(1);
    await expect(currentSlide(page)).toHaveAttribute("data-tone", "dark");

    await jumpToHeading(page, "Свой компонент на слайде");
    const stepMeter = currentSlide(page).locator(".machina-big-number > p");
    await expect(stepMeter).toHaveText("0");
    await page.keyboard.press("ArrowRight");
    await expect(stepMeter).toHaveText("1");
    await jumpToHeading(page, "Переворот");
  });

  await test.step("навигатор", async () => {
    await page.keyboard.press("o");
    const slideNavigator = page.locator("[data-navigator]");
    const demoSlideCount = await page.locator("[data-canvas] > [data-slide]").count();
    await expect(slideNavigator.locator("[data-thumbnail]")).toHaveCount(demoSlideCount);
    // One of the two dark steps of the theme, the same as the dark slides: --dark-background.
    await expect(slideNavigator).toHaveCSS("background-color", "rgb(20, 22, 29)");
    await expect(slideNavigator.locator("[data-thumbnail-number]").nth(41)).toHaveText("42");
    const firstThumbnailBox = await slideNavigator.locator("[data-thumbnail]").first().boundingBox();
    // Six columns on a 16:9 screen: 1920 logical pixels give thumbnails of 240–280.
    expect(firstThumbnailBox!.width / (await page.locator("[data-canvas]").boundingBox())!.width).toBeCloseTo(268 / 1920, 2);
    await expect(slideNavigator.locator("[data-thumbnail][data-selected]")).toContainText("Переворот");
    await expect(slideNavigator.locator("[data-navigator-heading]").nth(2).locator("span")).toHaveText(["Как устроено", "Шаги"]);
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(slideNavigator).toHaveCount(0);
    await expect(page).toHaveURL(/#2$/);
    await page.keyboard.press("Escape");
    const keysSlideNumber = await findSlideNumber(page, "h2", "Клавиши");
    await slideNavigator.locator("[data-thumbnail]").nth(keysSlideNumber - 1).click();
    await expect(page).toHaveURL(new RegExp(`#${keysSlideNumber}$`));
    await expect(currentSlide(page).locator("[data-breadcrumbs]")).toHaveText("Шпаргалка");
    await page.mouse.move(640, 300);
    const navigatorButton = page.getByRole("button", { name: "Все слайды · Esc" });
    await navigatorButton.click();
    await expect(slideNavigator).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/\\?overview#${keysSlideNumber}$`));
    await navigatorButton.click();
    await expect(slideNavigator).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/#${keysSlideNumber}$`));
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
    await expect(overviewPage.locator("[data-navigator] [data-thumbnail]")).toHaveCount(demoSlideCount);
    await overviewPage.keyboard.press("Escape");
    await expect(overviewPage.locator("[data-navigator]")).toHaveCount(0);
    await overviewPage.close();

    // The backup slide after the last one: End and → stop before it, the navigator opens it as "N+1", ← leads back to N.
    const shownSlideCount = await page.locator("[data-canvas] > [data-slide]:not([data-hidden])").count();
    await page.keyboard.press("End");
    await expect(page).toHaveURL(new RegExp(`#${shownSlideCount}$`));
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(new RegExp(`#${shownSlideCount}$`));
    await page.keyboard.press("o");
    const hiddenThumbnail = slideNavigator.locator("[data-thumbnail][data-hidden]");
    await expect(hiddenThumbnail.locator("[data-thumbnail-number]")).toHaveText(`${shownSlideCount}+1`);
    await hiddenThumbnail.click();
    await expect(page).toHaveURL(new RegExp(`#${shownSlideCount}\\+1$`));
    await expect(currentSlide(page).locator("h2")).toHaveText("Запасной слайд");
    await expect(currentSlide(page).locator("[data-slide-number]")).toHaveCount(0);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(new RegExp(`#${shownSlideCount}$`));
    await jumpToSlide(page, keysSlideNumber);
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
    const sceneCoverNumber = await jumpToHeading(page, "3D");
    // The section opens with its own <Slide cover>: no generated cover before it, and its h1 names the section in the breadcrumbs.
    await expect(page.locator("[data-canvas] > [data-slide] h1[data-section-number]", { hasText: /^3D$/ })).toHaveCount(0);
    await expect(page.locator("[data-canvas] > [data-slide]").nth(sceneCoverNumber).locator("[data-breadcrumbs]")).toHaveText("3D");
    const heroCanvas = page.locator("[data-canvas] > [data-slide]").nth(sceneCoverNumber).locator("[data-scene-canvas]");
    // The next slide is hidden, yet its still frame is drawn: the transition snapshot is never empty.
    await expect.poll(async () => (await sampleSceneCanvas(heroCanvas)).paintedPixels, { timeout: 10_000 }).toBeGreaterThan(250);
    const stillFrame = (await sampleSceneCanvas(heroCanvas)).frameFingerprint;
    await page.waitForTimeout(300);
    expect((await sampleSceneCanvas(heroCanvas)).frameFingerprint, "сцена на скрытом слайде стоит").toBe(stillFrame);
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(new RegExp(`#${sceneCoverNumber + 1}$`));
    await expect.poll(async () => (await sampleSceneCanvas(heroCanvas)).frameFingerprint, { message: "камера облетает сцену" }).not.toBe(stillFrame);

    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(new RegExp(`#${sceneCoverNumber + 2}$`));
    const stepCanvas = currentSlide(page).locator("[data-scene-canvas]");
    await expect.poll(async () => (await sampleSceneCanvas(stepCanvas)).paintedPixels).toBeGreaterThan(100);
    const cubeOnlyPixels = (await sampleSceneCanvas(stepCanvas)).paintedPixels;
    await page.keyboard.press("PageDown");
    await expect(currentSlide(page).locator("[data-scene-step][data-step-reached]")).toHaveCount(1);
    await expect.poll(async () => (await sampleSceneCanvas(stepCanvas)).paintedPixels, { message: "сфера появилась" }).toBeGreaterThan(cubeOnlyPixels * 1.3);
    await page.keyboard.press("o");
    const sceneThumbnail = page.locator("[data-navigator] [data-thumbnail]").nth(sceneCoverNumber + 1).locator("[data-scene-canvas]");
    await expect.poll(async () => (await sampleSceneCanvas(sceneThumbnail)).paintedPixels).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
  });

  await test.step("перезагрузка оставляет на том же шаге", async () => {
    const effectsSlideNumber = await findSlideNumber(page, "h2", "Эффекты шагов");
    await page.goto(`/#${effectsSlideNumber}`);
    await expect(currentSlide(page).locator("li[data-step]").first()).toBeHidden();
    await page.goto(`/#${effectsSlideNumber}.3`);
    await page.reload();
    await expect(currentSlide(page).locator("h2")).toHaveText("Эффекты шагов");
    await expect(currentSlide(page).locator("[data-step-reached]")).toHaveCount(3);
  });

  // The demo's index.tsx holds a component of its own, StepMeter: such a module used to reload the page.
  await test.step("правка index.tsx со своим компонентом обновляет слайд без перезагрузки", async () => {
    const effectsSlideNumber = await findSlideNumber(page, "h2", "Эффекты шагов");
    await page.evaluate(() => document.documentElement.setAttribute("data-test-before-edit", ""));
    await editFileWhile(
      demoPresentationFile,
      (originalPresentation) => originalPresentation.replace("Эффекты шагов", "Эффекты шагов после правки"),
      async () => {
        await expect(currentSlide(page).locator("h2")).toHaveText("Эффекты шагов после правки");
        await expect(page).toHaveURL(new RegExp(`#${effectsSlideNumber}\\.3$`));
        await expect(currentSlide(page).locator("[data-step-reached]")).toHaveCount(3);
        await expect(page.locator("html"), "страница не перезагрузилась").toHaveAttribute("data-test-before-edit");
      },
    );
    await expect(currentSlide(page).locator("h2")).toHaveText("Эффекты шагов");
  });

  // File edits go last: a late hot update in the middle of a morph would make the transition steps flaky.
  await test.step("правка файла с кодом обновляет слайд без перезагрузки", async () => {
    const fileCodeSlideNumber = await findSlideNumber(page, "h2", "Код из файла");
    await page.goto(`/#${fileCodeSlideNumber}.4`);
    await editFileWhile(
      demoCodeFile,
      (originalCode) => originalCode.replace("Which files are in the examples folder?", "Какие файлы в папке?"),
      () => expect(currentSlide(page).locator("[data-code]")).toContainText("Какие файлы в папке?"),
    );
    await expect(currentSlide(page).locator("[data-code]")).toContainText("Which files are in the examples folder?");
    await expect(page).toHaveURL(new RegExp(`#${fileCodeSlideNumber}\\.4$`));
    expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
  });

  await test.step("typography={false} выключает типограф", async () => {
    await jumpToHeading(page, "Типограф");
    const typographedParagraph = currentSlide(page).locator(".machina-columns > div > p").last();
    await editFileWhile(
      demoPresentationFile,
      (originalPresentation) => originalPresentation.replace('<Machina.Presentation ', '<Machina.Presentation typography={false} '),
      () => expect(typographedParagraph).toHaveText(/^"Кавычки" станут ёлочками, дефис - тире/),
    );
    await expect(typographedParagraph).toHaveText(/^«Кавычки»/);
  });

  const setAspectRatio = (aspectRatio: string) => (originalPresentation: string) =>
    originalPresentation.replace('<Machina.Presentation ', `<Machina.Presentation aspectRatio="${aspectRatio}" `);

  await test.step("формат 16:9 по умолчанию и 9:16: холст растёт под окно на треть, остальное — поля, печать в формате", async () => {
    const canvasElement = page.locator("[data-canvas]");
    await page.setViewportSize({ width: 1024, height: 1024 });
    await expect(canvasElement).toHaveCSS("width", "1920px");
    await expect(canvasElement).toHaveCSS("height", "1440px");
    await expect.poll(async () => Math.round((await canvasElement.boundingBox())!.height)).toBe(768);
    expect(await page.locator("[data-presentation] > style").textContent()).toContain("size: 1920px 1080px");
    await editFileWhile(demoPresentationFile, setAspectRatio("9:16"), async () => {
      await expect(canvasElement).toHaveCSS("height", "1920px");
      await expect(canvasElement).toHaveCSS("width", "1440px");
      await expect.poll(async () => Math.round((await canvasElement.boundingBox())!.width)).toBe(768);
    });
    await expect(canvasElement).toHaveCSS("height", "1440px");
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
          const roomElement = codeViewport.closest<HTMLElement>(".machina-columns > div, [data-content]")!;
          const codeRight = codeViewport.closest("[data-code]")!.getBoundingClientRect().right;
          if (codeViewport.scrollWidth > codeViewport.clientWidth + 1) foundProblems.push(`${describeSlide(codeViewport)}: код прокручивается`);
          if (codeRight > roomElement.getBoundingClientRect().right + 1) foundProblems.push(`${describeSlide(codeViewport)}: код шире своей области`);
          // Padding is in canvas pixels, the boxes are on the scaled screen.
          const roomBox = roomElement.getBoundingClientRect();
          const textLine = roomBox.left + (Number.parseFloat(getComputedStyle(roomElement).paddingLeft) * roomBox.width) / roomElement.offsetWidth;
          const codeStart = codeViewport.querySelector("[data-code-line]")!.getBoundingClientRect().left;
          // Centred slides and freeform blocks have no text line for the code to hang from.
          const hangsCode = !codeViewport.closest("[data-align='center'], .machina-freeform");
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
