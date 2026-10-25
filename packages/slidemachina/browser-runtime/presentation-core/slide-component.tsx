import { useRef, type CSSProperties, type ReactNode } from "react";
import { isBackgroundColor, useBackgroundTone, type SlideTone } from "./background-tone.ts";
import { useSlideEnvironment, type PresentationLogo, type SlideAlign } from "./slide-environment.ts";
import { useBigNumberFitting } from "./width-fitting.ts";
import type { SlideTransition } from "../slide-transitions/slide-transition.ts";
import { resolveSpeedFactor, type TransitionSpeed } from "../slide-transitions/transition-speed.ts";
import { useStepVisibility } from "../slide-steps/step-visibility.ts";

export type SlideLogoPlacement = "top-right" | "top" | "center" | "bottom";
export type SlideProperties = {
  children?: ReactNode;
  align?: SlideAlign;
  cover?: boolean;
  background?: string;
  tone?: SlideTone;
  transition?: SlideTransition;
  speed?: TransitionSpeed;
  plain?: boolean;
  logo?: boolean | SlideLogoPlacement;
  breadcrumbs?: boolean | string;
  number?: boolean;
  className?: string;
};
type SlideLogoProperties = { presentationLogo: PresentationLogo; slideTone: SlideTone; logoPlacement: SlideLogoPlacement };

export function Slide({
  children,
  align,
  cover = false,
  background,
  tone,
  transition,
  speed,
  plain = false,
  logo = true,
  breadcrumbs = true,
  number = true,
  className,
}: SlideProperties) {
  const slideEnvironment = useSlideEnvironment();
  const { presentationSettings } = slideEnvironment;
  const slideElementReference = useRef<HTMLElement>(null);
  const detectedTone = useBackgroundTone(slideElementReference, background, className);
  useStepVisibility(slideElementReference, slideEnvironment.revealedStep, slideEnvironment.reportStepCount);
  useBigNumberFitting(slideElementReference, children);

  const slideTone = tone ?? detectedTone;
  const breadcrumbTrail = typeof breadcrumbs === "string" ? [breadcrumbs] : slideEnvironment.sectionTrail;
  const presentationLogo = presentationSettings.logo;
  const logoPlacement = logo === true ? "top-right" : logo;
  const showsLogo = !plain && logoPlacement !== false && presentationLogo !== undefined;
  const showsBreadcrumbs = !plain && !cover && breadcrumbs !== false && breadcrumbTrail.length > 0;
  const showsNumber = !plain && !cover && number;

  return (
    <section
      ref={slideElementReference}
      className={className}
      data-slide
      data-align={align ?? (cover ? "center" : presentationSettings.align)}
      data-tone={slideTone}
      data-cover={cover || undefined}
      data-transition={transition ?? presentationSettings.transition}
      data-current={slideEnvironment.isCurrentSlide || undefined}
      inert={!slideEnvironment.isCurrentSlide}
      style={{ ...createBackgroundStyle(background), "--transition-speed": resolveSpeedFactor(speed ?? presentationSettings.speed) } as CSSProperties}
    >
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

function createBackgroundStyle(backgroundValue: string | undefined): CSSProperties | undefined {
  if (backgroundValue === undefined) return undefined;
  if (isBackgroundColor(backgroundValue)) return { backgroundColor: backgroundValue };
  return { backgroundImage: `url("${backgroundValue}")` };
}
