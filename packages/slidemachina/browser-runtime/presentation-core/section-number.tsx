import { useId } from "react";

// An SVG gradient, unlike background-clip: text, prints into a PDF that macOS Preview draws correctly.
export function SectionNumber({ sectionNumber }: { sectionNumber: string }) {
  const gradientIdentifier = useId();
  return (
    <svg data-section-number-figure aria-hidden>
      <linearGradient id={gradientIdentifier} x2="0" y2="1">
        <stop offset="0" />
        <stop offset="0.88" />
      </linearGradient>
      <text fill={`url(#${gradientIdentifier})`}>{sectionNumber}</text>
    </svg>
  );
}
