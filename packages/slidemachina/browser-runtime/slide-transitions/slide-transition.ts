import { findCodePairs } from "../element-morphing/code-morphing.ts";
import { collectSlideCandidates, findMorphPairs, findRewordedPairs, rewordPairedTexts, type SlideMorphCandidates } from "../element-morphing/morph-matching.ts";
import { carryLeavingWords, measureWordLayers, type WordBoxes } from "../element-morphing/word-carrying.ts";
import { bendCrossingPaths, type MovingLayer } from "../element-morphing/morph-arcs.ts";
import { markReachedSteps } from "../slide-steps/step-visibility.ts";
import { findPaintedShapes, paintShapeGroups, readIncomingPaints } from "./shape-layers.ts";
import { maskSlideTiles } from "./tile-masks.ts";
import {
  clearLayerName,
  clearLayerNames,
  describeContentLayers,
  describeWholeSlideLayers,
  describeWordLayerPrefix,
  nameLayer,
  nameMovingParts,
  restoreLayers,
  type NamedLayer,
} from "./transition-layers.ts";

export type SlideTransition =
  | "auto"
  | "morph"
  | "slide"
  | "fade"
  | "zoom"
  | "cube"
  | "flip"
  | "wipe"
  | "iris"
  | "blinds"
  | "mosaic"
  | "glitch"
  | "none";

const wholeSlideTransitions = new Set(["slide", "zoom", "cube", "flip", "wipe", "iris", "blinds", "mosaic"]);
const emptyMorphCandidates: SlideMorphCandidates = { morphCandidates: [], codeBlocks: [] };

let activeNamedLayers: NamedLayer[] = [];
// Word wrappers and code piece names are taken back by these functions when a transition ends.
let activeLayerRestorers: Array<() => void> = [];

// "auto" morphs when the slides share elements and slides otherwise.
function chooseTransition(requestedTransition: string, morphPairCount: number): string {
  if (requestedTransition !== "auto") return requestedTransition;
  return morphPairCount > 0 ? "morph" : "slide";
}

