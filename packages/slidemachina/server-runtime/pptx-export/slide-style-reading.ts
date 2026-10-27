import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";
import type { AppearanceEffect, PaintColor, SlidePartBox, PartStep } from "./slide-part-types.ts";

// These functions run in the page, sent there as text: they may call each other, pptxPageMarks and pageReadingConstants, nothing else.
type ColorMemory = { colorContext: CanvasRenderingContext2D; convertedColors: Map<string, PaintColor | undefined> };
type PageWithColorMemory = typeof globalThis & { pptxColorMemory?: ColorMemory; pptxSpaceWidths?: Map<string, number> };

export const stylePageFunctions = [
  convertCssColor,
  measureSpaceWidth,
  pickViewerFont,
  measureEffectiveOpacity,
  blendOverBackdrop,
  readRunHighlight,
  isElementRotated,
  measureElementScale,
  findStepOwner,
  describePartStep,
  measureRelativeBox,
];

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

// A font the page loads itself is almost never on the viewer's machine, and PowerPoint keeps no fallback list:
// the run takes the first font of the CSS list the page does not load, or Arial, or Courier New for code.
export function pickViewerFont(fontFamilyList: string): string {
  const unquoteFamily = (familyName: string) => familyName.trim().replaceAll(/^["']|["']$/g, "");
  const pageFontFamilies = new Set([...document.fonts].map((fontFace) => unquoteFamily(fontFace.family)));
  const listedFamilies = fontFamilyList.split(",").map(unquoteFamily);
  const installedFamily = listedFamilies.find((familyName) => !pageFontFamilies.has(familyName) && !pageReadingConstants.genericFamilies.includes(familyName));
  if (installedFamily !== undefined) return installedFamily;
  const isCodeFont = listedFamilies.some((familyName) => pageReadingConstants.monospaceFamilies.includes(familyName));
  return isCodeFont ? pageReadingConstants.viewerCodeFont : pageReadingConstants.viewerTextFont;
}

export function measureEffectiveOpacity(paintedElement: Element, pageElement: Element): number {
  let effectiveOpacity = 1;
  for (let currentElement: Element | null = paintedElement; currentElement !== null && currentElement !== pageElement; currentElement = currentElement.parentElement) {
    effectiveOpacity *= Number.parseFloat(getComputedStyle(currentElement).opacity);
  }
  return effectiveOpacity;
}

// A translucent fill goes over the fills under it down to an opaque one; a picture or nothing opaque underneath gives no colour.
export function blendOverBackdrop(paintColor: PaintColor, paintedElement: Element, pageElement: Element): PaintColor | undefined {
  const readChannels = (colorHex: string) => [0, 2, 4].map((channelStart) => Number.parseInt(colorHex.slice(channelStart, channelStart + 2), pageReadingConstants.hexadecimalBase));
  let blendedChannels = readChannels(paintColor.colorHex);
  let blendedOpacity = paintColor.colorOpacity;
  const paintedRect = paintedElement.getBoundingClientRect();
  const [paintedCentreX, paintedCentreY] = [(paintedRect.left + paintedRect.right) / 2, (paintedRect.top + paintedRect.bottom) / 2];
  const liesOverPicture = [...pageElement.querySelectorAll(`[${pptxPageMarks.wholeElement}]`)].some((wholeElement) => {
    const pictureRect = wholeElement.getBoundingClientRect();
    return paintedCentreX >= pictureRect.left && paintedCentreX <= pictureRect.right && paintedCentreY >= pictureRect.top && paintedCentreY <= pictureRect.bottom;
  });
  if (blendedOpacity < 1 && liesOverPicture) return undefined;
  for (let currentElement = paintedElement.parentElement; currentElement !== null && currentElement !== pageElement; currentElement = currentElement.parentElement) {
    if (blendedOpacity >= 1) break;
    const elementStyle = getComputedStyle(currentElement);
    if (elementStyle.backgroundImage !== "none") return undefined;
    const backdropColor = convertCssColor(elementStyle.backgroundColor, 1);
    if (backdropColor === undefined) continue;
    const backdropChannels = readChannels(backdropColor.colorHex);
    const combinedOpacity = blendedOpacity + backdropColor.colorOpacity * (1 - blendedOpacity);
    blendedChannels = blendedChannels.map(
      (colorChannel, channelIndex) => (colorChannel * blendedOpacity + backdropChannels[channelIndex]! * backdropColor.colorOpacity * (1 - blendedOpacity)) / combinedOpacity,
    );
    blendedOpacity = combinedOpacity;
  }
  if (blendedOpacity < 1) return undefined;
  const colorHex = blendedChannels.map((colorChannel) => Math.round(colorChannel).toString(pageReadingConstants.hexadecimalBase).padStart(2, "0")).join("");
  return { colorHex, colorOpacity: 1 };
}

// An inline box with a plain fill behind native text, such as code or a key, becomes the highlight of its run:
// a shape at the browser's place misses the letters once PowerPoint sets them in its own font.
export function readRunHighlight(paintedElement: Element, pageElement: Element): PaintColor | undefined {
  const elementStyle = getComputedStyle(paintedElement);
  if (elementStyle.display !== "inline" || elementStyle.backgroundImage !== "none" || paintedElement.querySelector(`[${pptxPageMarks.textWrapper}]`) === null) return undefined;
  const fillColor = convertCssColor(elementStyle.backgroundColor, measureEffectiveOpacity(paintedElement, pageElement));
  return fillColor === undefined ? undefined : blendOverBackdrop(fillColor, paintedElement, pageElement);
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
