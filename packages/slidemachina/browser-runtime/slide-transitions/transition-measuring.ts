import type { CodePair } from "../element-morphing/code-morphing.ts";
import type { MorphPair, RewordedPair } from "../element-morphing/morph-matching.ts";
import { measureWordLayers, type WordBoxes } from "../element-morphing/word-carrying.ts";
import { markReachedSteps } from "../slide-steps/step-visibility.ts";
import { findPaintedShapes, readIncomingPaints, type PaintedShape } from "./shape-layers.ts";
import { clearLayerNames, describeContentLayers, nameLayer, nameMovingParts, restoreLayers } from "./transition-layers.ts";

export type LayerBoxes = { startBox: DOMRect; endBox: DOMRect };
export type TransitionPressMeasurements = {
  paintedShapes: PaintedShape[];
  paintedLayerClasses: Map<string, string>;
  outgoingWordBoxes: WordBoxes;
  incomingWordBoxes: WordBoxes;
  movingLayerBoxes: Map<string, LayerBoxes>;
  contentStamp: number;
};

// Loaded fonts and a hot update move words and shapes: measurements taken before them describe another layout.
let contentGeneration = 0;
document.fonts.addEventListener("loadingdone", () => {
  contentGeneration += 1;
});
import.meta.hot?.on("vite:afterUpdate", () => {
  contentGeneration += 1;
});

export function readContentGeneration(): number {
  return contentGeneration;
}

export type MeasuredTransitionParts = {
  outgoingElement: HTMLElement;
  incomingElement: HTMLElement;
  morphPairs: MorphPair[];
  rewordedPairs: RewordedPair[];
  codePairs: CodePair[];
};

export type MeasuredTransitionSteps = {
  outgoingMeasureStep: number;
  incomingMeasureStep: number;
  outgoingRestoreStep: number;
  incomingRestoreStep: number;
};

// A dry run of the press-time layer work in an idle moment: the same wrapping and naming, the same reads,
// undone inside one task. A press then finds the boxes ready and forces no layout of its own.
// Only relative boxes are kept (deltas and midpoints), so a canvas rescale alone never invalidates them.
export function measureTransitionPressWork(
  { outgoingElement, incomingElement, morphPairs, rewordedPairs, codePairs }: MeasuredTransitionParts,
  { outgoingMeasureStep, incomingMeasureStep, outgoingRestoreStep, incomingRestoreStep }: MeasuredTransitionSteps,
): TransitionPressMeasurements {
  markReachedSteps(outgoingElement, outgoingMeasureStep);
  markReachedSteps(incomingElement, incomingMeasureStep);
  try {
    const namedLayers = describeContentLayers(outgoingElement, incomingElement, morphPairs, rewordedPairs, codePairs);
    const paintedShapes = findPaintedShapes(namedLayers);
    const paintedLayerClasses = new Map(namedLayers.filter((namedLayer) => namedLayer.layerClass !== undefined).map((namedLayer) => [namedLayer.layerName, namedLayer.layerClass!]));
    for (const namedLayer of namedLayers) nameLayer(namedLayer.incomingElement, namedLayer);
    readIncomingPaints(paintedShapes);
    const outgoingRestorers = nameMovingParts(rewordedPairs, codePairs, "outgoing");
    const incomingRestorers = nameMovingParts(rewordedPairs, codePairs, "incoming");
    try {
      const outgoingWordBoxes = measureWordLayers(rewordedPairs.map((rewordedPair) => rewordedPair.outgoingElement));
      const incomingWordBoxes = measureWordLayers(rewordedPairs.map((rewordedPair) => rewordedPair.incomingElement));
      const movingLayerBoxes = new Map<string, LayerBoxes>(
        morphPairs
          .filter(({ outgoingElement: pairOutgoing }) => !pairOutgoing.hasAttribute("data-morph-apart"))
          .map(({ outgoingElement: pairOutgoing, incomingElement: pairIncoming }, pairPosition) => [
            `morph-${pairPosition}`,
            { startBox: pairOutgoing.getBoundingClientRect(), endBox: pairIncoming.getBoundingClientRect() },
          ]),
      );
      return { paintedShapes, paintedLayerClasses, outgoingWordBoxes, incomingWordBoxes, movingLayerBoxes, contentStamp: contentGeneration };
    } finally {
      clearLayerNames(namedLayers);
      restoreLayers([...outgoingRestorers, ...incomingRestorers]);
    }
  } finally {
    markReachedSteps(outgoingElement, outgoingRestoreStep);
    markReachedSteps(incomingElement, incomingRestoreStep);
  }
}
