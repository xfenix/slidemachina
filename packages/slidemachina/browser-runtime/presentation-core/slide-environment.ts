import { createContext, useContext, useMemo, type RefObject } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import type { SlideTransition } from "../slide-transitions/slide-transition.ts";

export type SlideAlign = "left" | "center";

// Keys name the slide tone: "dark" is the logo for dark slides. Without it the light logo is recoloured by a filter.
export type PresentationLogo = string | { light: string; dark?: string };

export type PresentationSettings = {
  align: SlideAlign;
  logo?: PresentationLogo;
  lang: string;
  transition: SlideTransition;
};

type SlideEnvironment = {
  slideNumber: number;
  sectionTrail: string[];
  isCurrentSlide: boolean;
  // Two slides or closer to the current one: videos start loading.
  isSlideNearby: boolean;
  isSlideCopy: boolean;
  revealedStep: number;
  reportStepCount: (stepCount: number) => void;
  presentationSettings: PresentationSettings;
};

export const SlideEnvironmentContext = createContext<SlideEnvironment | null>(null);

export function useSlideEnvironment(): SlideEnvironment {
  const slideEnvironment = useContext(SlideEnvironmentContext);
  if (slideEnvironment === null) {
    throw new Error(pickInterfaceTexts(navigator.language).slideOutsidePresentation);
  }
  return slideEnvironment;
}

type SlideState = { slideIndex: number; isCurrentSlide: boolean; isSlideNearby: boolean; isSlideCopy: boolean; revealedStep: number };

// A slide whose state did not change gets the same environment object, so a key press re-renders only the slides it changes.
export function useSlideEnvironments(
  sectionTrails: string[][],
  presentationSettings: PresentationSettings,
  stepCountsReference: RefObject<number[]>,
) {
  const environmentCache = useMemo(() => new Map<string, SlideEnvironment>(), [sectionTrails, presentationSettings, stepCountsReference]);
  return ({ slideIndex, isCurrentSlide, isSlideNearby, isSlideCopy, revealedStep }: SlideState): SlideEnvironment => {
    const cacheKey = `${slideIndex} ${isCurrentSlide} ${isSlideNearby} ${isSlideCopy} ${revealedStep}`;
    const cachedEnvironment = environmentCache.get(cacheKey);
    if (cachedEnvironment !== undefined) return cachedEnvironment;
    const slideEnvironment: SlideEnvironment = {
      slideNumber: slideIndex + 1,
      sectionTrail: sectionTrails[slideIndex],
      isCurrentSlide,
      isSlideNearby,
      isSlideCopy,
      revealedStep,
      reportStepCount: (stepCount) => {
        stepCountsReference.current[slideIndex] = stepCount;
      },
      presentationSettings,
    };
    environmentCache.set(cacheKey, slideEnvironment);
    return slideEnvironment;
  };
}
