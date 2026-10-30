import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";
import { convertCssColor, describePartStep, findStepOwner, isElementRotated, measureEffectiveOpacity, measureElementScale, measureRelativeBox, readRunHighlight } from "./slide-style-reading.ts";
import { materializePseudoText } from "./pseudo-text-materializing.ts";
import { readHolderText, wrapNativeText } from "./slide-text-reading.ts";
import { isDrawableVector, readVectorPaths } from "./slide-vector-reading.ts";
import type { ExportedPage, LinePart, PaintColor, PartStep, ShapePart, SlideLayout, SlidePart, StrokeStyle } from "./slide-part-types.ts";

// Page functions, see slide-style-reading.ts. One printed slide becomes a list of native parts in painting order.
type BorderSide = { sideName: string; sideWidth: number; sideStyle: string; sideColor: PaintColor | undefined };

export const layoutPageFunctions = [
  readPaintLayer,
  readBorderSides,
  readCornerRadius,
  drawBorderSide,
  readOwnPaint,
  readWholeElement,
  readStepDuration,
  listPaintedOutsideParts,
  listExportedPages,
  readSlideLayout,
];

// The nearest z-index decides what covers what, as in the browser: the section number lies under its title.
function readPaintLayer(paintedElement: Element, pageElement: HTMLElement): number {
  for (let currentElement: Element | null = paintedElement; currentElement !== null && currentElement !== pageElement; currentElement = currentElement.parentElement) {
    const elementStyle = getComputedStyle(currentElement);
    if (elementStyle.zIndex !== "auto" && elementStyle.position !== "static") return Number(elementStyle.zIndex);
  }
  return 0;
}

function readBorderSides(elementStyle: CSSStyleDeclaration, elementScale: number, effectiveOpacity: number): BorderSide[] {
  return ["top", "right", "bottom", "left"].map((sideName) => ({
    sideName,
    sideWidth: Number.parseFloat(elementStyle.getPropertyValue(`border-${sideName}-width`)) * elementScale,
    sideStyle: elementStyle.getPropertyValue(`border-${sideName}-style`),
    sideColor: convertCssColor(elementStyle.getPropertyValue(`border-${sideName}-color`), effectiveOpacity),
  }));
}

// Undefined when the corners differ: such a box stays in the picture of the slide.
function readCornerRadius(elementStyle: CSSStyleDeclaration, elementRect: DOMRect, elementScale: number): number | undefined {
  const cornerValues = ["top-left", "top-right", "bottom-right", "bottom-left"].map((cornerName) => elementStyle.getPropertyValue(`border-${cornerName}-radius`));
  if (new Set(cornerValues).size > 1) return undefined;
  const shorterSide = Math.min(elementRect.width, elementRect.height);
  const [cornerValue = "0px"] = cornerValues[0]!.split(" ");
  const cornerRadius = cornerValue.endsWith("%") ? (Number.parseFloat(cornerValue) / pageReadingConstants.percentScale) * shorterSide : Number.parseFloat(cornerValue) * elementScale;
  return Math.min(cornerRadius, shorterSide / 2);
}

function drawBorderSide(borderSide: BorderSide, elementRect: DOMRect, pageRect: DOMRect, partStep: PartStep): LinePart {
  const halfWidth = borderSide.sideWidth / 2;
  const [leftEdge, upperEdge, rightEdge, bottomEdge] = [elementRect.left - pageRect.left, elementRect.top - pageRect.top, elementRect.right - pageRect.left, elementRect.bottom - pageRect.top];
  const sideEnds: Record<string, [[number, number], [number, number]]> = {
    top: [[leftEdge, upperEdge + halfWidth], [rightEdge, upperEdge + halfWidth]],
    bottom: [[leftEdge, bottomEdge - halfWidth], [rightEdge, bottomEdge - halfWidth]],
    left: [[leftEdge + halfWidth, upperEdge], [leftEdge + halfWidth, bottomEdge]],
    right: [[rightEdge - halfWidth, upperEdge], [rightEdge - halfWidth, bottomEdge]],
  };
  const [startPoint, endPoint] = sideEnds[borderSide.sideName]!;
  const drawnStroke: StrokeStyle = { strokeColor: borderSide.sideColor!, strokeWidth: borderSide.sideWidth, isDashed: borderSide.sideStyle !== "solid" };
  return { partKind: "line", ...partStep, startPoint, endPoint, drawnStroke };
}

