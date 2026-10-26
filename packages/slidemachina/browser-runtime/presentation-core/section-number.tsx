import { useId, useLayoutEffect, useRef, type CSSProperties, type RefObject } from "react";

const fadeEndShare = 0.88;
const printedFadeBandCount = 40;
// The title stands on the number: the digits reach past both ends of it.
const leastNumberToTitleWidth = 1.2;

// An SVG gradient, unlike background-clip: text, prints into a PDF that macOS Preview draws correctly.
// Chrome's own PDF viewer cannot fill text with any gradient, so print stacks solid copies, each cut to a shorter band.
export function SectionNumber({ sectionNumber }: { sectionNumber: string }) {
  const gradientIdentifier = useId();
  const figureReference = useRef<SVGSVGElement>(null);
  useNumberWiderThanTitle(figureReference);
  return (
    <svg ref={figureReference} data-section-number-figure aria-hidden>
      <linearGradient id={gradientIdentifier} x2="0" y2="1">
        <stop offset="0" />
        <stop offset={fadeEndShare} />
      </linearGradient>
      <text data-section-number-gradient fill={`url(#${gradientIdentifier})`}>{sectionNumber}</text>
      {Array.from({ length: printedFadeBandCount }, (_, bandIndex) => (
        <g key={bandIndex} data-printed-fade-band style={describeBandOpacity(bandIndex)}>
          <clipPath id={`${gradientIdentifier}-${bandIndex}`} clipPathUnits="objectBoundingBox">
            <rect width="1" height={(fadeEndShare * (bandIndex + 1)) / printedFadeBandCount} />
          </clipPath>
          <text clipPath={`url(#${gradientIdentifier}-${bandIndex})`}>{sectionNumber}</text>
        </g>
      ))}
    </svg>
  );
}

// The title wraps to the width of the number; a word longer than that gets a larger number, so the title never sticks out of the digits.
function fitNumberToTitle(figureElement: SVGSVGElement, titleElement: HTMLElement) {
  figureElement.style.removeProperty("font-size");
  titleElement.style.removeProperty("max-width");
  // On screen the gradient copy is shown, in print the bands are.
  const numberWidth = Math.max(0, ...[...figureElement.querySelectorAll("text")].map((numberText) => numberText.getBoundingClientRect().width));
  const canvasScale = titleElement.getBoundingClientRect().width / titleElement.offsetWidth;
  if (numberWidth <= 0 || !(canvasScale > 0)) return;
  titleElement.style.maxWidth = `${numberWidth / leastNumberToTitleWidth / canvasScale}px`;
  const titleRange = document.createRange();
  titleRange.selectNodeContents(titleElement);
  const titleWidth = titleRange.getBoundingClientRect().width;
  const numberGrowth = (titleWidth * leastNumberToTitleWidth) / numberWidth;
  if (numberGrowth <= 1) return;
  figureElement.style.fontSize = `calc(var(--section-number-size) * ${numberGrowth})`;
  // The longest word sticks out of the narrow title; the title takes its width, so the lines stay centred.
  titleElement.style.maxWidth = `${Math.ceil(titleWidth / canvasScale)}px`;
}

function useNumberWiderThanTitle(figureReference: RefObject<SVGSVGElement | null>) {
  useLayoutEffect(() => {
    const figureElement = figureReference.current;
    const titleElement = figureElement?.previousElementSibling;
    if (figureElement === null || !(titleElement instanceof HTMLElement)) return;
    fitNumberToTitle(figureElement, titleElement);
    let isMounted = true;
    void document.fonts.ready.then(() => {
      if (isMounted) fitNumberToTitle(figureElement, titleElement);
    });
    return () => {
      isMounted = false;
    };
  });
}

// The CSS turns the shares into the opacity at which this copy and the ones below it add up to the gradient over its band.
function describeBandOpacity(bandIndex: number) {
  const describeFadedShare = (fadedBandIndex: number) => Math.max(0, 1 - (fadedBandIndex + 0.5) / printedFadeBandCount);
  return { "--band-share": describeFadedShare(bandIndex), "--lower-band-share": describeFadedShare(bandIndex + 1) } as CSSProperties;
}
