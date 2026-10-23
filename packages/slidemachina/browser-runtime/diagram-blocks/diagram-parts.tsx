import type { ReactNode } from "react";
import { createPartStepAttributes, type StepEffect } from "../slide-steps/step-attributes.ts";

type StepProperties = {
  step?: boolean | number;
  effect?: StepEffect;
};

export type BoxProperties = StepProperties & {
  id: string;
  children?: ReactNode;
  column?: number;
  first?: boolean;
  last?: boolean;
};

export type GroupProperties = StepProperties & {
  id?: string;
  title?: string;
  children?: ReactNode;
};

export type ArrowProperties = StepProperties & {
  from: string;
  to: string;
  id?: string;
  label?: string;
};

export type FocusProperties = {
  on?: string[];
  step?: boolean | number;
};

// Parts only describe the diagram: <Diagram> and <Sequence> read their props and draw everything together.
export const Box: (boxProperties: BoxProperties) => null = () => null;

export const Group: (groupProperties: GroupProperties) => null = () => null;

export const Arrow: (arrowProperties: ArrowProperties) => null = () => null;

export const Focus: (focusProperties: FocusProperties) => null = () => null;

// A focus marker is an empty hidden step; the diagram reads which markers are reached and lights their parts.
export function FocusMarker({ focusProperties }: { focusProperties: FocusProperties }) {
  return (
    <span
      data-focus-marker={(focusProperties.on ?? []).join(" ")}
      hidden
      {...createPartStepAttributes(focusProperties.step, "fade", "fade")}
    />
  );
}
