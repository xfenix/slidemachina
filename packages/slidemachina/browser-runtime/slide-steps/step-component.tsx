import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { createStepAttributes, type StepEffect } from "./step-attributes.ts";

export type StepProperties = {
  children?: ReactNode;
  at?: number;
  effect?: StepEffect;
};

export function Step({ children, at, effect }: StepProperties) {
  const stepAttributes = createStepAttributes(at ?? true, effect);
  // HTML tags take the attributes directly; components might drop unknown props, so they get a wrapper.
  if (isValidElement(children) && typeof children.type === "string") {
    return cloneElement(children as ReactElement<object>, stepAttributes);
  }
  return <span {...stepAttributes}>{children}</span>;
}
