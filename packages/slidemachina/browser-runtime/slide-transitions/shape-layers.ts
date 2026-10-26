import { findBrowserMove } from "../element-morphing/morph-arcs.ts";
import type { NamedLayer } from "./transition-layers.ts";

const paintedMediaSelector = "img, svg, video, canvas, iframe";
const transparentColor = "rgba(0, 0, 0, 0)";
const borderSides = ["top", "right", "bottom", "left"];

type ShapePaint = Record<"backgroundColor" | "borderRadius" | "border" | "boxShadow" | "opacity", string>;
export type PaintedShape = {
  layerName: string;
  outgoingPaint: ShapePaint;
  incomingElement: HTMLElement;
  incomingPaint?: ShapePaint;
};

function readSideBorder(shapeStyle: CSSStyleDeclaration, borderSide: string): string {
  return ["width", "style", "color"].map((borderPart) => shapeStyle.getPropertyValue(`border-${borderSide}-${borderPart}`)).join(" ");
}

function readShapePaint(shapeElement: HTMLElement): ShapePaint {
  const shapeStyle = getComputedStyle(shapeElement);
  return {
    backgroundColor: shapeStyle.backgroundColor,
    borderRadius: shapeStyle.borderRadius,
    border: readSideBorder(shapeStyle, "top"),
    boxShadow: shapeStyle.boxShadow,
    opacity: shapeStyle.opacity,
  };
}

function holdsOwnText(paintedElement: Element): boolean {
  return [...paintedElement.childNodes].some((childNode) => childNode.nodeType === Node.TEXT_NODE && childNode.textContent!.trim() !== "");
}

function paintsItself(paintedElement: Element): boolean {
  const paintedStyle = getComputedStyle(paintedElement);
  return (
    paintedStyle.backgroundColor !== transparentColor ||
    paintedStyle.backgroundImage !== "none" ||
    paintedStyle.boxShadow !== "none" ||
    borderSides.some((borderSide) => paintedStyle.getPropertyValue(`border-${borderSide}-width`) !== "0px")
  );
}

// Everything inside moves in layers of its own, so the snapshot holds only the background, border and shadow; a picture is its own content.
function isPlainShape(shapeElement: HTMLElement, layeredElements: Set<Element>): boolean {
  const shapeStyle = getComputedStyle(shapeElement);
  const sideBorders = new Set(borderSides.map((borderSide) => readSideBorder(shapeStyle, borderSide)));
  if (shapeElement.matches(paintedMediaSelector) || shapeStyle.backgroundImage !== "none" || sideBorders.size > 1 || holdsOwnText(shapeElement)) return false;
  const hasPaintedInside = (parentElement: Element): boolean =>
    [...parentElement.children].some(
      (childElement) =>
        !layeredElements.has(childElement) &&
        (holdsOwnText(childElement) || childElement.matches(paintedMediaSelector) || paintsItself(childElement) || hasPaintedInside(childElement)),
    );
  return !hasPaintedInside(shapeElement);
}

// A stretched snapshot stretches its corners too; a plain shape is drawn by its layer group instead, so the radius stays true while the size changes.
export function findPaintedShapes(namedLayers: NamedLayer[]): PaintedShape[] {
  const layeredElements = new Set<Element>(namedLayers.flatMap((namedLayer) => [namedLayer.outgoingElement, namedLayer.incomingElement].filter((layeredElement) => layeredElement !== null)));
  return namedLayers.flatMap((namedLayer) => {
    const { outgoingElement, incomingElement } = namedLayer;
    const isMorphedShape = namedLayer.layerClass === "morph-shape" && outgoingElement !== null && incomingElement !== null;
    if (!isMorphedShape || !isPlainShape(outgoingElement, layeredElements) || !isPlainShape(incomingElement, layeredElements)) return [];
    namedLayer.layerClass = "plain-shape";
    return [{ layerName: namedLayer.layerName, outgoingPaint: readShapePaint(outgoingElement), incomingElement }];
  });
}

export function readIncomingPaints(paintedShapes: PaintedShape[]) {
  for (const paintedShape of paintedShapes) paintedShape.incomingPaint = readShapePaint(paintedShape.incomingElement);
}

// Runs once the transition is ready: the group takes the paint of both shapes with the timing of the browser's own resize.
// The paint holds to the last frame; the caller cancels it when the transition ends, or it would stay on the page root.
export function paintShapeGroups(paintedShapes: PaintedShape[]): Animation[] {
  return paintedShapes.flatMap(({ layerName, outgoingPaint, incomingPaint }) => {
    const groupSelector = `::view-transition-group(${layerName})`;
    const browserMove = findBrowserMove(groupSelector);
    if (incomingPaint === undefined || !browserMove?.effect) return [];
    return [document.documentElement.animate([outgoingPaint, incomingPaint], { ...browserMove.effect.getTiming(), fill: "both", pseudoElement: groupSelector })];
  });
}
