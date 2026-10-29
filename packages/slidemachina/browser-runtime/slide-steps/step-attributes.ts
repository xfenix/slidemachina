export type StepEffect = "fade" | "rise" | "scale" | "glitch" | "highlight" | "dim";
export type StepAttributes = {
  "data-step": number | true;
  "data-step-effect": StepEffect;
};

export function createStepAttributes(stepNumber: number | true, stepEffect: StepEffect = "rise"): StepAttributes {
  return {
    "data-step": stepNumber,
    "data-step-effect": stepEffect,
  };
}

export function createPartStepAttributes(
  partStep: boolean | number | undefined,
  stepEffect: StepEffect | undefined,
  defaultEffect: StepEffect,
): StepAttributes | Record<string, never> {
  if (partStep === undefined || partStep === false) return {};
  return createStepAttributes(partStep, stepEffect ?? defaultEffect);
}