// A plain fill and plain borders become a rectangle and lines; gradients, pictures and odd corners stay in the picture.
function readOwnPaint(paintedElement: HTMLElement, pageElement: HTMLElement, partStep: PartStep, slideLayout: SlideLayout): SlidePart[] {
  const elementStyle = getComputedStyle(paintedElement);
  const effectiveOpacity = measureEffectiveOpacity(paintedElement, pageElement);
  if (elementStyle.visibility !== "visible" || effectiveOpacity <= 0 || isElementRotated(paintedElement, pageElement)) return [];
  if (readRunHighlight(paintedElement, pageElement) !== undefined) {
    paintedElement.setAttribute(pptxPageMarks.runHighlight, "");
    return [];
  }
  const elementScale = measureElementScale(paintedElement);
  const fillColor = elementStyle.backgroundImage === "none" ? convertCssColor(elementStyle.backgroundColor, effectiveOpacity) : undefined;
  const borderSides = readBorderSides(elementStyle, elementScale, effectiveOpacity).filter((borderSide) => borderSide.sideWidth > 0 && borderSide.sideColor !== undefined && borderSide.sideStyle !== "none" && borderSide.sideStyle !== "hidden");
  const bordersConvert = borderSides.every((borderSide) => ["solid", "dashed", "dotted"].includes(borderSide.sideStyle));
  if (fillColor === undefined && (borderSides.length === 0 || !bordersConvert)) return [];
  const isSlideSurface = paintedElement.matches("[data-slide]");
  if (isSlideSurface && fillColor !== undefined && borderSides.length === 0) {
    slideLayout.slideBackground = fillColor;
    paintedElement.setAttribute(pptxPageMarks.convertedFill, "");
    return [];
  }
  const pageRect = pageElement.getBoundingClientRect();
  const isInlineBox = elementStyle.display === "inline";
  const elementRects = isInlineBox ? [...paintedElement.getClientRects()] : [paintedElement.getBoundingClientRect()];
  const cornerRadius = readCornerRadius(elementStyle, elementRects[0] ?? paintedElement.getBoundingClientRect(), elementScale);
  if (cornerRadius === undefined || elementRects.length === 0) return [];
  const [firstSide] = borderSides;
  const isUniformBorder =
    borderSides.length === 4 &&
    bordersConvert &&
    borderSides.every((borderSide) => borderSide.sideWidth === firstSide!.sideWidth && borderSide.sideStyle === firstSide!.sideStyle && borderSide.sideColor!.colorHex === firstSide!.sideColor!.colorHex);
  const drawsSides = !isUniformBorder && borderSides.length > 0 && bordersConvert && cornerRadius === 0 && !isInlineBox;
  const slideParts: SlidePart[] = [];
  if (fillColor !== undefined || isUniformBorder) {
    const halfBorder = isUniformBorder ? firstSide!.sideWidth / 2 : 0;
    for (const elementRect of elementRects) {
      const shapeBox = measureRelativeBox(elementRect, pageRect);
      const shapePart: ShapePart = {
        partKind: "shape",
        ...partStep,
        leftEdge: shapeBox.leftEdge + halfBorder,
        upperEdge: shapeBox.upperEdge + halfBorder,
        boxWidth: shapeBox.boxWidth - 2 * halfBorder,
        boxHeight: shapeBox.boxHeight - 2 * halfBorder,
        fillColor,
        cornerRadius,
        outlineStroke: isUniformBorder ? { strokeColor: firstSide!.sideColor!, strokeWidth: firstSide!.sideWidth, isDashed: firstSide!.sideStyle !== "solid" } : undefined,
      };
      slideParts.push(shapePart);
    }
    if (fillColor !== undefined) paintedElement.setAttribute(pptxPageMarks.convertedFill, "");
  }
  if (drawsSides) slideParts.push(...borderSides.map((borderSide) => drawBorderSide(borderSide, elementRects[0]!, pageRect, partStep)));
  if (isUniformBorder || drawsSides) paintedElement.setAttribute(pptxPageMarks.convertedBorder, "");
  return slideParts;
}

// Pictures are taken later by their mark; a video keeps its file and gets its frame as the cover.
function readWholeElement(wholeElement: Element, pageElement: HTMLElement, partStep: PartStep): SlidePart[] {
  const elementRect = wholeElement.getBoundingClientRect();
  const isHidden = getComputedStyle(wholeElement).visibility !== "visible" || measureEffectiveOpacity(wholeElement, pageElement) <= 0;
  if (isHidden || elementRect.width === 0 || elementRect.height === 0 || wholeElement instanceof HTMLIFrameElement) return [];
  const captureMark = wholeElement.getAttribute(pptxPageMarks.captureMark)!;
  const contentBox = measureRelativeBox(elementRect, pageElement.getBoundingClientRect());
  if (wholeElement instanceof HTMLVideoElement && (wholeElement.currentSrc || wholeElement.src) !== "") {
    return [{ partKind: "video", ...partStep, ...contentBox, videoSource: wholeElement.currentSrc || wholeElement.src, captureMark }];
  }
  if (wholeElement instanceof SVGSVGElement && isDrawableVector(wholeElement)) return readVectorPaths(wholeElement, pageElement, partStep);
  const pictureSource = wholeElement instanceof HTMLImageElement ? wholeElement.currentSrc : "";
  const animatedSource = /^data:image\/(gif|webp);/.test(pictureSource) ? pictureSource : undefined;
  return [{ partKind: "picture", ...partStep, captureMark, animatedSource, contentBox }];
}

