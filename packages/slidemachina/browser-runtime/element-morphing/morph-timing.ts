const millisecondsPerSecond = 1000;
const fallbackMorphDurationMilliseconds = 550;

export type MorphTiming = {
  durationMilliseconds: number;
  easing: string;
};

// --morph-time stays a calc() in computed styles, so the factors are read separately and multiplied here.
export function readMorphTiming(): MorphTiming {
  const rootStyle = getComputedStyle(document.documentElement);
  const durationSeconds = Number.parseFloat(rootStyle.getPropertyValue("--morph-duration")) || fallbackMorphDurationMilliseconds / millisecondsPerSecond;
  const speedFactor = Number.parseFloat(rootStyle.getPropertyValue("--transition-speed")) || 1;
  return {
    durationMilliseconds: Math.round((durationSeconds * millisecondsPerSecond) / speedFactor),
    easing: rootStyle.getPropertyValue("--transition-easing").trim() || "ease",
  };
}
