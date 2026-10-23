import { findCodePairs } from "./code-morphing.ts";
import { findMorphPairs, findRewordedPairs } from "./morph-matching.ts";
import { bendCrossingPaths, type MovingLayer } from "./morph-arcs.ts";
import { markReachedSteps } from "./step-visibility.ts";
import {
  clearLayerName,
  clearLayerNames,
  describeContentLayers,
  describeWholeSlideLayers,
  nameLayer,
  nameMovingParts,
  restoreLayers,
  type NamedLayer,
} from "./transition-layers.ts";

export type SlideTransition = "auto" | "morph" | "slide" | "fade" | "zoom" | "cube" | "flip" | "none";

const wholeSlideTransitions = new Set(["slide", "zoom", "cube", "flip"]);

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
  if (document.startViewTransition === undefined || prefersReducedMotion || !outgoingSlide || !incomingSlide) {
    updateSlides();
    return;
  }

  const isMovingForward = incomingSlideIndex > outgoingSlideIndex;
  // Going back plays the same transition in reverse: it belongs to the later of the two slides.
  const requestedTransition = (isMovingForward ? incomingSlide : outgoingSlide).dataset.transition ?? "auto";
  const usesMorph = requestedTransition === "auto" || requestedTransition === "morph";
  // Pairs are looked up before the update: the hidden incoming slide shows now the step it will arrive at.
  if (usesMorph) markReachedSteps(incomingSlide, incomingStepIndex);
  const morphPairs = usesMorph ? findMorphPairs(outgoingSlide, incomingSlide) : [];
  const rewordedPairs = usesMorph ? findRewordedPairs(outgoingSlide, incomingSlide, morphPairs) : [];
  const codePairs = usesMorph ? findCodePairs(outgoingSlide, incomingSlide) : [];
  const chosenTransition = chooseTransition(requestedTransition, morphPairs.length + rewordedPairs.length + codePairs.length);
  const movesWholeSlides = wholeSlideTransitions.has(chosenTransition);
  const documentElement = document.documentElement;
  documentElement.dataset.slideTransition = chosenTransition;
  documentElement.dataset.slideDirection = isMovingForward ? "forward" : "backward";
  // The cube turns around its centre, half a slide behind the screen; CSS cannot take that from the snapshot.
  documentElement.style.setProperty("--slide-half-width", `${outgoingSlide.offsetWidth / 2}px`);

  // A key pressed mid-transition starts a new one; names left by the previous one would collide or get wiped.
  clearLayerNames(activeNamedLayers);
  restoreLayers(activeLayerRestorers);
  const namedLayers = movesWholeSlides
    ? describeWholeSlideLayers(outgoingSlide, incomingSlide)
    : describeContentLayers(outgoingSlide, incomingSlide, morphPairs, rewordedPairs, codePairs);
  activeNamedLayers = namedLayers;
  for (const namedLayer of namedLayers) {
    nameLayer(namedLayer.outgoingElement, namedLayer);
  }
  const outgoingLayerRestorers = nameMovingParts(rewordedPairs, codePairs, "outgoing");
  activeLayerRestorers = outgoingLayerRestorers;
  const movingLayers: MovingLayer[] = morphPairs.map(({ outgoingElement }, pairPosition) => ({
    layerName: `morph-${pairPosition}`,
    outgoingElement,
    startBox: outgoingElement.getBoundingClientRect(),
  }));
  const viewTransition = document.startViewTransition(() => {
    updateSlides();
    for (const namedLayer of namedLayers) {
      clearLayerName(namedLayer.outgoingElement);
    }
    restoreLayers(outgoingLayerRestorers);
    // A newer transition already owns the names; this one only applies the slide change.
    if (activeNamedLayers !== namedLayers) return;
    for (const namedLayer of namedLayers) {
      nameLayer(namedLayer.incomingElement, namedLayer);
    }
    activeLayerRestorers = nameMovingParts(rewordedPairs, codePairs, "incoming");
    morphPairs.forEach(({ incomingElement }, pairPosition) => (movingLayers[pairPosition].endBox = incomingElement.getBoundingClientRect()));
  });
  // A quick next press skips this transition on purpose; the browser would report it as an error.
  viewTransition.ready.then(() => bendCrossingPaths(movingLayers), () => {});
  void viewTransition.finished.finally(() => {
    if (activeNamedLayers !== namedLayers) return;
    clearLayerNames(namedLayers);
    restoreLayers(activeLayerRestorers);
    activeLayerRestorers = [];
  });
}
