import { useLayoutEffect, useRef, type RefObject } from "react";
import { stepChangeEventName } from "../slide-steps/step-visibility.ts";

type LineScroll = ScrollBehavior | "keep";

// "1 | 3-4 | 6": line 1 first, then lines 3 and 4 on the next step, then line 6. An empty part lights every line.
export function parseLineSteps(linesSpecification: string | undefined, codeLineCount: number): Array<Set<number>> {
  if (linesSpecification === undefined) return [new Set()];
  return linesSpecification.split("|").map((stepPart) => {
    const lineNumbers = new Set<number>();
    for (const rangeText of stepPart.split(/[\s,]+/).filter(Boolean)) {
      const [firstLineText, lastLineText = firstLineText] = rangeText.split("-");
      const lastLineNumber = Math.min(Number(lastLineText), codeLineCount);
      for (let lineNumber = Number(firstLineText); lineNumber <= lastLineNumber; lineNumber += 1) lineNumbers.add(lineNumber);
    }
    return lineNumbers;
  });
}

// The lit lines sit in the middle of the visible part; a range taller than the view starts at its first line.
function scrollToLitLines(viewportElement: HTMLElement, litLineElements: HTMLElement[], scrollBehavior: ScrollBehavior) {
  const largestScrollTop = viewportElement.scrollHeight - viewportElement.clientHeight;
  const firstLitLine = litLineElements[0];
  const lastLitLine = litLineElements.at(-1);
  let targetScrollTop = 0;
  if (firstLitLine !== undefined && lastLitLine !== undefined) {
    const litRangeCentre = (firstLitLine.offsetTop + lastLitLine.offsetTop + lastLitLine.offsetHeight) / 2;
    targetScrollTop = Math.min(litRangeCentre - viewportElement.clientHeight / 2, firstLitLine.offsetTop);
  }
  targetScrollTop = Math.round(Math.min(Math.max(targetScrollTop, 0), Math.max(largestScrollTop, 0)));
  viewportElement.toggleAttribute("data-clipped-top", targetScrollTop > 0);
  viewportElement.toggleAttribute("data-clipped-bottom", targetScrollTop < largestScrollTop - 1);
  viewportElement.scrollTo({ top: targetScrollTop, behavior: scrollBehavior });
}

function lightLines(codeElement: HTMLElement, litLineNumbers: Set<number>, lineScroll: LineScroll) {
  const lineElements = [...codeElement.querySelectorAll<HTMLElement>("[data-code-line]")];
  const litLineElements = lineElements.filter(
    (lineElement, lineIndex) => litLineNumbers.has(lineIndex + 1) || lineElement.hasAttribute("data-marked"),
  );
  for (const lineElement of lineElements) lineElement.toggleAttribute("data-lit", litLineElements.includes(lineElement));
  codeElement.toggleAttribute("data-has-lit-lines", litLineElements.length > 0);
  const viewportElement = codeElement.querySelector<HTMLElement>("[data-code-viewport]");
  if (viewportElement !== null && lineScroll !== "keep") scrollToLitLines(viewportElement, litLineElements, lineScroll);
}

// Lines are lit in the DOM, so a transition snapshot shows the right lines and scroll position.
export function useCodeLineSteps(codeElementReference: RefObject<HTMLElement | null>, lineSteps: Array<Set<number>>) {
  const shownStepReference = useRef({ stepIndex: -1, wasOnCurrentSlide: false });

  // Runs after every render: hot reload brings new line elements without the lit marks.
  useLayoutEffect(() => {
    const codeElement = codeElementReference.current;
    const slideElement = codeElement?.closest<HTMLElement>("[data-slide]");
    if (codeElement === null || slideElement === null || slideElement === undefined) return;
    const showReachedStep = () => {
      const reachedStepIndex = codeElement.querySelectorAll("[data-code-step][data-step-reached]").length;
      const isOnCurrentSlide = slideElement.hasAttribute("data-current");
      const shownStep = shownStepReference.current;
      const stepChanged = reachedStepIndex !== shownStep.stepIndex;
      // A step on the open slide scrolls smoothly; a slide that is just arriving jumps, so its snapshot is already in place.
      let lineScroll: LineScroll = "instant";
      if (!stepChanged && isOnCurrentSlide === shownStep.wasOnCurrentSlide) lineScroll = "keep";
      else if (stepChanged && isOnCurrentSlide && shownStep.wasOnCurrentSlide) lineScroll = "smooth";
      shownStepReference.current = { stepIndex: reachedStepIndex, wasOnCurrentSlide: isOnCurrentSlide };
      lightLines(codeElement, lineSteps[reachedStepIndex] ?? new Set(), lineScroll);
    };
    showReachedStep();
    slideElement.addEventListener(stepChangeEventName, showReachedStep);
    return () => slideElement.removeEventListener(stepChangeEventName, showReachedStep);
  });
}
