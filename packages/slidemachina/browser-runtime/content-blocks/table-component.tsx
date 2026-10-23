import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { createSequenceStepAttributes, type StepAttributes, type StepEffect } from "../slide-steps/step-attributes.ts";

export type TableProperties = {
  children?: ReactNode;
  step?: boolean | number;
  effect?: StepEffect;
};

type RowElement = ReactElement<{ children?: ReactNode } & Partial<StepAttributes>>;

function isHeadRow(tableRow: RowElement | undefined): boolean {
  if (tableRow === undefined) return false;
  const rowCells = Children.toArray(tableRow.props.children);
  return rowCells.length > 0 && rowCells.every((headRowCell) => isValidElement(headRowCell) && headRowCell.type === "th");
}

// Rows are written as <tr>; a first row of <th> becomes the head, and with step the other rows appear one by one.
export function Table({ children, step = false, effect }: TableProperties) {
  const tableRows = Children.toArray(children).filter(isValidElement) as RowElement[];
  const tableHeadRow = isHeadRow(tableRows[0]) ? tableRows[0] : undefined;
  const bodyRows = tableHeadRow === undefined ? tableRows : tableRows.slice(1);
  return (
    <table data-table>
      {tableHeadRow !== undefined && <thead>{tableHeadRow}</thead>}
      <tbody>
        {bodyRows.map((tableBodyRow, rowPosition) => cloneElement(tableBodyRow, createSequenceStepAttributes(step, rowPosition, effect)))}
      </tbody>
    </table>
  );
}
