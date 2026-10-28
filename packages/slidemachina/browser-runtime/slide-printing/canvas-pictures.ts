const printPagesSelector = "[data-print-pages]";
const webglContextKinds = new Set(["webgl", "webgl2", "experimental-webgl"]);
const probeWidth = 32;
const probeHeight = 18;
const rgbaChannelCount = 4;
const alphaChannelOffset = 3;
// A canvas unchanged this long is finished; an animated one is taken as it is after the longer wait, an empty one is left alone.
const canvasStillnessDuration = 250;
const canvasStillnessWaitLimit = 2000;
const canvasPaintWaitLimit = 5000;

type CanvasWatch = { firstSeenTime: number; firstPaintTime?: number; lastChangeTime: number; lastFingerprint?: string; isSettled: boolean };

const canvasWatches = new WeakMap<HTMLCanvasElement, CanvasWatch>();
const probeContext = new OffscreenCanvas(probeWidth, probeHeight).getContext("2d", { willReadFrequently: true })!;

// WebGL clears its picture after each frame unless told to keep it, and a printed copy is read after the frame.
// So a WebGL canvas made while printed pages exist, inside them or not yet on the page, keeps its picture.
function keepPrintedDrawingBuffers() {
  // oxlint-disable-next-line typescript/unbound-method -- called below with the canvas as this
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getPrintedContext(this: HTMLCanvasElement, contextKind: string, contextAttributes?: object) {
    const isPrintedCanvas = document.querySelector(printPagesSelector) !== null && (!this.isConnected || this.closest(printPagesSelector) !== null);
    const chosenAttributes = isPrintedCanvas && webglContextKinds.has(contextKind) ? { ...contextAttributes, preserveDrawingBuffer: true } : contextAttributes;
    return originalGetContext.call(this, contextKind, chosenAttributes);
  } as typeof originalGetContext;
}
keepPrintedDrawingBuffers();

// A small copy of the canvas; nothing comes back while it is still empty. A canvas with pictures from another site throws.
function readCanvasFingerprint(canvasElement: HTMLCanvasElement): string | undefined {
  probeContext.clearRect(0, 0, probeWidth, probeHeight);
  probeContext.drawImage(canvasElement, 0, 0, probeWidth, probeHeight);
  const probePixels = probeContext.getImageData(0, 0, probeWidth, probeHeight).data;
  for (let alphaIndex = alphaChannelOffset; alphaIndex < probePixels.length; alphaIndex += rgbaChannelCount) {
    if (probePixels[alphaIndex] !== 0) return probePixels.join(",");
  }
  return undefined;
}

// Chrome prints a canvas through a soft mask, and WebGL often comes out empty; the same picture as CSS content prints as an image.
function showCanvasAsPicture(canvasElement: HTMLCanvasElement) {
  canvasElement.style.content = `url("${canvasElement.toDataURL()}")`;
}

function settleCanvas(canvasElement: HTMLCanvasElement, checkTime: number): boolean {
  const canvasWatch = canvasWatches.get(canvasElement) ?? { firstSeenTime: checkTime, lastChangeTime: checkTime, isSettled: false };
  canvasWatches.set(canvasElement, canvasWatch);
  if (canvasWatch.isSettled || canvasElement.width === 0 || canvasElement.height === 0) return true;
  let canvasFingerprint: string | undefined;
  try {
    canvasFingerprint = readCanvasFingerprint(canvasElement);
  } catch {
    canvasWatch.isSettled = true;
    return true;
  }
  if (canvasFingerprint === undefined) {
    canvasWatch.isSettled = checkTime - canvasWatch.firstSeenTime > canvasPaintWaitLimit;
    return canvasWatch.isSettled;
  }
  if (canvasFingerprint !== canvasWatch.lastFingerprint) Object.assign(canvasWatch, { lastFingerprint: canvasFingerprint, lastChangeTime: checkTime });
  canvasWatch.firstPaintTime ??= checkTime;
  const isStill = checkTime - canvasWatch.lastChangeTime >= canvasStillnessDuration;
  if (!isStill && checkTime - canvasWatch.firstPaintTime < canvasStillnessWaitLimit) return false;
  showCanvasAsPicture(canvasElement);
  canvasWatch.isSettled = true;
  return true;
}

// Every canvas on the printed pages, 2D or WebGL, becomes a picture of itself once it has stopped changing.
export function settlePrintedCanvases(pagesElement: HTMLElement): boolean {
  const checkTime = performance.now();
  const canvasStates = [...pagesElement.querySelectorAll("canvas")].map((canvasElement) => settleCanvas(canvasElement, checkTime));
  return canvasStates.every(Boolean);
}
