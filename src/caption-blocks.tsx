import type { ReactNode } from "react";
import { pickSourceMarks } from "./source-marks.ts";

export type CaptionProperties = {
  children?: ReactNode;
};

export function Caption({ children, ...otherProperties }: CaptionProperties) {
  return (
    <p data-caption {...pickSourceMarks(otherProperties)}>
      {children}
    </p>
  );
}

// Sits at the bottom of the content area, wherever it is written on the slide.
export function Source({ children, ...otherProperties }: CaptionProperties) {
  return (
    <p data-source {...pickSourceMarks(otherProperties)}>
      {children}
    </p>
  );
}
