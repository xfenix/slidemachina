import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { commandLineScript, examplesFolder } from "./test-helpers.ts";

const runCommand = promisify(execFile);

test("feature requests: step morph between steps, SVG contour morph, code anchors as arrow ends", async ({ page }) => {
  test.setTimeout(180_000);
  const repositoryFolder = await mkdtemp(path.join(examplesFolder, "issue-features-"));
  const projectFolder = path.join(repositoryFolder, "feature-talk");
  const outputFolder = await mkdtemp(path.join(os.tmpdir(), "slidemachina-features-"));
  try {
    await mkdir(projectFolder);
    await writeFile(path.join(projectFolder, "index.tsx"), `
import { Presentation, Slide, Code, Diagram, Box, Arrow, useSlide } from "slidemachina";

function StepState() {
  const { step } = useSlide();
  const later = step >= 1;
  return <>
    <span hidden data-step={1} />
    <h2>One logical slide, two states</h2>
    <div morph="status-card" className="status-card" style={{ marginLeft: later ? 300 : 0 }}>
      <p morph="status-label">{later ? "Validated and saved" : "Saved"}</p>
    </div>
    <Code lang="python">{"def handle():\\n    save()"}</Code>
  </>;
}

function Shape({ d }: { d: string }) {
  return <div morph="shape" style={{ width: 220, height: 220 }}>
    <svg viewBox="0 0 200 200" width="220" height="220">
      <path data-morph-path="outline" d={d} fill="var(--accent-color)" />
    </svg>
  </div>;
}

export default <Presentation title="Feature reproductions" lang="en" transition="morph">
  <Slide stepTransition="morph" plain>
    <StepState />
  </Slide>
  <Slide plain>
    <h2>Change the contour</h2>
    <Shape d="M20 20 L180 20 L180 180 L20 180 Z" />
  </Slide>
  <Slide plain>
    <h2>Change the contour</h2>
    <Shape d="M100 20 L180 100 L100 180 L20 100 Z" />
  </Slide>
  <Slide plain>
    <h2>Defer work to a task</h2>
    <Diagram direction="right">
      <Box id="caller">
        <Code id="call-site" lang="python" anchors={{ enqueue: { line: 2, columns: [26, 31] } }}>{"def register_user():\\n    some_cpu_bound_logic.delay()"}</Code>
      </Box>
      <Box id="executor">
        <Code id="task-code" lang="python" anchors={{ task: { line: 2, columns: [5, 25] } }}>{"@celery.task\\ndef some_cpu_bound_logic():\\n    pass"}</Code>
      </Box>
      <Arrow from={{ node: "caller", code: "call-site", anchor: "enqueue" }} to={{ node: "executor", code: "task-code", anchor: "task" }} label="enqueue" />
      <Arrow id="bad-anchor" from="caller" to={{ node: "executor", code: "task-code", anchor: "missing" }} />
    </Diagram>
  </Slide>
</Presentation>;
`);
    await writeFile(path.join(projectFolder, "style.css"), `
:root { --heading-size: 40px; }
.status-card { width: 300px; padding: 20px; border: 3px solid black; background: #d5ff45; }
`);
    await runCommand(process.execPath, [commandLineScript, "build", projectFolder, "--html", "--out", outputFolder]);
    const builtFile = path.join(outputFolder, "feature-talk.html");

    await test.step("step morph: one slide keeps its number and morph-named elements glide between steps", async () => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(pathToFileURL(builtFile).href);
      await page.evaluate(() => {
        (window as unknown as { viewTransitionCount: number }).viewTransitionCount = 0;
        (window as unknown as { __capturedErrors: string[] }).__capturedErrors = [];
        const startViewTransition = document.startViewTransition.bind(document);
        document.startViewTransition = (updateCallback) => {
          (window as unknown as { viewTransitionCount: number }).viewTransitionCount += 1;
          return startViewTransition(updateCallback);
        };
        const reportError = console.error.bind(console);
        console.error = (...errorParts: unknown[]) => {
          (window as unknown as { __capturedErrors: string[] }).__capturedErrors.push(errorParts.map(String).join(" "));
          reportError(...errorParts);
        };
      });
      await expect(page).toHaveURL(/#1$/);
      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(/#1\.1$/);
      await expect(page.locator("[data-canvas] > [data-slide]")).toHaveCount(4);
      await page.waitForTimeout(150);
      const cardTransform = await page.evaluate(() => {
        const cardElement = document.querySelector<HTMLElement>("[data-canvas] > [data-current] [morph='status-card']")!;
        const cardAnimation = document.getAnimations().find((runningAnimation) => runningAnimation.effect instanceof KeyframeEffect && runningAnimation.effect.target === cardElement);
        cardAnimation?.pause();
        const middleTime = (cardAnimation?.effect?.getComputedTiming().endTime as number) / 2;
        if (cardAnimation !== undefined) cardAnimation.currentTime = middleTime;
        return getComputedStyle(cardElement).transform;
      });
      // At half time the card is halfway between margin-left 0 and 300 px (FLIP travels from -300 back to 0).
      const translateX = Number(/matrix\(1, 0, 0, [\d.]+, (-?[\d.]+)/.exec(cardTransform)?.[1] ?? 9999);
      expect(translateX).toBeLessThan(-50);
      expect(translateX).toBeGreaterThan(-250);
      await page.waitForTimeout(700);
      const viewTransitionCount = await page.evaluate(() => (window as unknown as { viewTransitionCount: number }).viewTransitionCount);
      expect(viewTransitionCount).toBe(0);
    });

    await test.step("SVG contour morph: the path interpolates its vertices, without a view transition", async () => {
      await page.goto(`${pathToFileURL(builtFile).href}#2`);
      await expect(page).toHaveURL(/#2$/);
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("[data--slidemachina-morph-path-overlay] path")).toHaveCount(1);
      const middleGeometry = await page.evaluate(() => {
        const outlinePath = document.querySelector<SVGPathElement>("[data--slidemachina-morph-path-overlay] path")!;
        const pathAnimation = document.getAnimations().find((runningAnimation) => runningAnimation.effect instanceof KeyframeEffect && runningAnimation.effect.target === outlinePath);
        if (pathAnimation === undefined) return undefined;
        pathAnimation.pause();
        pathAnimation.currentTime = (pathAnimation.effect?.getComputedTiming().endTime as number) / 2;
        const keyframes = (pathAnimation.effect as KeyframeEffect).getKeyframes() as unknown as Array<{ d: string }>;
        const readNumbers = (pathText: string) => (pathText.match(/-?\d*\.?\d+/g) ?? []).map(Number);
        return {
          startNumbers: readNumbers(keyframes[0]!.d),
          middleNumbers: readNumbers(getComputedStyle(outlinePath).d),
          endNumbers: readNumbers(keyframes[1]!.d),
        };
      });
      expect(middleGeometry).toBeDefined();
      // At linear 50% every coordinate is the average of its endpoints: the contour itself moves, not two fading shapes.
      for (const numberIndex of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const expectedMiddle = (middleGeometry!.startNumbers[numberIndex]! + middleGeometry!.endNumbers[numberIndex]!) / 2;
        expect(Math.abs(middleGeometry!.middleNumbers[numberIndex]! - expectedMiddle)).toBeLessThan(1.5);
      }
      // Backward plays the same contour in reverse.
      await page.keyboard.press("ArrowLeft");
      await expect(page.locator("[data--slidemachina-morph-path-overlay] path")).toHaveCount(1);
      await page.waitForTimeout(700);
      await expect(page.locator("[data--slidemachina-morph-path-overlay]")).toHaveCount(0);
      await expect(page.locator("[data-canvas] > [data-current] path[data-morph-path]")).toBeVisible();
    });

    await test.step("code anchors: the arrow ends at the named token, an unknown anchor reports an error", async () => {
      await page.goto(`${pathToFileURL(builtFile).href}#4`);
      const diagramElement = page.locator("[data-canvas] > [data-current] [data-diagram]");
      await expect(diagramElement).toHaveAttribute("data-laid-out");
      await expect(diagramElement).toHaveAttribute("data--slidemachina-anchors-attached");
      const tipDistances = await page.evaluate(() => {
        const tipDistance = (arrowElement: HTMLElement, endpoint: { code: string; anchor: string }, endKind: "start" | "tip") => {
          const drawnPath = arrowElement.querySelector<SVGPathElement>(endKind === "tip" ? "[data-arrow-head]" : "[data-arrow-line]")!;
          const tipNumbers = (drawnPath.getAttribute("d")!.match(/-?\d*\.?\d+/g) ?? []).map(Number);
          const arrowSvg = drawnPath.ownerSVGElement!;
          const svgRectangle = arrowSvg.getBoundingClientRect();
          const viewBoxNumbers = arrowSvg.getAttribute("viewBox")!.split(/\s+/).map(Number);
          const scale = svgRectangle.width / viewBoxNumbers[2]!;
          const tipScreenX = svgRectangle.left + (tipNumbers[0]! - viewBoxNumbers[0]!) * scale;
          const tipScreenY = svgRectangle.top + (tipNumbers[1]! - viewBoxNumbers[1]!) * scale;
          const codeElement = document.querySelector<HTMLElement>(`[data-current] [data--slidemachina-code-id="${endpoint.code}"]`)!;
          const anchorSpecification = JSON.parse(codeElement.getAttribute("data--slidemachina-code-anchors")!)[endpoint.anchor] as { line: number; columns?: [number, number] };
          const lineElement = codeElement.querySelector<HTMLElement>(`[data-code-line="${anchorSpecification.line}"]`)!;
          const lineText = lineElement.textContent;
          const [startColumn, endColumn] = anchorSpecification.columns ?? [1, lineText.length + 1];
          const range = document.createRange();
          const textWalker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT);
          let walkedLength = 0;
          let startSet = false;
          while (textWalker.nextNode()) {
            const textNode = textWalker.currentNode;
            const nodeEnd = walkedLength + (textNode.textContent ?? "").length;
            if (!startSet && nodeEnd >= startColumn - 1) {
              range.setStart(textNode, startColumn - 1 - walkedLength);
              startSet = true;
            }
            if (startSet && nodeEnd >= endColumn - 1) {
              range.setEnd(textNode, endColumn - 1 - walkedLength);
              break;
            }
            walkedLength = nodeEnd;
          }
          const anchorRectangle = range.getClientRects()[0]!;
          range.detach();
          return Math.hypot(tipScreenX - (anchorRectangle.left + anchorRectangle.width / 2), tipScreenY - (anchorRectangle.top + anchorRectangle.height / 2));
        };
        const sourceArrow = document.querySelector<HTMLElement>("[data-current] [data-arrow]:has([data-arrow-label])")!;
        const fallbackArrow = document.querySelector<HTMLElement>("[data-current] [data-focus-id='bad-anchor']")!;
        return {
          sourceDistance: tipDistance(sourceArrow, { code: "call-site", anchor: "enqueue" }, "start"),
          targetDistance: tipDistance(sourceArrow, { code: "task-code", anchor: "task" }, "tip"),
          fallbackDistance: tipDistance(fallbackArrow, { code: "task-code", anchor: "task" }, "tip"),
        };
      });
      // The labelled arrow ends sit on the named tokens; the arrow with an unknown anchor fell back to the box route.
      expect(tipDistances.sourceDistance).toBeLessThan(4);
      expect(tipDistances.targetDistance).toBeLessThan(4);
      expect(tipDistances.fallbackDistance).toBeGreaterThan(10);
      const consoleErrors: string[] = await page.evaluate(() => (window as unknown as { __capturedErrors: string[] }).__capturedErrors);
      expect(consoleErrors, `captured console errors: ${consoleErrors.join(" | ")}`).toEqual(
        expect.arrayContaining([expect.stringContaining('the anchor "missing"')]),
      );
    });
  } finally {
    await rm(repositoryFolder, { recursive: true, force: true });
    await rm(outputFolder, { recursive: true, force: true });
  }
});

test("feature requests: presentation-level settings cascade to slides and a slide overrides them", async ({ page }) => {
  test.setTimeout(180_000);
  const repositoryFolder = await mkdtemp(path.join(examplesFolder, "issue-cascade-"));
  const projectFolder = path.join(repositoryFolder, "cascade-talk");
  const outputFolder = await mkdtemp(path.join(os.tmpdir(), "slidemachina-cascade-"));
  try {
    await mkdir(projectFolder);
    await writeFile(path.join(projectFolder, "index.tsx"), `
import { Presentation, Slide } from "slidemachina";

export default <Presentation title="The cascade talk" lang="en" stepTransition="morph" valign="bottom" plain number={false}>
  <Slide>
    <h2>The slide on shared settings</h2>
  </Slide>
  <Slide stepTransition="jump" valign="top">
    <h2>The slide that overrides</h2>
  </Slide>
</Presentation>;
`);
    await runCommand(process.execPath, [commandLineScript, "build", projectFolder, "--html", "--out", outputFolder]);
    const builtFile = path.join(outputFolder, "cascade-talk.html");

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(pathToFileURL(builtFile).href);
    const sharedSettingsSlide = page.locator("[data-canvas] > [data-slide]").first();
    await expect(sharedSettingsSlide).toHaveAttribute("data--slidemachina-step-transition", "morph");
    await expect(sharedSettingsSlide).toHaveAttribute("data-valign", "bottom");
    await expect(sharedSettingsSlide.locator("[data-slide-number]")).toHaveCount(0);
    await expect(sharedSettingsSlide.locator("[data-breadcrumbs]")).toHaveCount(0);
    const overridingSlide = page.locator("[data-canvas] > [data-slide]").nth(1);
    await expect(overridingSlide).toHaveAttribute("data--slidemachina-step-transition", "jump");
    await expect(overridingSlide).toHaveAttribute("data-valign", "top");
  } finally {
    await rm(repositoryFolder, { recursive: true, force: true });
    await rm(outputFolder, { recursive: true, force: true });
  }
});
