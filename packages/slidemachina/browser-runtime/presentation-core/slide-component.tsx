import { useEffect, useEffectEvent, useRef, type CSSProperties, type ReactNode } from "react";
import { classifySlideBackground, readBackgroundAddress, useBackgroundTone, type SlideBackgroundValue, type SlideTone } from "./background-tone.ts";
import { useLetterboxBackground } from "./letterbox-background.ts";
import { SlideBackgroundLayer } from "./slide-background.tsx";
import { useSlideEnvironment, type PresentationLogo, type SlideAlign } from "./slide-environment.ts";
import { pickSourceMarks } from "./source-marks.ts";
import { useBigNumberFitting } from "./width-fitting.ts";
import { useFloatFitting } from "./float-fitting.ts";
import { useSourceWidthFitting } from "./source-width-fitting.ts";
import { useBottomBandRoom } from "./bottom-band-room.ts";
import type { SlideTransition } from "../slide-transitions/slide-transition.ts";
import { resolveSpeedFactor, type TransitionSpeed } from "../slide-transitions/transition-speed.ts";
import { useStepVisibility } from "../slide-steps/step-visibility.ts";
import type { StepEffect } from "../slide-steps/step-attributes.ts";
import { listSlideNotes, writeNotesText } from "./slide-notes.tsx";

export type SlideLogoPlacement = "top-right" | "top-left" | "top" | "center" | "bottom";
export type SlideVerticalAlign = "top" | "center" | "bottom";
export type SlideProperties = {
  children?: ReactNode;
  align?: SlideAlign;
  valign?: SlideVerticalAlign;
  cover?: boolean;
  background?: SlideBackgroundValue;
  tone?: SlideTone;
  transition?: SlideTransition;
  speed?: TransitionSpeed;
  // The effect of every step on the slide that names none of its own; data-step-effect on an element or a list wins.
  stepEffect?: StepEffect;
  plain?: boolean;
  logo?: boolean | SlideLogoPlacement;
  breadcrumbs?: boolean | string;
  number?: boolean;
  // Skipped in the show and in the numbers, left out of print and export; the navigator still opens it.
  hidden?: boolean;
  className?: string;
  // Called when the slide comes on screen and when it leaves; thumbnails and printed pages never call them.
  onEnter?: () => void;
  onLeave?: () => void;
};
type SlideLogoProperties = { presentationLogo: PresentationLogo; slideTone: SlideTone; logoPlacement: SlideLogoPlacement };

