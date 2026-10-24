import { advanceScene, aimScene, buildScene, releaseScene, type BuiltScene, type SceneSettings } from "./scene-building.ts";
import type { ScenePart } from "./scene-outline.ts";
import { poseScene } from "./scene-poses.ts";
import { drawSceneFrame } from "./scene-renderer.ts";
import { stepChangeEventName } from "../slide-steps/step-visibility.ts";

type SceneViewSettings = {
  showsFloor: boolean;
  orbitDegrees: number;
  isSlideCopy: boolean;
};

const largestPixelRatio = 2;
const printedPixelRatio = 1.5;
const largestFramePixels = 4096;

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

// Only the live slide animates; copies keep one still frame and free their GPU resources at once.
export function createSceneView(figureElement: HTMLElement, sceneParts: ScenePart[], viewSettings: SceneViewSettings) {
  const canvasElement = figureElement.querySelector<HTMLCanvasElement>("[data-scene-canvas]")!;
  const slideElement = figureElement.closest<HTMLElement>("[data-slide]")!;
  const sceneSettings: SceneSettings = {
    showsFloor: viewSettings.showsFloor,
    orbitDegrees: viewSettings.orbitDegrees,
    keepsStill: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  let builtScene: BuiltScene | undefined;
  let shownStateKey = "";
  let animationFrameRequest = 0;
  let lastFrameTime = 0;
  let needsDrawing = false;

  const drawFrame = () => {
    const framePixels = measureFramePixels(canvasElement);
    if (builtScene === undefined || framePixels === undefined) return;
    drawSceneFrame(builtScene.threeScene, builtScene.cameraMotion.sceneCamera, canvasElement, ...framePixels);
    figureElement.toggleAttribute("data-drawn", true);
  };

  const runAnimationFrame = (frameTime: number) => {
    animationFrameRequest = requestAnimationFrame(runAnimationFrame);
    const elapsedSeconds = Math.min(Math.max(frameTime - lastFrameTime, 0) / 1000, 0.1);
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
    if (stateKey === shownStateKey) return;
    shownStateKey = stateKey;
    builtScene ??= buildScene(figureElement, sceneParts, sceneSettings);
    const [frameWidth, frameHeight] = framePixels;
    aimScene(builtScene, poseScene(sceneParts, reachedPartPositions), frameWidth / frameHeight, !isLiveSlide || sceneSettings.keepsStill);
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
      stopAnimation();
      sizeObserver.disconnect();
      window.removeEventListener("resize", showReachedState);
      slideElement.removeEventListener(stepChangeEventName, showReachedState);
      releaseBuiltScene();
    },
  };
}
