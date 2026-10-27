import { pageReadingConstants } from "./pptx-page-marks.ts";
import { convertCssColor, measureEffectiveOpacity } from "./slide-style-reading.ts";
import type { PartStep, PathCommand, PathPart } from "./slide-part-types.ts";

// Page functions, see slide-style-reading.ts. Arrows of diagrams are plain paths: they become PowerPoint freeforms.
type RawCommand = { commandLetter: string; commandNumbers: number[] };

export const vectorPageFunctions = [parseVectorPath, isDrawableVector, convertPathCommands, readVectorPaths];

// Only absolute and relative M, L, H, V, Q, C and Z: arcs and smooth curves make the vector a picture.
export function parseVectorPath(pathData: string): RawCommand[] | undefined {
  const pathTokens = pathData.match(/[a-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const rawCommands: RawCommand[] = [];
  for (const pathToken of pathTokens) {
    if (/[a-z]/i.test(pathToken)) {
      if (!/[mlhvqcz]/i.test(pathToken)) return undefined;
      rawCommands.push({ commandLetter: pathToken, commandNumbers: [] });
    } else {
      const lastCommand = rawCommands.at(-1);
      if (lastCommand === undefined) return undefined;
      lastCommand.commandNumbers.push(Number(pathToken));
    }
  }
  return rawCommands;
}

export function isDrawableVector(vectorElement: SVGSVGElement): boolean {
  const vectorChildren = [...vectorElement.querySelectorAll("*")];
  if (vectorChildren.some((vectorChild) => !["path", "g", "title", "desc"].includes(vectorChild.localName))) return false;
  const vectorPaths = vectorElement.querySelectorAll("path");
  if (vectorPaths.length === 0 || vectorPaths.length > pageReadingConstants.maximalVectorPaths) return false;
  return [...vectorPaths].every((vectorPath) => {
    const pathStyle = getComputedStyle(vectorPath);
    const usesPaintServer = pathStyle.fill.includes("url(") || pathStyle.stroke.includes("url(");
    const fillsEvenOdd = pathStyle.fill !== "none" && pathStyle.fillRule === "evenodd";
    return !usesPaintServer && !fillsEvenOdd && parseVectorPath(vectorPath.getAttribute("d") ?? "") !== undefined;
  });
}

// Points go through the path's screen matrix: diagram scaling and the viewBox included.
function convertPathCommands(rawCommands: RawCommand[], pathMatrix: DOMMatrix, pageRect: DOMRect): PathCommand[] {
  const pathCommands: PathCommand[] = [];
  let [currentX, currentY, subpathX, subpathY] = [0, 0, 0, 0];
  const placePoint = (horizontalCoordinate: number, verticalCoordinate: number): [number, number] => {
    const placedPoint = new DOMPoint(horizontalCoordinate, verticalCoordinate).matrixTransform(pathMatrix);
    return [placedPoint.x - pageRect.left, placedPoint.y - pageRect.top];
  };
  for (const { commandLetter, commandNumbers } of rawCommands) {
    const lowerLetter = commandLetter.toLowerCase();
    const isRelative = commandLetter === lowerLetter;
    const parameterCount = pageReadingConstants.pathParameterCounts[lowerLetter]!;
    if (parameterCount === 0) {
      pathCommands.push({ commandKind: "close" });
      [currentX, currentY] = [subpathX, subpathY];
      continue;
    }
    for (let parameterOffset = 0; parameterOffset + parameterCount <= commandNumbers.length; parameterOffset += parameterCount) {
      const commandParameters = commandNumbers.slice(parameterOffset, parameterOffset + parameterCount);
      const relativeShiftX = isRelative ? currentX : 0;
      const relativeShiftY = isRelative ? currentY : 0;
      if (lowerLetter === "h" || lowerLetter === "v") {
        if (lowerLetter === "h") currentX = commandParameters[0]! + relativeShiftX;
        else currentY = commandParameters[0]! + relativeShiftY;
        pathCommands.push({ commandKind: "line", endPoint: placePoint(currentX, currentY) });
        continue;
      }
      const absolutePoints = [];
      for (let coordinateOffset = 0; coordinateOffset < commandParameters.length; coordinateOffset += 2) {
        absolutePoints.push(placePoint(commandParameters[coordinateOffset]! + relativeShiftX, commandParameters[coordinateOffset + 1]! + relativeShiftY));
      }
      currentX = commandParameters.at(-2)! + relativeShiftX;
      currentY = commandParameters.at(-1)! + relativeShiftY;
      const endPoint = absolutePoints.at(-1)!;
      if (lowerLetter === "q") pathCommands.push({ commandKind: "quadratic", controlPoint: absolutePoints[0]!, endPoint });
      else if (lowerLetter === "c") pathCommands.push({ commandKind: "cubic", firstControlPoint: absolutePoints[0]!, secondControlPoint: absolutePoints[1]!, endPoint });
      else if (lowerLetter === "m" && parameterOffset === 0) {
        pathCommands.push({ commandKind: "move", endPoint });
        [subpathX, subpathY] = [currentX, currentY];
      } else pathCommands.push({ commandKind: "line", endPoint });
    }
  }
  return pathCommands;
}

export function readVectorPaths(vectorElement: SVGSVGElement, pageElement: HTMLElement, partStep: PartStep): PathPart[] {
  const pageRect = pageElement.getBoundingClientRect();
  const pathParts: PathPart[] = [];
  for (const vectorPath of vectorElement.querySelectorAll("path")) {
    const pathMatrix = vectorPath.getScreenCTM();
    const rawCommands = parseVectorPath(vectorPath.getAttribute("d") ?? "");
    if (pathMatrix === null || rawCommands === undefined) continue;
    const pathStyle = getComputedStyle(vectorPath);
    if (pathStyle.visibility !== "visible" || pathStyle.display === "none") continue;
    const effectiveOpacity = measureEffectiveOpacity(vectorPath, pageElement);
    const fillColor = pathStyle.fill === "none" ? undefined : convertCssColor(pathStyle.fill, effectiveOpacity * Number.parseFloat(pathStyle.fillOpacity));
    const strokeColor = pathStyle.stroke === "none" ? undefined : convertCssColor(pathStyle.stroke, effectiveOpacity * Number.parseFloat(pathStyle.strokeOpacity));
    const strokeWidth = Number.parseFloat(pathStyle.strokeWidth) * Math.hypot(pathMatrix.a, pathMatrix.b);
    // A dash pattern over pathLength draws the line in, it is not a dashed line.
    const isDashed = pathStyle.strokeDasharray !== "none" && !vectorPath.hasAttribute("pathLength");
    if (fillColor === undefined && (strokeColor === undefined || strokeWidth <= 0)) continue;
    pathParts.push({
      partKind: "path",
      ...partStep,
      pathCommands: convertPathCommands(rawCommands, pathMatrix, pageRect),
      fillColor,
      drawnStroke: strokeColor === undefined || strokeWidth <= 0 ? undefined : { strokeColor, strokeWidth, isDashed },
    });
  }
  return pathParts;
}
