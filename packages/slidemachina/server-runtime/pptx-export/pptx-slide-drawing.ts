import { canvasShorterSide } from "../../shared-between-runtimes/canvas-size.ts";
import type PptxGenJS from "pptxgenjs";
import type { CapturedPicture } from "./slide-picture-capturing.ts";
import type { AppearanceEffect, LinePart, PaintColor, SlidePartBox, PathPart, ShapePart, SlideLayout, StrokeStyle, TextPart, VideoPart } from "./slide-part-types.ts";

export type AnimatedObject = { objectName: string; stepNumber: number; stepEffect: AppearanceEffect; isNativeShape: boolean };
export type SlideAnimation = { stepDuration: number; animatedObjects: AnimatedObject[] };
type PptxSlide = PptxGenJS.Slide;
type CustomPoint = NonNullable<PptxGenJS.ShapeProps["points"]>[number];

// The shorter side of the canvas is 1080 px and becomes the 7.5 inches of a standard PowerPoint slide.
const standardSlideHeight = 7.5;
export const inchesPerCanvasPixel = standardSlideHeight / canvasShorterSide;
const pointsPerInch = 72;
const pointsPerCanvasPixel = inchesPerCanvasPixel * pointsPerInch;
const fullTransparency = 100;
// Lines break where the browser broke them; another font on the viewer's machine only runs past the box, never adds a line.
const textWidthAllowance = 0.04;
const smallestVectorSize = 1;
const playableVideoTypes = new Set(["mp4", "m4v", "mov"]);
export const videoNamePrefix = "video ";

function toInches(canvasPixels: number): number {
  return canvasPixels * inchesPerCanvasPixel;
}

function toTransparency(paintColor: PaintColor): number {
  return Math.round((1 - paintColor.colorOpacity) * fullTransparency);
}

function describeLine(drawnStroke: StrokeStyle | undefined): PptxGenJS.ShapeLineProps {
  if (drawnStroke === undefined) return { type: "none" };
  return {
    color: drawnStroke.strokeColor.colorHex,
    transparency: toTransparency(drawnStroke.strokeColor),
    width: drawnStroke.strokeWidth * pointsPerCanvasPixel,
    dashType: drawnStroke.isDashed ? "dash" : "solid",
  };
}

function describeFill(fillColor: PaintColor | undefined): PptxGenJS.ShapeFillProps {
  return fillColor === undefined ? { type: "none" } : { color: fillColor.colorHex, transparency: toTransparency(fillColor) };
}

function placeBox(partBox: SlidePartBox) {
  return { x: toInches(partBox.leftEdge), y: toInches(partBox.upperEdge), w: toInches(partBox.boxWidth), h: toInches(partBox.boxHeight) };
}

function drawText(pptxSlide: PptxSlide, textPart: TextPart, objectName: string): void {
  const addedWidth = textPart.boxWidth * textWidthAllowance;
  const leftShift = { left: 0, justify: 0, center: addedWidth / 2, right: addedWidth }[textPart.textAlignment];
  const textRuns = textPart.textRuns.map((slideTextRun) => ({
    text: slideTextRun.runContent,
    options: {
      fontFace: slideTextRun.fontFamily,
      fontSize: slideTextRun.fontSize * pointsPerCanvasPixel,
      bold: slideTextRun.isBoldFace,
      italic: slideTextRun.isItalic,
      underline: slideTextRun.isUnderlined ? { style: "sng" as const } : undefined,
      strike: slideTextRun.isStruck ? ("sngStrike" as const) : undefined,
      color: slideTextRun.textColor.colorHex,
      transparency: toTransparency(slideTextRun.textColor),
      charSpacing: slideTextRun.letterSpacing * pointsPerCanvasPixel,
      softBreakBefore: slideTextRun.startsLine,
      outline: slideTextRun.outlineStroke && { color: slideTextRun.outlineStroke.strokeColor.colorHex, size: slideTextRun.outlineStroke.strokeWidth * pointsPerCanvasPixel },
    },
  }));
  pptxSlide.addText(textRuns, {
    ...placeBox({ ...textPart, leftEdge: textPart.leftEdge - leftShift, boxWidth: textPart.boxWidth + addedWidth }),
    margin: 0,
    valign: "top",
    align: textPart.textAlignment,
    wrap: false,
    lineSpacing: textPart.lineHeight * pointsPerCanvasPixel,
    fit: "none",
    objectName,
  });
}

function drawShape(pptxSlide: PptxSlide, shapePart: ShapePart, objectName: string): void {
  pptxSlide.addShape(shapePart.cornerRadius > 0 ? "roundRect" : "rect", {
    ...placeBox(shapePart),
    fill: describeFill(shapePart.fillColor),
    line: describeLine(shapePart.outlineStroke),
    rectRadius: toInches(shapePart.cornerRadius),
    objectName,
  });
}

function drawLine(pptxSlide: PptxSlide, linePart: LinePart, objectName: string): void {
  const [[startPointX, startPointY], [finalPointX, finalPointY]] = [linePart.startPoint, linePart.endPoint];
  pptxSlide.addShape("line", {
    x: toInches(Math.min(startPointX, finalPointX)),
    y: toInches(Math.min(startPointY, finalPointY)),
    w: toInches(Math.abs(finalPointX - startPointX)),
    h: toInches(Math.abs(finalPointY - startPointY)),
    line: describeLine(linePart.drawnStroke),
    objectName,
  });
}

