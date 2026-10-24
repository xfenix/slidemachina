// A number says how many times faster than "normal": 2 is twice as fast, 0.5 twice as slow.
export type TransitionSpeed = "fast" | "normal" | "slow" | number;

const speedFactors = { fast: 1.5, normal: 1, slow: 0.7 };

export function resolveSpeedFactor(transitionSpeed: TransitionSpeed): number {
  const speedFactor = typeof transitionSpeed === "number" ? transitionSpeed : speedFactors[transitionSpeed];
  return Number.isFinite(speedFactor) && speedFactor > 0 ? speedFactor : 1;
}
