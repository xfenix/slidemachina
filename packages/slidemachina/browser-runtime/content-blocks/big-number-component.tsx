import { useRef, type ReactNode } from "react";
import { pickSourceMarks } from "../presentation-core/source-marks.ts";
import { useWidthFitting, type WidthFitting } from "../presentation-core/width-fitting.ts";

// A number wider than its column gets a smaller font, so neighbouring numbers never run into each other.
const numberWidthFitting: WidthFitting = {
  findTextElement: (numberElement) => numberElement,
  measureRoom: (numberElement) => numberElement.parentElement?.clientWidth ?? 0,
  smallestFontSize: 64,
};

export type BigNumberProperties = {
  children?: ReactNode;
  label?: string;
};

export function BigNumber({ children, label, ...otherProperties }: BigNumberProperties) {
  const numberElementReference = useRef<HTMLParagraphElement>(null);
  useWidthFitting(numberElementReference, numberWidthFitting, children);
  return (
    <figure data-big-number>
      <p ref={numberElementReference} {...pickSourceMarks(otherProperties)}>
        {children}
      </p>
      {label !== undefined && <figcaption>{label}</figcaption>}
    </figure>
  );
}