// What native parts miss: a bullet, a gradient, a shadow, odd text. Nothing left, no picture; the picture frames only these.
// The backdrop of the slide is its own picture: only the slide's own paint, below anything with a negative z-index.
export function listPaintedOutsideParts(subjectElement: Element): Element[] {
  const { textWrapper, wholeElement, stepOwner, convertedFill, convertedBorder, slideBackdrop, runHighlight } = pptxPageMarks;
  const isBackdrop = subjectElement.hasAttribute(slideBackdrop);
  const paintedElements = isBackdrop
    ? [subjectElement]
    : [subjectElement, ...subjectElement.querySelectorAll(`:not([${textWrapper}], [${wholeElement}], [${wholeElement}] *, [${slideBackdrop}])`)];
  return paintedElements.filter((paintedElement) => {
    const ownerAncestor = paintedElement.closest(`[${stepOwner}]`);
    if (paintedElement !== subjectElement && ownerAncestor !== null && ownerAncestor !== subjectElement && subjectElement.contains(ownerAncestor)) return false;
    const elementStyle = getComputedStyle(paintedElement);
    if (elementStyle.display === "none" || elementStyle.visibility !== "visible") return false;
    const hasPseudoContent = ["::before", "::after"].some((pseudoName) => !["none", "normal"].includes(getComputedStyle(paintedElement, pseudoName).content));
    const hasMarker = elementStyle.display === "list-item" && elementStyle.listStyleType !== "none";
    const isRunHighlight = paintedElement.hasAttribute(runHighlight);
    const hasEffects = !isRunHighlight && (elementStyle.backgroundImage !== "none" || elementStyle.boxShadow !== "none" || (elementStyle.outlineStyle !== "none" && Number.parseFloat(elementStyle.outlineWidth) > 0));
    const hasLeftFill = !isRunHighlight && !paintedElement.hasAttribute(convertedFill) && convertCssColor(elementStyle.backgroundColor, 1) !== undefined;
    const hasLeftBorder = !isRunHighlight && !paintedElement.hasAttribute(convertedBorder) && ["top", "right", "bottom", "left"].some((sideName) => Number.parseFloat(elementStyle.getPropertyValue(`border-${sideName}-width`)) > 0);
    const hasLeftText = [...paintedElement.childNodes].some((childNode) => childNode instanceof Text && childNode.data.trim() !== "");
    return hasPseudoContent || hasMarker || hasEffects || hasLeftFill || hasLeftBorder || hasLeftText;
  });
}

function readStepDuration(pageElement: HTMLElement): number {
  const slideElement = pageElement.querySelector("[data-slide]") ?? pageElement;
  const durationText = getComputedStyle(slideElement).getPropertyValue("--step-duration").trim();
  const durationNumber = Number.parseFloat(durationText);
  if (!Number.isFinite(durationNumber)) return pageReadingConstants.defaultStepDuration;
  return durationText.endsWith("ms") ? durationNumber : durationNumber * pageReadingConstants.millisecondsPerSecond;
}

// Code line steps scroll and light lines, which no PowerPoint animation does: such a slide becomes a slide per step.
export function listExportedPages(): ExportedPage[] {
  const printedPages = [...document.querySelectorAll<HTMLElement>("[data-print-page]")];
  const exportedPages: ExportedPage[] = [];
  printedPages.forEach((printedPage, pageIndex) => {
    const nextPage = printedPages[pageIndex + 1];
    const isLastSlidePage = nextPage?.dataset.printSlide !== printedPage.dataset.printSlide;
    const isStepFrame = printedPage.querySelector("[data-code-step]") !== null;
    const isHidden = printedPage.querySelector("[data-slide][data-hidden]") !== null;
    if (isStepFrame || isLastSlidePage) exportedPages.push({ pageIndex, isStepFrame, isHidden });
  });
  return exportedPages;
}

