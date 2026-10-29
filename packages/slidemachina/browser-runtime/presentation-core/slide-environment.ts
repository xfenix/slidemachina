import { createContext, useContext, useMemo, type ComponentType, type RefObject } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import type { SlideTransition } from "../slide-transitions/slide-transition.ts";
import type { TransitionSpeed } from "../slide-transitions/transition-speed.ts";
import type { SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";
import type { StepEffect } from "../slide-steps/step-attributes.ts";

export const SlideEnvironmentContext = createContext<SlideEnvironment | null>(null);

export type SlideAlign = "left" | "center" | "right";

// Keys name the slide tone: "dark" is the logo for dark slides. Without it the light logo is recoloured by a filter.
// A component draws both versions itself and gets dark={true} on dark slides.
export type PresentationLogo = string | { light: string; dark?: string } | ComponentType<{ dark: boolean }>;
export type PresentationSettings = {
  align: SlideAlign;
  logo?: PresentationLogo;
  lang: string;
  transition: SlideTransition;
  speed: TransitionSpeed;
  stepEffect?: StepEffect;
};
// What a custom component on a slide may read: useSlide() inside any element of a <Slide>.
export type SlideState = { number: number; step: number; isCurrent: boolean; isCopy: boolean };
type SlideRenderState = { slideIndex: number; isCurrentSlide: boolean; isSlideNearby: boolean; isSlideCopy: boolean; revealedStep: number };
type SlideEnvironment = {
  slideNumber: number;
  slideAddress: string;
  sectionTrail: string[];
  isCurrentSlide: boolean;
  // Two slides or closer to the current one: videos start loading.
  isSlideNearby: boolean;
  isSlideCopy: boolean;
  revealedStep: number;
  reportStepCount: (stepCount: number) => void;
  presentationSettings: PresentationSettings;
};

export function useSlideEnvironment(): SlideEnvironment {
  const slideEnvironment = useContext(SlideEnvironmentContext);
  if (slideEnvironment === null) {
    throw new Error(pickInterfaceTexts(navigator.language).slideOutsidePresentation);
  }
  return slideEnvironment;
}

// A thumbnail or printed page is a copy: it is never current, and its step is the one it shows.
export function useSlide(): SlideState {
  const { slideNumber, revealedStep, isCurrentSlide, isSlideCopy } = useSlideEnvironment();
  return { number: slideNumber, step: revealedStep, isCurrent: isCurrentSlide, isCopy: isSlideCopy };
}

// A slide whose state did not change gets the same environment object, so a key press re-renders only the slides it changes.
export function useSlideEnvironments(
  slideNumbering: SlideNumbering,
  sectionTrails: string[][],
  presentationSettings: PresentationSettings,
  stepCountsReference: RefObject<number[]>,
) {
  // The cache grows during render on purpose; React Compiler cannot keep these objects stable across positions.
  "use no memo";
  return useMemo(() => {
    const environmentCache = new Map<string, SlideEnvironment>();
    return ({ slideIndex, isCurrentSlide, isSlideNearby, isSlideCopy, revealedStep }: SlideRenderState): SlideEnvironment => {
      const cacheKey = `${slideIndex} ${isCurrentSlide} ${isSlideNearby} ${isSlideCopy} ${revealedStep}`;
      const cachedEnvironment = environmentCache.get(cacheKey);
      if (cachedEnvironment !== undefined) return cachedEnvironment;
      const slideEnvironment: SlideEnvironment = {
        slideNumber: slideNumbering.shownNumbers[slideIndex] ?? slideIndex + 1,
        slideAddress: slideNumbering.slideAddresses[slideIndex] ?? String(slideIndex + 1),
        sectionTrail: sectionTrails[slideIndex] ?? [],
        isCurrentSlide,
        isSlideNearby,
        isSlideCopy,
        revealedStep,
        reportStepCount: (stepCount) => {
          stepCountsReference.current[slideIndex] = stepCount;
        },
        presentationSettings,
      };
      // oxlint-disable-next-line react/immutability -- the hook opts out of React Compiler above
      environmentCache.set(cacheKey, slideEnvironment);
      return slideEnvironment;
    };
  }, [slideNumbering, sectionTrails, presentationSettings, stepCountsReference]);
}