export function runSlideTransition(updateSlides: () => void, outgoingSlideIndex: number, incomingSlideIndex: number, incomingStepIndex: number) {
  const slideElements = document.querySelectorAll<HTMLElement>("[data-canvas] > [data-slide]");
  const outgoingSlide = slideElements[outgoingSlideIndex];
  const incomingSlide = slideElements[incomingSlideIndex];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("startViewTransition" in document) || prefersReducedMotion || !outgoingSlide || !incomingSlide) {
    updateSlides();
    return;
  }

  const isMovingForward = incomingSlideIndex > outgoingSlideIndex;
  // Going back plays the same transition in reverse: it belongs to the later of the two slides.
  const requestedTransition = (isMovingForward ? incomingSlide : outgoingSlide).dataset.transition ?? "auto";
  const usesMorph = requestedTransition === "auto" || requestedTransition === "morph";
  // Pairs are looked up before the update: the hidden incoming slide shows now the step it will arrive at.
  if (usesMorph) markReachedSteps(incomingSlide, incomingStepIndex);
  const outgoingCandidates = usesMorph ? collectSlideCandidates(outgoingSlide) : emptyMorphCandidates;
  const incomingCandidates = usesMorph ? collectSlideCandidates(incomingSlide) : emptyMorphCandidates;
  const pairedElements = findMorphPairs(outgoingCandidates.morphCandidates, incomingCandidates.morphCandidates);
  const { shapePairs: morphPairs, textPairs } = rewordPairedTexts(pairedElements);
  const rewordedPairs = [...textPairs, ...findRewordedPairs(outgoingCandidates.morphCandidates, incomingCandidates.morphCandidates, pairedElements)];
  const codePairs = findCodePairs(outgoingCandidates.codeBlocks, incomingCandidates.codeBlocks);
  const chosenTransition = chooseTransition(requestedTransition, morphPairs.length + rewordedPairs.length + codePairs.length);
  const movesWholeSlides = wholeSlideTransitions.has(chosenTransition);
  const documentElement = document.documentElement;
  documentElement.dataset.slideTransition = chosenTransition;
  documentElement.dataset.slideDirection = isMovingForward ? "forward" : "backward";
  // Light and dark backgrounds swap at once in the middle: a cross-fade between them is a grey frame.
  documentElement.toggleAttribute("data-tone-change", outgoingSlide.dataset.tone !== incomingSlide.dataset.tone);
  // The page root carries the transition layers, so it takes the speed of the slide whose transition plays.
  documentElement.style.setProperty("--transition-speed", (isMovingForward ? incomingSlide : outgoingSlide).style.getPropertyValue("--transition-speed") || "1");
  // The cube turns around its centre, half a slide behind the screen; CSS cannot take that from the snapshot.
  documentElement.style.setProperty("--slide-half-width", `${outgoingSlide.offsetWidth / 2}px`);

  // A key pressed mid-transition starts a new one; names left by the previous one would collide or get wiped.
  clearLayerNames(activeNamedLayers);
  restoreLayers(activeLayerRestorers);
  const namedLayers = movesWholeSlides
    ? describeWholeSlideLayers(outgoingSlide, incomingSlide, chosenTransition)
    : describeContentLayers(outgoingSlide, incomingSlide, morphPairs, rewordedPairs, codePairs);
  activeNamedLayers = namedLayers;
  documentElement.toggleAttribute("data-color-flood", namedLayers.some((namedLayer) => namedLayer.layerClass === "slide-color"));
  const paintedShapes = findPaintedShapes(namedLayers);
  for (const namedLayer of namedLayers) {
    nameLayer(namedLayer.outgoingElement, namedLayer);
  }
  const outgoingLayerRestorers = nameMovingParts(rewordedPairs, codePairs, "outgoing");
  activeLayerRestorers = outgoingLayerRestorers;
  const outgoingWordBoxes = measureWordLayers(rewordedPairs.map((rewordedPair) => rewordedPair.outgoingElement));
  let incomingWordBoxes: WordBoxes = new Map();
  // Apart parts such as diagram arrows cover the whole diagram: they would all look like crossing paths.
  const movingLayers: MovingLayer[] = morphPairs.flatMap(({ outgoingElement, incomingElement }, pairPosition) =>
    outgoingElement.hasAttribute("data-morph-apart")
      ? []
      : [{ layerName: `morph-${pairPosition}`, outgoingElement, incomingElement, startBox: outgoingElement.getBoundingClientRect() }],
  );
  const viewTransition = document.startViewTransition(() => {
    updateSlides();
    for (const namedLayer of namedLayers) {
      clearLayerName(namedLayer.outgoingElement);
    }
    restoreLayers(outgoingLayerRestorers);
    // A newer transition already owns the names; this one only applies the slide change.
    if (activeNamedLayers !== namedLayers) return;
    readIncomingPaints(paintedShapes);
    for (const namedLayer of namedLayers) {
      nameLayer(namedLayer.incomingElement, namedLayer);
    }
    activeLayerRestorers = nameMovingParts(rewordedPairs, codePairs, "incoming");
    incomingWordBoxes = measureWordLayers(rewordedPairs.map((rewordedPair) => rewordedPair.incomingElement));
    for (const movingLayer of movingLayers) movingLayer.endBox = movingLayer.incomingElement.getBoundingClientRect();
  });
  // A quick next press skips this transition on purpose; the browser would report it as an error.
  let shapePaints: Animation[] = [];
  viewTransition.ready.then(
    () => {
      bendCrossingPaths(movingLayers);
      shapePaints = [
        ...paintShapeGroups(paintedShapes),
        ...carryLeavingWords(rewordedPairs, describeWordLayerPrefix, outgoingWordBoxes, incomingWordBoxes),
        ...maskSlideTiles(chosenTransition, outgoingSlide, isMovingForward),
      ];
    },
    () => {},
  );
  void viewTransition.finished.finally(() => {
    for (const shapePaint of shapePaints) shapePaint.cancel();
    if (activeNamedLayers !== namedLayers) return;
    clearLayerNames(namedLayers);
    restoreLayers(activeLayerRestorers);
    activeLayerRestorers = [];
  });
}
