import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { createSequenceStepAttributes, type StepEffect } from "./step-attributes.ts";

export type ListProperties = {
  children?: ReactNode;
  step?: boolean | number;
  effect?: StepEffect;
  ordered?: boolean;
};

export function List({ children, step = false, effect, ordered = false }: ListProperties) {
  const ListElementTag = ordered ? "ol" : "ul";
  const listItems = Children.toArray(children).map((listChild, itemPosition) => {
    const stepAttributes = createSequenceStepAttributes(step, itemPosition, effect);
    if (isValidElement(listChild) && listChild.type === "li") {
      return cloneElement(listChild as ReactElement<object>, stepAttributes);
    }
    return (
      <li key={itemPosition} {...stepAttributes}>
        {listChild}
      </li>
    );
  });
  return <ListElementTag data-list>{listItems}</ListElementTag>;
}