export function readSlideLayout(pageIndex: number, isStepFrame: boolean): SlideLayout {
  const pageElement = document.querySelectorAll<HTMLElement>("[data-print-page]")[pageIndex]!;
  let captureCount = 0;
  const markForCapture = (capturedElement: Element): string => {
    captureCount += 1;
    const captureMark = `${pageIndex}-${captureCount}`;
    capturedElement.setAttribute(pptxPageMarks.captureMark, captureMark);
    return captureMark;
  };
  // A rotated block, such as a tilted meme with its captions, is one picture: native parts would stand upright.
  const rotatedElements = [...pageElement.querySelectorAll<HTMLElement>("*")].filter((pageChild) => pageChild instanceof HTMLElement && pageChild.parentElement !== null && isElementRotated(pageChild, pageChild.parentElement));
  for (const wholeElement of [...rotatedElements, ...pageElement.querySelectorAll("img, video, canvas, svg, iframe")]) {
    if (wholeElement.parentElement?.closest(`[${pptxPageMarks.wholeElement}]`)) continue;
    wholeElement.setAttribute(pptxPageMarks.wholeElement, "");
    markForCapture(wholeElement);
  }
  for (const stepElement of isStepFrame ? [] : pageElement.querySelectorAll<HTMLElement>("[data-step-index]")) {
    if (!pageReadingConstants.appearanceEffects.includes(stepElement.dataset.stepEffect ?? "rise")) continue;
    stepElement.setAttribute(pptxPageMarks.stepOwner, "");
    markForCapture(stepElement);
  }
  materializePseudoText(pageElement);
  const wrappersByHolder = wrapNativeText(pageElement);
  const slideLayout: SlideLayout = { stepDuration: readStepDuration(pageElement), slideParts: [] };
  const layeredParts: { paintLayer: number; slidePart: SlidePart }[] = [];
  const addParts = (paintedElement: Element, slideParts: SlidePart[]) => {
    const paintLayer = readPaintLayer(paintedElement, pageElement);
    for (const slidePart of slideParts) layeredParts.push({ paintLayer, slidePart });
  };
  const slideElement = pageElement.querySelector("[data-slide]");
  if (slideElement !== null) {
    slideElement.setAttribute(pptxPageMarks.slideBackdrop, "");
    layeredParts.push({ paintLayer: Number.MIN_SAFE_INTEGER, slidePart: { partKind: "picture", ...describePartStep(undefined), captureMark: markForCapture(slideElement) } });
  }
  layeredParts.push({ paintLayer: 0, slidePart: { partKind: "picture", ...describePartStep(undefined), captureMark: markForCapture(pageElement) } });

  const visitElement = (visitedElement: Element): void => {
    if (visitedElement.hasAttribute(pptxPageMarks.textWrapper) || getComputedStyle(visitedElement).display === "none") return;
    const partStep = describePartStep(findStepOwner(visitedElement, pageElement));
    if (visitedElement.hasAttribute(pptxPageMarks.wholeElement)) {
      addParts(visitedElement, readWholeElement(visitedElement, pageElement, partStep));
      return;
    }
    if (visitedElement !== pageElement && visitedElement.hasAttribute(pptxPageMarks.stepOwner)) {
      addParts(visitedElement, [{ partKind: "picture", ...partStep, captureMark: visitedElement.getAttribute(pptxPageMarks.captureMark)! }]);
    }
    if (visitedElement !== pageElement && visitedElement instanceof HTMLElement) {
      addParts(visitedElement, readOwnPaint(visitedElement, pageElement, partStep, slideLayout));
    }
    for (const childElement of visitedElement.children) visitElement(childElement);
    const holderWrappers = visitedElement instanceof HTMLElement ? wrappersByHolder.get(visitedElement) : undefined;
    if (holderWrappers !== undefined) addParts(visitedElement, readHolderText(visitedElement as HTMLElement, holderWrappers, pageElement));
  };
  visitElement(pageElement);
  const isEmptyDecoration = (slidePart: SlidePart) => {
    if (slidePart.partKind !== "picture") return false;
    const capturedElement = pageElement.parentElement!.querySelector(`[${pptxPageMarks.captureMark}="${slidePart.captureMark}"]`)!;
    return !capturedElement.hasAttribute(pptxPageMarks.wholeElement) && listPaintedOutsideParts(capturedElement).length === 0;
  };
  slideLayout.slideParts = layeredParts
    .filter(({ slidePart }) => !isEmptyDecoration(slidePart))
    .toSorted((firstPart, secondPart) => firstPart.paintLayer - secondPart.paintLayer).map(({ slidePart }) => slidePart);
  return slideLayout;
}
