import { findCodePairs, type CodePair } from "../element-morphing/code-morphing.ts";
import {
  collectSlideCandidates,
  findMorphPairs,
  findRewordedPairs,
  rewordPairedTexts,
  type MorphPair,
  type RewordedPair,
} from "../element-morphing/morph-matching.ts";
import type { StepReachedPredicate } from "../element-morphing/word-morphing.ts";
import { runInIdleBackgroundTurn } from "../presentation-core/idle-background-turns.ts";
import { findNeighbourSlide, type SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";

const liveSlideSelector = "[data-canvas] > [data-slide]";
const precachedAnalysisLimit = 48;

export type SlideTransitionAnalysis = {
  outgoingElement: HTMLElement;
  incomingElement: HTMLElement;
  morphPairs: MorphPair[];
  rewordedPairs: RewordedPair[];
  codePairs: CodePair[];
  chosenTransition: string;
  // Text lengths of both slide contents: a cheap proof that a cached analysis still describes the DOM.
  outgoingContentLength: number;
  incomingContentLength: number;
};

export type SlideTransitionPosition = {
  outgoingSlideIndex: number;
  outgoingStepIndex: number;
  incomingSlideIndex: number;
  incomingStepIndex: number;
};

const precachedAnalyses = new Map<string, SlideTransitionAnalysis>();

// "auto" morphs when the slides share elements and slides otherwise.
export function chooseTransition(requestedTransition: string, morphPairCount: number): string {
  if (requestedTransition !== "auto") return requestedTransition;
  return morphPairCount > 0 ? "morph" : "slide";
}

function createReachedStepPredicate(revealedStepIndex: number): StepReachedPredicate {
  return (stepElement) => Number(stepElement.dataset.stepIndex) <= revealedStepIndex;
}

function describeAnalysisCacheKey(
  requestedTransition: string,
  { outgoingSlideIndex, outgoingStepIndex, incomingSlideIndex, incomingStepIndex }: SlideTransitionPosition,
): string {
  return `${outgoingSlideIndex}:${outgoingStepIndex}:${incomingSlideIndex}:${incomingStepIndex}:${requestedTransition}`;
}

// Pairs are looked up before the update: the hidden incoming slide shows now the step it will arrive at,
// so a background pass passes the arrival step as a predicate instead of writing it into the DOM.
export function analyseSlideTransition(
  outgoingElement: HTMLElement,
  incomingElement: HTMLElement,
  requestedTransition: string,
  isOutgoingStepReached?: StepReachedPredicate,
  isIncomingStepReached?: StepReachedPredicate,
): SlideTransitionAnalysis {
  const outgoingCandidates = collectSlideCandidates(outgoingElement, isOutgoingStepReached);
  const incomingCandidates = collectSlideCandidates(incomingElement, isIncomingStepReached);
  const pairedElements = findMorphPairs(outgoingCandidates.morphCandidates, incomingCandidates.morphCandidates);
  const { shapePairs, textPairs } = rewordPairedTexts(pairedElements, isOutgoingStepReached, isIncomingStepReached);
  const rewordedPairs = [
    ...textPairs,
    ...findRewordedPairs(
      outgoingCandidates.morphCandidates,
      incomingCandidates.morphCandidates,
      pairedElements,
      isOutgoingStepReached,
      isIncomingStepReached,
    ),
  ];
  const codePairs = findCodePairs(outgoingCandidates.codeBlocks, incomingCandidates.codeBlocks);
  return {
    outgoingElement,
    incomingElement,
    morphPairs: shapePairs,
    rewordedPairs,
    codePairs,
    chosenTransition: chooseTransition(requestedTransition, shapePairs.length + rewordedPairs.length + codePairs.length),
    outgoingContentLength: outgoingElement.querySelector("[data-content]")?.textContent.length ?? 0,
    incomingContentLength: incomingElement.querySelector("[data-content]")?.textContent.length ?? 0,
  };
}

function readContentElementLength(slideElement: HTMLElement): number {
  return slideElement.querySelector("[data-content]")?.textContent.length ?? 0;
}

function hasUnchangedContent(analysis: SlideTransitionAnalysis): boolean {
  return (
    readContentElementLength(analysis.outgoingElement) === analysis.outgoingContentLength &&
    readContentElementLength(analysis.incomingElement) === analysis.incomingContentLength
  );
}

export function takePrecachedSlideAnalysis(
  requestedTransition: string,
  outgoingElement: HTMLElement,
  incomingElement: HTMLElement,
  transitionPosition: SlideTransitionPosition,
): SlideTransitionAnalysis | undefined {
  const cacheKey = describeAnalysisCacheKey(requestedTransition, transitionPosition);
  const cachedAnalysis = precachedAnalyses.get(cacheKey);
  if (cachedAnalysis === undefined) return undefined;
  const keepsSameElements = cachedAnalysis.outgoingElement === outgoingElement && cachedAnalysis.incomingElement === incomingElement;
  if (!keepsSameElements || !hasUnchangedContent(cachedAnalysis)) {
    precachedAnalyses.delete(cacheKey);
    return undefined;
  }
  precachedAnalyses.delete(cacheKey);
  precachedAnalyses.set(cacheKey, cachedAnalysis);
  return cachedAnalysis;
}

export function storePrecachedSlideAnalysis(requestedTransition: string, analysis: SlideTransitionAnalysis, transitionPosition: SlideTransitionPosition): void {
  if (precachedAnalyses.size >= precachedAnalysisLimit) {
    const oldestCacheKey = precachedAnalyses.keys().next().value;
    if (oldestCacheKey !== undefined) precachedAnalyses.delete(oldestCacheKey);
  }
  precachedAnalyses.set(describeAnalysisCacheKey(requestedTransition, transitionPosition), analysis);
}

function readMountedSlideElements(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(liveSlideSelector)];
}

