import { advanceScene, aimScene, buildScene, releaseScene, type BuiltScene, type SceneSettings } from "./scene-building.ts";
import type { ScenePart } from "./scene-outline.ts";
import { poseScene } from "./scene-poses.ts";
import type { FrameExtent } from "./scene-camera.ts";
import { compileSceneShaders, drawSceneFrame } from "./scene-renderer.ts";
import { stepChangeEventName } from "../slide-steps/step-visibility.ts";

const largestPixelRatio = 2;
const printedPixelRatio = 1.5;
const largestFramePixels = 4096;
// A background tab freezes the clock: one frame never eases faster than this.
const longestFrameSeconds = 0.1;
// Under the text the full scene needs at least this share of the content; with less room it takes the whole content area.
const smallestAreaShare = 1 / 4;
const fullOpacity = 255;
const wholeFrame: FrameExtent = { leftEdge: -1, rightEdge: 1, bottomEdge: -1, topEdge: 1 };

type SceneViewSettings = {
  showsFloor: boolean;
  fillsSlide: boolean;
  orbitDegrees: number;
  isSlideCopy: boolean;
};

// Markers without a step number have not been counted by the slide yet: the slide's step event follows.
function readReachedPartPositions(figureElement: HTMLElement): Set<number> | undefined {
  const reachedPartPositions = new Set<number>();
  for (const stepMarker of figureElement.querySelectorAll<HTMLElement>("[data-scene-step]")) {
    if (stepMarker.dataset.stepIndex === undefined) return undefined;
    if (stepMarker.hasAttribute("data-step-reached")) reachedPartPositions.add(Number(stepMarker.dataset.sceneStep));
  }
  return reachedPartPositions;
}

// Device pixels of the canvas on screen, with the slide's own scale; printed pages are drawn sharper for zooming in a PDF,
// whatever their scale in the print view.
function measureFramePixels(canvasElement: HTMLCanvasElement): [number, number] | undefined {
  const layoutWidth = canvasElement.offsetWidth;
  const layoutHeight = canvasElement.offsetHeight;
  if (layoutWidth === 0 || layoutHeight === 0) return undefined;
  const displayScale = canvasElement.getBoundingClientRect().width / layoutWidth;
  const isPrinted = canvasElement.closest("[data-print-pages]") !== null;
  const pixelRatio = isPrinted ? printedPixelRatio : displayScale * Math.min(window.devicePixelRatio, largestPixelRatio);
  const sizeLimit = Math.min(1, largestFramePixels / (Math.max(layoutWidth, layoutHeight) * pixelRatio));
  return [Math.max(1, Math.round(layoutWidth * pixelRatio * sizeLimit)), Math.max(1, Math.round(layoutHeight * pixelRatio * sizeLimit))];
}

// A full scene lies under the text: its objects fill the content area below the text, inside the frame lines.
function measureFittingArea(figureElement: HTMLElement): FrameExtent {
  const figureBox = figureElement.getBoundingClientRect();
  if (figureElement.dataset.scene !== "full" || figureBox.height === 0) return wholeFrame;
  const contentElement = figureElement.parentElement!;
  const contentBox = contentElement.getBoundingClientRect();
  const displayScale = figureBox.width / figureElement.offsetWidth;
  const headingGap = Number.parseFloat(getComputedStyle(figureElement).getPropertyValue("--heading-gap")) * displayScale;
  const textBottoms = [...contentElement.children]
    .filter((childElement) => getComputedStyle(childElement).position !== "absolute")
    .map((childElement) => childElement.getBoundingClientRect().bottom);
  const belowText = textBottoms.length === 0 ? contentBox.top : Math.max(...textBottoms) + headingGap;
  const areaTop = contentBox.bottom - belowText < contentBox.height * smallestAreaShare ? contentBox.top : belowText;
  const measureAcross = (pagePosition: number) => ((pagePosition - figureBox.left) / figureBox.width) * 2 - 1;
  const measureUp = (pagePosition: number) => 1 - ((pagePosition - figureBox.top) / figureBox.height) * 2;
  return { leftEdge: measureAcross(contentBox.left), rightEdge: measureAcross(contentBox.right), bottomEdge: measureUp(contentBox.bottom), topEdge: measureUp(areaTop) };
}

// A transparent canvas is printed with a soft mask. On a slide of one colour the printed frame takes that colour and is opaque.
function readPrintedFrameColor(canvasElement: HTMLCanvasElement): string | undefined {
  if (canvasElement.closest("[data-print-pages]") === null) return undefined;
  const slideStyle = getComputedStyle(canvasElement.closest("[data-slide]")!);
  const colorSamplingContext = new OffscreenCanvas(1, 1).getContext("2d")!;
  colorSamplingContext.fillStyle = slideStyle.backgroundColor;
  colorSamplingContext.fillRect(0, 0, 1, 1);
  const hasSolidBackground = slideStyle.backgroundImage === "none" && colorSamplingContext.getImageData(0, 0, 1, 1).data[3] === fullOpacity;
  return hasSolidBackground ? slideStyle.backgroundColor : undefined;
}

