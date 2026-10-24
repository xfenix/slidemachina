export type StepEffect = "fade" | "rise" | "scale" | "highlight" | "dim";
export type StepAttributes = {
  "data-step": string;
  "data-step-effect": StepEffect;
};

export function createStepAttributes(stepNumber: number | true, stepEffect: StepEffect = "rise"): StepAttributes {
  return {
    "data-step": stepNumber === true ? "" : String(stepNumber),
    "data-step-effect": stepEffect,
  };
}

// <List step>, <Columns step>, <Table step>: every child is a step; step={3} puts them on steps 3, 4, 5.
export function createSequenceStepAttributes(
  sequenceStep: boolean | number,
  childPosition: number,
  stepEffect?: StepEffect,
): StepAttributes | Record<string, never> {
  if (sequenceStep === false) return {};
  return createStepAttributes(sequenceStep === true ? true : sequenceStep + childPosition, stepEffect);
}

export function createPartStepAttributes(
  partStep: boolean | number | undefined,
  stepEffect: StepEffect | undefined,
  defaultEffect: StepEffect,
): StepAttributes | Record<string, never> {
  if (partStep === undefined || partStep === false) return {};
  return createStepAttributes(partStep, stepEffect ?? defaultEffect);
}