// The pair the next press is most likely to cross, with the steps it is most likely to cross at:
// forward leaves the current slide fully revealed, backward leaves it at its first step.
function precacheNeighbourTransition(
  currentSlideIndex: number,
  neighbourSlideIndex: number,
  moveDirection: 1 | -1,
  countSlideSteps: (slideIndex: number) => number,
): void {
  const slideElements = readMountedSlideElements();
  const outgoingElement = slideElements[currentSlideIndex];
  const incomingElement = slideElements[neighbourSlideIndex];
  if (outgoingElement === undefined || incomingElement === undefined) return;
  if (outgoingElement.querySelector("[data-content]") === null || incomingElement.querySelector("[data-content]") === null) return;
  const requestedTransition = (moveDirection === 1 ? incomingElement : outgoingElement).dataset.transition ?? "auto";
  if (requestedTransition !== "auto" && requestedTransition !== "morph") return;
  const transitionPosition: SlideTransitionPosition = {
    outgoingSlideIndex: currentSlideIndex,
    outgoingStepIndex: moveDirection === 1 ? countSlideSteps(currentSlideIndex) : 0,
    incomingSlideIndex: neighbourSlideIndex,
    incomingStepIndex: moveDirection === 1 ? 0 : countSlideSteps(neighbourSlideIndex),
  };
  const analysis = analyseSlideTransition(
    outgoingElement,
    incomingElement,
    requestedTransition,
    createReachedStepPredicate(transitionPosition.outgoingStepIndex),
    createReachedStepPredicate(transitionPosition.incomingStepIndex),
  );
  storePrecachedSlideAnalysis(requestedTransition, analysis, transitionPosition);
}

// After every move the analysis of the two neighbour transitions waits for an idle moment:
// a press then finds it ready and the matching work between the slides never lands on the key press path.
export function scheduleAdjacentTransitionPrecaching(
  currentSlideIndex: number,
  countSlideSteps: (slideIndex: number) => number,
  slideNumbering: SlideNumbering,
): () => void {
  const cancelCallbacks: Array<() => void> = [];
  for (const moveDirection of [1, -1] as const) {
    const neighbourSlideIndex = findNeighbourSlide(slideNumbering, currentSlideIndex, moveDirection);
    if (neighbourSlideIndex === undefined) continue;
    cancelCallbacks.push(
      runInIdleBackgroundTurn(() => precacheNeighbourTransition(currentSlideIndex, neighbourSlideIndex, moveDirection, countSlideSteps)),
    );
  }
  return () => {
    for (const cancelCallback of cancelCallbacks) cancelCallback();
  };
}