// A freeform's points are inches from its own corner: the box is the span of every point, never thinner than a pixel.
function drawPath(pptxSlide: PptxSlide, pathPart: PathPart, objectName: string): void {
  const pathPoints = pathPart.pathCommands.flatMap((pathCommand) => {
    if (pathCommand.commandKind === "close") return [];
    if (pathCommand.commandKind === "quadratic") return [pathCommand.controlPoint, pathCommand.endPoint];
    if (pathCommand.commandKind === "cubic") return [pathCommand.firstControlPoint, pathCommand.secondControlPoint, pathCommand.endPoint];
    return [pathCommand.endPoint];
  });
  if (pathPoints.length === 0) return;
  const leftEdge = Math.min(...pathPoints.map(([horizontalCoordinate]) => horizontalCoordinate));
  const upperEdge = Math.min(...pathPoints.map(([, verticalCoordinate]) => verticalCoordinate));
  const boxWidth = Math.max(smallestVectorSize, Math.max(...pathPoints.map(([horizontalCoordinate]) => horizontalCoordinate)) - leftEdge);
  const boxHeight = Math.max(smallestVectorSize, Math.max(...pathPoints.map(([, verticalCoordinate]) => verticalCoordinate)) - upperEdge);
  const toLocalX = (horizontalCoordinate: number) => toInches(horizontalCoordinate - leftEdge);
  const toLocalY = (verticalCoordinate: number) => toInches(verticalCoordinate - upperEdge);
  const customPoints = pathPart.pathCommands.map((pathCommand): CustomPoint => {
    if (pathCommand.commandKind === "close") return { close: true };
    const [finalPointX, finalPointY] = pathCommand.endPoint;
    if (pathCommand.commandKind === "quadratic") {
      const [controlX, controlY] = pathCommand.controlPoint;
      return { x: toLocalX(finalPointX), y: toLocalY(finalPointY), curve: { type: "quadratic", x1: toLocalX(controlX), y1: toLocalY(controlY) } };
    }
    if (pathCommand.commandKind === "cubic") {
      const [[firstControlX, firstControlY], [secondControlX, secondControlY]] = [pathCommand.firstControlPoint, pathCommand.secondControlPoint];
      return { x: toLocalX(finalPointX), y: toLocalY(finalPointY), curve: { type: "cubic", x1: toLocalX(firstControlX), y1: toLocalY(firstControlY), x2: toLocalX(secondControlX), y2: toLocalY(secondControlY) } };
    }
    return { x: toLocalX(finalPointX), y: toLocalY(finalPointY), moveTo: pathCommand.commandKind === "move" };
  });
  // pptxgenjs draws freeforms, its types only lack the name.
  pptxSlide.addShape("custGeom" as PptxGenJS.SHAPE_NAME, {
    ...placeBox({ leftEdge, upperEdge, boxWidth, boxHeight }),
    points: customPoints,
    fill: describeFill(pathPart.fillColor),
    line: describeLine(pathPart.drawnStroke),
    objectName,
  });
}

// PowerPoint plays MP4 and QuickTime; WebM and others stay as their frame.
function drawVideo(pptxSlide: PptxSlide, videoPart: VideoPart, coverPicture: CapturedPicture | undefined, objectName: string): boolean {
  const [, videoType = "", videoBase64] = /^data:video\/([\w.+-]+);base64,(.*)$/s.exec(videoPart.videoSource) ?? [];
  if (videoBase64 === undefined || !playableVideoTypes.has(videoType)) return false;
  pptxSlide.addMedia({
    ...placeBox(videoPart),
    type: "video",
    data: `video/${videoType};base64,${videoBase64}`,
    extn: videoType,
    cover: coverPicture === undefined ? undefined : `data:${coverPicture.pictureData}`,
    objectName,
  });
  return true;
}

// Parts are drawn in the browser's painting order; every part of a step is named so the animation can find it.
export function drawSlideParts(pptxSlide: PptxSlide, slideLayout: SlideLayout, capturedPictures: Map<string, CapturedPicture | undefined>): AnimatedObject[] {
  if (slideLayout.slideBackground !== undefined) {
    pptxSlide.background = { color: slideLayout.slideBackground.colorHex, transparency: toTransparency(slideLayout.slideBackground) };
  }
  const animatedObjects: AnimatedObject[] = [];
  slideLayout.slideParts.forEach((slidePart, partPosition) => {
    const objectName = `${slidePart.partKind === "video" ? videoNamePrefix.trim() : slidePart.partKind} ${partPosition + 1}`;
    let isPartDrawn = true;
    let isNativeShape = true;
    if (slidePart.partKind === "text") drawText(pptxSlide, slidePart, objectName);
    else if (slidePart.partKind === "shape") drawShape(pptxSlide, slidePart, objectName);
    else if (slidePart.partKind === "line") drawLine(pptxSlide, slidePart, objectName);
    else if (slidePart.partKind === "path") drawPath(pptxSlide, slidePart, objectName);
    else {
      isNativeShape = false;
      const capturedPicture = capturedPictures.get(slidePart.captureMark);
      isPartDrawn = slidePart.partKind === "video" && drawVideo(pptxSlide, slidePart, capturedPicture, objectName);
      if (!isPartDrawn && capturedPicture !== undefined) {
        pptxSlide.addImage({ data: capturedPicture.pictureData, ...placeBox(capturedPicture.pictureBox), objectName });
        isPartDrawn = true;
      }
    }
    if (isPartDrawn && slidePart.stepNumber > 0) animatedObjects.push({ objectName, stepNumber: slidePart.stepNumber, stepEffect: slidePart.stepEffect, isNativeShape });
  });
  return animatedObjects;
}