// Only the live slide animates; copies keep one still frame and free their GPU resources at once.
export function createSceneView(figureElement: HTMLElement, sceneParts: ScenePart[], viewSettings: SceneViewSettings) {
  const canvasElement = figureElement.querySelector<HTMLCanvasElement>("[data-scene-canvas]")!;
  const slideElement = figureElement.closest<HTMLElement>("[data-slide]")!;
  const sceneSettings: SceneSettings = {
    showsFloor: viewSettings.showsFloor,
    orbitDegrees: viewSettings.orbitDegrees,
    keepsStill: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    fillsSlide: viewSettings.fillsSlide,
  };
  let builtScene: BuiltScene | undefined;
  let shownStateKey = "";
  let animationFrameRequest = 0;
  let lastFrameTime = 0;
  let needsDrawing = false;
  let isCompilingShaders = false;
  let isDisposed = false;
  const printedFrameColor = readPrintedFrameColor(canvasElement);

  const drawFrame = () => {
    const framePixels = measureFramePixels(canvasElement);
    if (builtScene === undefined || framePixels === undefined) return;
    drawSceneFrame(builtScene.threeScene, builtScene.cameraMotion.sceneCamera, canvasElement, ...framePixels, printedFrameColor);
    figureElement.toggleAttribute("data-drawn", true);
  };

  const runAnimationFrame = (frameTime: number) => {
    animationFrameRequest = requestAnimationFrame(runAnimationFrame);
    const elapsedSeconds = Math.min(Math.max(frameTime - lastFrameTime, 0) / 1000, longestFrameSeconds);
    lastFrameTime = frameTime;
    const hasMoved = builtScene !== undefined && advanceScene(builtScene, elapsedSeconds);
    if (!hasMoved && !needsDrawing) return;
    needsDrawing = false;
    drawFrame();
  };

  const stopAnimation = () => {
    cancelAnimationFrame(animationFrameRequest);
    animationFrameRequest = 0;
  };

  const releaseBuiltScene = () => {
    if (builtScene !== undefined) releaseScene(builtScene);
    builtScene = undefined;
  };

  const showReachedState = () => {
    const reachedPartPositions = readReachedPartPositions(figureElement);
    const framePixels = measureFramePixels(canvasElement);
    if (reachedPartPositions === undefined || framePixels === undefined) return;
    const isLiveSlide = !viewSettings.isSlideCopy && slideElement.hasAttribute("data-current");
    const stateKey = `${[...reachedPartPositions].join(" ")}|${isLiveSlide}|${framePixels.join("x")}`;
    if (stateKey === shownStateKey || isCompilingShaders) return;
    // A scene built ahead of its slide compiles first, so the build in the background never freezes a key press.
    // A shown slide or a printed copy draws at once: the print dialog does not wait.
    if (builtScene === undefined && !isLiveSlide && !viewSettings.isSlideCopy) {
      builtScene = buildScene(figureElement, sceneParts, sceneSettings);
      isCompilingShaders = true;
      void compileSceneShaders(builtScene.threeScene, builtScene.cameraMotion.sceneCamera).finally(() => {
        isCompilingShaders = false;
        if (!isDisposed) showReachedState();
      });
      return;
    }
    shownStateKey = stateKey;
    builtScene ??= buildScene(figureElement, sceneParts, sceneSettings);
    const [frameWidth, frameHeight] = framePixels;
    aimScene(builtScene, poseScene(sceneParts, reachedPartPositions), frameWidth / frameHeight, measureFittingArea(figureElement), !isLiveSlide || sceneSettings.keepsStill);
    if (isLiveSlide) {
      needsDrawing = true;
      if (animationFrameRequest === 0) {
        lastFrameTime = performance.now();
        animationFrameRequest = requestAnimationFrame(runAnimationFrame);
      }
      return;
    }
    stopAnimation();
    drawFrame();
    if (viewSettings.isSlideCopy) releaseBuiltScene();
  };

  // The canvas keeps its layout size when the whole slide is rescaled, so the window size is watched too.
  const sizeObserver = new ResizeObserver(showReachedState);
  sizeObserver.observe(canvasElement);
  window.addEventListener("resize", showReachedState);
  slideElement.addEventListener(stepChangeEventName, showReachedState);
  showReachedState();

  return {
    dispose() {
      isDisposed = true;
      stopAnimation();
      sizeObserver.disconnect();
      window.removeEventListener("resize", showReachedState);
      slideElement.removeEventListener(stepChangeEventName, showReachedState);
      releaseBuiltScene();
    },
  };
}