export function Slide({
  children,
  align,
  valign,
  cover = false,
  background,
  tone,
  transition,
  speed,
  stepEffect,
  plain = false,
  logo = true,
  breadcrumbs = true,
  number = true,
  hidden = false,
  className,
  onEnter,
  onLeave,
  ...otherProperties
}: SlideProperties) {
  const slideEnvironment = useSlideEnvironment();
  const { presentationSettings } = slideEnvironment;
  const slideElementReference = useRef<HTMLElement>(null);
  const detectedTone = useBackgroundTone(slideElementReference, background, className);
  useStepVisibility(slideElementReference, slideEnvironment.revealedStep, slideEnvironment.reportStepCount);
  useBigNumberFitting(slideElementReference, children);
  useFloatFitting(slideElementReference, children);
  useSourceWidthFitting(slideElementReference, children);
  useBottomBandRoom(slideElementReference, children);
  useSlideCallbacks(slideEnvironment.isCurrentSlide, onEnter, onLeave);

  const slideTone = tone ?? detectedTone;
  useLetterboxBackground(slideElementReference, slideEnvironment.isCurrentSlide, slideTone, readBackgroundAddress(background));
  const slideAlign = align ?? (cover ? "center" : presentationSettings.align);
  const breadcrumbTrail = typeof breadcrumbs === "string" ? [breadcrumbs] : slideEnvironment.sectionTrail;
  const presentationLogo = presentationSettings.logo;
  const logoPlacement = logo === true ? "top-right" : logo;
  const showsLogo = !plain && logoPlacement !== false && presentationLogo !== undefined;
  const showsBreadcrumbs = !plain && !cover && breadcrumbs !== false && breadcrumbTrail.length > 0;
  const showsNumber = !plain && !cover && !hidden && number;
  // Printed copies carry the notes as text: the PowerPoint export reads them from the print view.
  const notesText = slideEnvironment.isSlideCopy ? writeNotesText(listSlideNotes(children)) : "";

  return (
    <section
      ref={slideElementReference}
      className={className}
      data-slide
      data-align={slideAlign}
      data-valign={valign ?? (cover || slideAlign === "center" ? "center" : "top")}
      data-tone={slideTone}
      data-background={background === undefined ? undefined : classifySlideBackground(background)}
      data-cover={cover || undefined}
      data-hidden={hidden || undefined}
      data-slide-address={slideEnvironment.slideAddress}
      data-transition={transition ?? presentationSettings.transition}
      data-default-step-effect={stepEffect ?? presentationSettings.stepEffect}
      data-current={slideEnvironment.isCurrentSlide || undefined}
      data-distant={(!slideEnvironment.isSlideNearby && !slideEnvironment.isSlideCopy) || undefined}
      data-notes={notesText === "" ? undefined : notesText}
      {...pickSourceMarks(otherProperties)}
      inert={!slideEnvironment.isCurrentSlide}
      style={{ ...createBackgroundStyle(background), "--transition-speed": resolveSpeedFactor(speed ?? presentationSettings.speed) } as CSSProperties}
    >
      {background !== undefined && <SlideBackgroundLayer backgroundValue={background} />}
      {showsLogo && logoPlacement !== "center" && <SlideLogo presentationLogo={presentationLogo} slideTone={slideTone} logoPlacement={logoPlacement} />}
      <div data-content>
        {showsLogo && logoPlacement === "center" && <SlideLogo presentationLogo={presentationLogo} slideTone={slideTone} logoPlacement={logoPlacement} />}
        {children}
      </div>
      {showsBreadcrumbs && (
        <nav data-breadcrumbs>
          {breadcrumbTrail.map((sectionTitle, trailPosition) => (
            <span key={trailPosition}>{sectionTitle}</span>
          ))}
        </nav>
      )}
      {showsNumber && <span data-slide-number>{slideEnvironment.slideNumber}</span>}
    </section>
  );
}

function useSlideCallbacks(isCurrentSlide: boolean, onEnter: (() => void) | undefined, onLeave: (() => void) | undefined) {
  const enterSlide = useEffectEvent(() => onEnter?.());
  const leaveSlide = useEffectEvent(() => onLeave?.());
  useEffect(() => {
    if (!isCurrentSlide) return;
    enterSlide();
    return () => leaveSlide();
  }, [isCurrentSlide]);
}

function SlideLogo({ presentationLogo, slideTone, logoPlacement }: SlideLogoProperties) {
  if (typeof presentationLogo === "function") {
    const LogoComponent = presentationLogo;
    return (
      <div data-logo={slideTone} data-logo-placement={logoPlacement}>
        <LogoComponent dark={slideTone === "dark"} />
      </div>
    );
  }
  const logoVersions = typeof presentationLogo === "string" ? { light: presentationLogo } : presentationLogo;
  const darkLogo = slideTone === "dark" ? logoVersions.dark : undefined;
  return <img data-logo={darkLogo === undefined ? "light" : "dark"} data-logo-placement={logoPlacement} src={darkLogo ?? logoVersions.light} alt="" />;
}

function createBackgroundStyle(backgroundValue: SlideBackgroundValue | undefined): CSSProperties | undefined {
  if (backgroundValue === undefined) return undefined;
  const backgroundKind = classifySlideBackground(backgroundValue);
  if (backgroundKind === "color") return { backgroundColor: backgroundValue as string, "--slide-color": backgroundValue as string } as CSSProperties;
  if (backgroundKind === "picture") return { backgroundImage: `url("${backgroundValue as string}")` };
  return undefined;
}
