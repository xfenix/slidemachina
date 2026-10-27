import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";
import type { AppearanceEffect, PaintColor, SlidePartBox, PartStep } from "./slide-part-types.ts";

// These functions run in the page, sent there as text: they may call each other, pptxPageMarks and pageReadingConstants, nothing else.
type ColorMemory = { colorContext: CanvasRenderingContext2D; convertedColors: Map<string, PaintColor | undefined> };
type PageWithColorMemory = typeof globalThis & { pptxColorMemory?: ColorMemory; pptxSpaceWidths?: Map<string, number> };

export const stylePageFunctions = [convertCssColor, measureSpaceWidth, measureEffectiveOpacity, isElementRotated, measureElementScale, findStepOwner, describePartStep, measureRelativeBox];

// A 1×1 canvas turns any CSS colour, oklch and color-mix included, into sRGB bytes.
export function convertCssColor(cssColor: string, extraOpacity: number): PaintColor | undefined {
  const pageGlobal = globalThis as PageWithColorMemory;
  if (pageGlobal.pptxColorMemory === undefined) {
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = 1;
    colorCanvas.height = 1;
    pageGlobal.pptxColorMemory = { colorContext: colorCanvas.getContext("2d", { willReadFrequently: true })!, convertedColors: new Map() };
  }
  const { colorContext, convertedColors } = pageGlobal.pptxColorMemory;
  if (!convertedColors.has(cssColor)) {
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = "#000";
    colorContext.fillStyle = cssColor;
    colorContext.fillRect(0, 0, 1, 1);
    const [redChannel = 0, greenChannel = 0, blueChannel = 0, alphaChannel = 0] = colorContext.getImageData(0, 0, 1, 1).data;
    const colorHex = [redChannel, greenChannel, blueChannel].map((colorChannel) => colorChannel.toString(pageReadingConstants.hexadecimalBase).padStart(2, "0")).join("");
    convertedColors.set(cssColor, alphaChannel === 0 ? undefined : { colorHex, colorOpacity: alphaChannel / pageReadingConstants.fullChannel });
  }
  const convertedColor = convertedColors.get(cssColor);
  if (convertedColor === undefined || extraOpacity <= 0) return undefined;
  return { colorHex: convertedColor.colorHex, colorOpacity: convertedColor.colorOpacity * extraOpacity };
}

export function measureSpaceWidth(fontShorthand: string): number {
  const pageGlobal = globalThis as PageWithColorMemory;
  pageGlobal.pptxSpaceWidths ??= new Map();
  if (!pageGlobal.pptxSpaceWidths.has(fontShorthand)) {
    const measuringContext = document.createElement("canvas").getContext("2d")!;
    measuringContext.font = fontShorthand;
    pageGlobal.pptxSpaceWidths.set(fontShorthand, measuringContext.measureText(" ").width);
  }
  return pageGlobal.pptxSpaceWidths.get(fontShorthand)!;
}

export function measureEffectiveOpacity(paintedElement: Element, pageElement: Element): number {
  let effectiveOpacity = 1;
  for (let currentElement: Element | null = paintedElement; currentElement !== null && currentElement !== pageElement; currentElement = currentElement.parentElement) {
    effectiveOpacity *= Number.parseFloat(getComputedStyle(currentElement).opacity);
  }
  return effectiveOpacity;
}

// Rotated text and boxes stay in the picture of the slide: a native object here would stand upright.
export function isElementRotated(paintedElement: Element, pageElement: Element): boolean {
  for (let currentElement: Element | null = paintedElement; currentElement !== null && currentElement !== pageElement; currentElement = currentElement.parentElement) {
    const elementStyle = getComputedStyle(currentElement);
    if (elementStyle.rotate !== "none") return true;
    const elementTransform = elementStyle.transform;
    if (elementTransform === "none") continue;
    const transformMatrix = new DOMMatrix(elementTransform);
    if (Math.abs(transformMatrix.b) > pageReadingConstants.rotationTolerance || Math.abs(transformMatrix.c) > pageReadingConstants.rotationTolerance || !transformMatrix.is2D) return true;
  }
  return false;
}

// A diagram reaches the frame by scaling: sizes from computed styles shrink or grow with it.
export function measureElementScale(paintedElement: Element): number {
  if (!(paintedElement instanceof HTMLElement) || paintedElement.offsetWidth === 0) return 1;
  return paintedElement.getBoundingClientRect().width / paintedElement.offsetWidth;
}

// highlight and dim change a visible element, so only appearing steps become entrance animations.
export function findStepOwner(paintedNode: Node, pageElement: Element): HTMLElement | undefined {
  const startElement = paintedNode instanceof HTMLElement ? paintedNode : paintedNode.parentElement;
  for (let currentElement = startElement; currentElement !== null && currentElement !== pageElement; currentElement = currentElement.parentElement) {
    if (currentElement instanceof HTMLElement && currentElement.hasAttribute(pptxPageMarks.stepOwner)) return currentElement;
  }
  return undefined;
}

export function describePartStep(stepOwner: HTMLElement | undefined): PartStep {
  if (stepOwner === undefined) return { stepNumber: 0, stepEffect: "fade" };
  const stepEffect = (stepOwner.dataset.stepEffect ?? "rise") as AppearanceEffect;
  return { stepNumber: Number(stepOwner.dataset.stepIndex), stepEffect };
}

export function measureRelativeBox(clientRect: DOMRect, pageRect: DOMRect): SlidePartBox {
  return { leftEdge: clientRect.left - pageRect.left, upperEdge: clientRect.top - pageRect.top, boxWidth: clientRect.width, boxHeight: clientRect.height };
}
