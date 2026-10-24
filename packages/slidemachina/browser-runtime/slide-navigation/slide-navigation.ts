import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { readPositionFromHash, writePositionToHash, type PresentationPosition } from "./position-hash.ts";
import { runSlideTransition } from "../slide-transitions/slide-transition.ts";

export function useSlideNavigation(slideCount: number, stepCountsReference: RefObject<number[]>) {
  const [requestedPosition, setRequestedPosition] = useState(readPositionFromHash);
  const lastSlideIndex = Math.max(slideCount - 1, 0);
  const currentPosition = fitPosition(requestedPosition, lastSlideIndex);
  // Fast repeated presses arrive before React re-renders, so moves start from this reference, not from state.
  const latestPositionReference = useRef(currentPosition);

  const countSteps = (slideIndex: number) => stepCountsReference.current[slideIndex] ?? 0;

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
    writePositionToHash({ slideIndex: currentSlideIndex, stepIndex: currentStepIndex });
  }, [currentSlideIndex, currentStepIndex]);

  useEffect(() => {
    const followHashChange = () => applyPosition(fitPosition(readPositionFromHash(), lastSlideIndex));
    window.addEventListener("hashchange", followHashChange);
    return () => window.removeEventListener("hashchange", followHashChange);
  });

  return {
    currentPosition,
    goForward: () =>
      movePosition(({ slideIndex, stepIndex }) => {
        if (stepIndex < countSteps(slideIndex)) return { slideIndex, stepIndex: stepIndex + 1 };
        if (slideIndex < lastSlideIndex) return { slideIndex: slideIndex + 1, stepIndex: 0 };
        return { slideIndex, stepIndex };
      }),
    goBackward: () =>
      movePosition(({ slideIndex, stepIndex }) => {
        if (stepIndex > 0) return { slideIndex, stepIndex: stepIndex - 1 };
        if (slideIndex > 0) return { slideIndex: slideIndex - 1, stepIndex: countSteps(slideIndex - 1) };
        return { slideIndex, stepIndex };
      }),
    goToSlide: (slideIndex: number) =>
      applyPosition({ slideIndex: Math.min(Math.max(slideIndex, 0), lastSlideIndex), stepIndex: 0 }),
  };
}

function fitPosition(presentationPosition: PresentationPosition, lastSlideIndex: number): PresentationPosition {
  if (presentationPosition.slideIndex <= lastSlideIndex) return presentationPosition;
  return { slideIndex: lastSlideIndex, stepIndex: 0 };
}
