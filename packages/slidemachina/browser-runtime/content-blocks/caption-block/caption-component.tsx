import type { ReactNode } from "react";
import { pickSourceMarks } from "../../presentation-core/source-marks.ts";

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
