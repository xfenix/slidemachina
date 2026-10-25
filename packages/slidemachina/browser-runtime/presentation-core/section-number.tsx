import { useId, type CSSProperties } from "react";

const fadeEndShare = 0.88;
const printedFadeBandCount = 40;

// An SVG gradient, unlike background-clip: text, prints into a PDF that macOS Preview draws correctly.
// Chrome's own PDF viewer cannot fill text with any gradient, so print stacks solid copies, each cut to a shorter band.
export function SectionNumber({ sectionNumber }: { sectionNumber: string }) {
  const gradientIdentifier = useId();
  return (
    <svg data-section-number-figure aria-hidden>
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

// The CSS turns the shares into the opacity at which this copy and the ones below it add up to the gradient over its band.
function describeBandOpacity(bandIndex: number) {
  const describeFadedShare = (fadedBandIndex: number) => Math.max(0, 1 - (fadedBandIndex + 0.5) / printedFadeBandCount);
  return { "--band-share": describeFadedShare(bandIndex), "--lower-band-share": describeFadedShare(bandIndex + 1) } as CSSProperties;
}
