import type { ReactNode } from "react";
import { pickSourceMarks } from "../presentation-core/source-marks.ts";

export type SourceProperties = {
  children?: ReactNode;
};

// Sits at the bottom of the content area, wherever it is written on the slide.
export function Source({ children, ...otherProperties }: SourceProperties) {
  return (
    <p data-source {...pickSourceMarks(otherProperties)}>
      {children}
    </p>
  );
}
