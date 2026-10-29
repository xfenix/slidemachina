import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { readPositionFromHash, writePositionToHash, type PresentationPosition } from "./position-hash.ts";
import { findNeighbourSlide, type SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";
import { runSlideTransition } from "../slide-transitions/slide-transition.ts";

export function useSlideNavigation(slideNumbering: SlideNumbering, stepCountsReference: RefObject<number[]>) {
  const { slideAddresses } = slideNumbering;
  const [requestedPosition, setRequestedPosition] = useState(() => readPositionFromHash(slideNumbering));
  const lastSlideIndex = Math.max(slideAddresses.length - 1, 0);
  const currentPosition = fitPosition(requestedPosition, lastSlideIndex);
  // Fast repeated presses arrive before React re-renders, so moves start from this reference, not from state.
  const latestPositionReference = useRef(currentPosition);

  const countSteps = (slideIndex: number) => stepCountsReference.current[slideIndex] ?? 0;

  // Shows a position at once, without a slide transition: the navigator plays its own, the presenter window has none.
  const showPosition = (nextPosition: PresentationPosition) => {
    latestPositionReference.current = nextPosition;
    setRequestedPosition(nextPosition);
  };

  const applyPosition = (nextPosition: PresentationPosition) => {
    const previousPosition = fitPosition(latestPositionReference.current, lastSlideIndex);
    latestPositionReference.current = nextPosition;
    if (nextPosition.slideIndex === previousPosition.slideIndex) {
      setRequestedPosition(nextPosition);
      return;
    }
    // A skipped transition still runs its update: it shows its own slide, so the newer one snapshots that slide, not the next.
    const showArrivedPosition = () => {
      const latestPosition = latestPositionReference.current;
      setRequestedPosition(latestPosition.slideIndex === nextPosition.slideIndex ? latestPosition : nextPosition);
    };
    runSlideTransition(
      () => flushSync(showArrivedPosition),
      previousPosition.slideIndex,
      nextPosition.slideIndex,
      nextPosition.stepIndex,
    );
  };

  const movePosition = (chooseNextPosition: (previousPosition: PresentationPosition) => PresentationPosition) => {
    const { slideIndex, stepIndex } = fitPosition(latestPositionReference.current, lastSlideIndex);
    applyPosition(chooseNextPosition({ slideIndex, stepIndex: Math.min(stepIndex, countSteps(slideIndex)) }));
  };

  const { slideIndex: currentSlideIndex, stepIndex: currentStepIndex } = currentPosition;
  useEffect(() => {
    writePositionToHash({ slideIndex: currentSlideIndex, stepIndex: currentStepIndex }, slideAddresses);
  }, [currentSlideIndex, currentStepIndex, slideAddresses]);

  useEffect(() => {
    const followHashChange = () => applyPosition(fitPosition(readPositionFromHash(slideNumbering), lastSlideIndex));
    window.addEventListener("hashchange", followHashChange);
    return () => window.removeEventListener("hashchange", followHashChange);
  });

  return {
    currentPosition,
    goForward: () =>
      movePosition(({ slideIndex, stepIndex }) => {
        if (stepIndex < countSteps(slideIndex)) return { slideIndex, stepIndex: stepIndex + 1 };
        const nextSlideIndex = findNeighbourSlide(slideNumbering, slideIndex, 1);
        return nextSlideIndex === undefined ? { slideIndex, stepIndex } : { slideIndex: nextSlideIndex, stepIndex: 0 };
      }),
    goBackward: () =>
      movePosition(({ slideIndex, stepIndex }) => {
        if (stepIndex > 0) return { slideIndex, stepIndex: stepIndex - 1 };
        const previousSlideIndex = findNeighbourSlide(slideNumbering, slideIndex, -1);
        return previousSlideIndex === undefined ? { slideIndex, stepIndex } : { slideIndex: previousSlideIndex, stepIndex: countSteps(previousSlideIndex) };
      }),
    goToSlide: (slideIndex: number) =>
      applyPosition({ slideIndex: Math.min(Math.max(slideIndex, 0), lastSlideIndex), stepIndex: 0 }),
    jumpToSlide: (slideIndex: number) => showPosition({ slideIndex: Math.min(Math.max(slideIndex, 0), lastSlideIndex), stepIndex: 0 }),
    showPosition,
  };
}

function fitPosition(presentationPosition: PresentationPosition, lastSlideIndex: number): PresentationPosition {
  if (presentationPosition.slideIndex <= lastSlideIndex) return presentationPosition;
  return { slideIndex: lastSlideIndex, stepIndex: 0 };
}
