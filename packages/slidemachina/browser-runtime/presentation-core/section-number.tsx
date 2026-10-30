import { useId, useLayoutEffect, useRef, type CSSProperties, type RefObject } from "react";
import { useSlideEnvironment } from "./slide-environment.ts";

const printedColorBandCount = 40;
// A band takes the colour of the gradient at its middle.
const bandMiddleShare = 0.5;
// The title stands on the number: the digits reach past both ends of it.
const leastNumberToTitleWidth = 1.2;

// Left to right from the accent to the green, like the logo. An SVG gradient, unlike background-clip: text, prints into a PDF that macOS Preview draws correctly.
// Chrome's own PDF viewer cannot fill text with any gradient, so print stacks solid copies, each cut to start a band further right.
// The title is the text of the h1 next to the number: the fit is measured again only when it or the number changes.
export function SectionNumber({ sectionNumber, sectionTitle }: { sectionNumber: string; sectionTitle?: string }) {
  const gradientIdentifier = useId();
  const figureReference = useRef<SVGSVGElement>(null);
  useTitleNarrowerThanNumber(figureReference, useSlideEnvironment().isSlideDistant, `${sectionNumber} ${sectionTitle}`);
  return (
    <svg ref={figureReference} data-section-number-figure aria-hidden>
      <linearGradient id={gradientIdentifier}>
        <stop offset="0" />
        <stop offset="1" />
      </linearGradient>
      <text data-section-number-gradient fill={`url(#${gradientIdentifier})`}>{sectionNumber}</text>
      {Array.from({ length: printedColorBandCount }, (_, bandIndex) => (
        <g key={bandIndex} data-printed-color-band style={{ "--band-share": (bandIndex + bandMiddleShare) / printedColorBandCount } as CSSProperties}>
          <clipPath id={`${gradientIdentifier}-${bandIndex}`} clipPathUnits="objectBoundingBox">
            <rect x={bandIndex / printedColorBandCount} width="1" height="1" />
          </clipPath>
          <text clipPath={`url(#${gradientIdentifier}-${bandIndex})`}>{sectionNumber}</text>
        </g>
      ))}
    </svg>
  );
}

// The number keeps one size on every section slide; the title wraps to its width, and a longer word sticks out of the digits instead of growing them.
function fitTitleToNumber(figureElement: SVGSVGElement, titleElement: HTMLElement) {
  titleElement.style.removeProperty("max-width");
  // On screen the gradient copy is shown, in print the bands are.
  const numberWidth = Math.max(0, ...[...figureElement.querySelectorAll("text")].map((numberText) => numberText.getBoundingClientRect().width));
  const canvasScale = titleElement.getBoundingClientRect().width / titleElement.offsetWidth;
  if (numberWidth <= 0 || !(canvasScale > 0)) return;
  titleElement.style.maxWidth = `${numberWidth / leastNumberToTitleWidth / canvasScale}px`;
  const titleRange = document.createRange();
  titleRange.selectNodeContents(titleElement);
  const titleWidth = titleRange.getBoundingClientRect().width;
  // The longest word sticks out of the narrow title; the title takes its width, so the lines stay centred.
  if (titleWidth * leastNumberToTitleWidth > numberWidth) titleElement.style.maxWidth = `${Math.ceil(titleWidth / canvasScale)}px`;
}

function useTitleNarrowerThanNumber(figureReference: RefObject<SVGSVGElement | null>, isSlideDistant: boolean, fittedTexts: string) {
  useLayoutEffect(() => {
    const figureElement = figureReference.current;
    const titleElement = figureElement?.previousElementSibling;
    if (figureElement === null || !(titleElement instanceof HTMLElement) || isSlideDistant) return;
    fitTitleToNumber(figureElement, titleElement);
    let isMounted = true;
    void document.fonts.ready.then(() => {
      if (isMounted) fitTitleToNumber(figureElement, titleElement);
    });
    return () => {
      isMounted = false;
    };
  }, [figureReference, isSlideDistant, fittedTexts]);
}
