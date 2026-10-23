import { Children, type CSSProperties, type ReactNode } from "react";
import { createSequenceStepAttributes, type StepEffect } from "./step-attributes.ts";

export type ColumnsProperties = {
  children?: ReactNode;
  step?: boolean | number;
  effect?: StepEffect;
  widths?: string;
};

// Every child is a column; widths="2 1" makes the first one twice as wide.
export function Columns({ children, step = false, effect, widths }: ColumnsProperties) {
  const columnElements = Children.toArray(children).map((columnContent, columnPosition) => (
    <div key={columnPosition} data-column {...createSequenceStepAttributes(step, columnPosition, effect)}>
      {columnContent}
    </div>
  ));
  const columnsStyle: CSSProperties | undefined =
    widths === undefined
      ? undefined
      : { gridTemplateColumns: widths.trim().split(/\s+/).map((columnShare) => `minmax(0, ${columnShare}fr)`).join(" ") };
  return (
    <div data-columns style={columnsStyle}>
      {columnElements}
    </div>
  );
}
