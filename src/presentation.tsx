import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useCanvasScaling } from "./canvas-scaling.ts";
import { DevelopmentFeedback } from "./development-feedback.tsx";
import { EditorSwitch } from "./editor-switch.tsx";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { PresentationToolbar, useToolbarHiding } from "./presentation-toolbar.tsx";
import { PrintMenu } from "./print-menu.tsx";
import { PrintPages, usePrintPreparation } from "./print-pages.tsx";
import { useKeyboardControls } from "./keyboard-controls.ts";
import {
  SlideEnvironmentContext,
  useSlideEnvironments,
  type PresentationLogo,
  type PresentationSettings,
  type SlideAlign,
} from "./slide-environment.ts";
import { useSlideNavigation } from "./slide-navigation.ts";
import type { SlideTransition } from "./slide-transition.ts";
import { SlideNavigator } from "./slide-navigator.tsx";
import { buildSlideOutline } from "./slide-outline.tsx";
import { useSwipeControls } from "./swipe-controls.ts";
import { useTypedSlideNumber } from "./typed-slide-number.ts";

export type PresentationProperties = {
  children?: ReactNode;
  title?: string;
  lang?: string;
  align?: SlideAlign;
  logo?: PresentationLogo;
  transition?: SlideTransition;
  // Read by the build, which typographs the slide text; false keeps the text exactly as written.
  typography?: boolean;
  // "2026-07-31": read by the list of a presentation repository, which puts the newest first.
  date?: string;
};

// The list of a repository shows /talk/?cover in a frame, and the build photographs it: the first slide alone, every step shown.
const isCoverPreview = new URLSearchParams(location.search).has("cover");

export function Presentation({
  children,
  title,
  lang = "en",
  align = "left",
  logo,
  transition = "auto",
}: PresentationProperties) {
  const outlinedSlides = useMemo(() => buildSlideOutline(children), [children]);
  const stepCountsReference = useRef<number[]>([]);
  const slideNavigation = useSlideNavigation(outlinedSlides.length, stepCountsReference);
  const { currentPosition } = slideNavigation;
  const { canvasWidth, canvasScale } = useCanvasScaling();
  const [isNavigatorOpen, setNavigatorOpen] = useState(false);
  const [isBlackedOut, setBlackedOut] = useState(false);
  const { isToolbarHidden, toggleToolbar } = useToolbarHiding();
  const { isPrintPrepared, printsSteps, printPresentation } = usePrintPreparation();
  const typedSlideNumber = useTypedSlideNumber((slideNumber) => slideNavigation.goToSlide(slideNumber - 1));
  const presentationSettings: PresentationSettings = useMemo(
    () => ({ align, logo, lang, transition }),
    [align, logo, lang, transition],
  );
  const sectionTrails = useMemo(() => outlinedSlides.map((outlinedSlide) => outlinedSlide.sectionTrail), [outlinedSlides]);
  const describeSlideEnvironment = useSlideEnvironments(sectionTrails, presentationSettings, stepCountsReference);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useKeyboardControls(
    {
      goForward: slideNavigation.goForward,
      goBackward: slideNavigation.goBackward,
      goToFirstSlide: () => slideNavigation.goToSlide(0),
      goToLastSlide: () => slideNavigation.goToSlide(outlinedSlides.length - 1),
      openNavigator: () => setNavigatorOpen(true),
      toggleBlackout: () => setBlackedOut((wasBlackedOut) => !wasBlackedOut),
      toggleFullscreen,
      toggleToolbar,
      typeDigit: typedSlideNumber.appendDigit,
      confirmTypedNumber: typedSlideNumber.digits === "" ? undefined : typedSlideNumber.confirmNumber,
    },
    !isNavigatorOpen,
  );
  useSwipeControls(slideNavigation.goForward, slideNavigation.goBackward, !isNavigatorOpen);

  // A copy is a thumbnail or a printed page: it is never current and shows the step it is given.
  const renderSlide = (slideIndex: number, copiedStep?: number) => {
    const outlinedSlide = outlinedSlides[slideIndex];
    const isSlideCopy = copiedStep !== undefined;
    const isCurrentSlide = !isSlideCopy && slideIndex === currentPosition.slideIndex;
    const slidesAhead = slideIndex - currentPosition.slideIndex;
    const liveStep = slidesAhead < 0 ? Infinity : slidesAhead === 0 ? currentPosition.stepIndex : 0;
    const isSlideNearby = !isSlideCopy && Math.abs(slidesAhead) <= 2;
    const slideEnvironment = describeSlideEnvironment({ slideIndex, isCurrentSlide, isSlideNearby, isSlideCopy, revealedStep: copiedStep ?? liveStep });
    return (
      <SlideEnvironmentContext key={outlinedSlide.slideKey} value={slideEnvironment}>
        {outlinedSlide.slideElement}
      </SlideEnvironmentContext>
    );
  };

  const canvasStyle = { "--canvas-width": canvasWidth, "--canvas-scale": canvasScale } as CSSProperties;

  if (isCoverPreview) {
    return (
      <div data-presentation data-cover-preview style={canvasStyle}>
        <div data-canvas>{outlinedSlides.length > 0 && renderSlide(0, Infinity)}</div>
      </div>
    );
  }

  return (
    <div data-presentation style={canvasStyle}>
      {title !== undefined && <title>{title}</title>}
      <div data-canvas>
        {[...outlinedSlides.keys()].map((slideIndex) => renderSlide(slideIndex))}
        {isNavigatorOpen && (
          <SlideNavigator
            outlinedSlides={outlinedSlides}
            currentSlideIndex={currentPosition.slideIndex}
            canvasWidth={canvasWidth}
            languageCode={lang}
            renderThumbnail={(slideIndex) => renderSlide(slideIndex, Infinity)}
            goToSlide={slideNavigation.goToSlide}
            closeNavigator={() => setNavigatorOpen(false)}
          />
        )}
        {typedSlideNumber.digits !== "" && (
          <div data-typed-slide-number aria-live="polite" aria-label={pickInterfaceTexts(lang).jumpPrompt}>
            {typedSlideNumber.digits}
          </div>
        )}
      </div>
      <PresentationToolbar
        languageCode={lang}
        isHidden={isToolbarHidden}
        toggleHidden={toggleToolbar}
        isNavigatorOpen={isNavigatorOpen}
        toggleNavigator={() => setNavigatorOpen((wasNavigatorOpen) => !wasNavigatorOpen)}
        toggleFullscreen={toggleFullscreen}
      >
        <PrintMenu languageCode={lang} printsSteps={printsSteps} printPresentation={printPresentation} />
        {import.meta.env.DEV && (
          <>
            <span data-toolbar-divider />
            <EditorSwitch languageCode={lang} />
            {import.meta.env.SLIDEMACHINA_AGENTATION !== "off" && <DevelopmentFeedback />}
          </>
        )}
      </PresentationToolbar>
      {isPrintPrepared && (
        <PrintPages
          slideCount={outlinedSlides.length}
          printsSteps={printsSteps}
          countSteps={(slideIndex) => stepCountsReference.current[slideIndex] ?? 0}
          renderPrintedSlide={renderSlide}
        />
      )}
      {isBlackedOut && <div data-blackout onClick={() => setBlackedOut(false)} />}
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement === null) void document.documentElement.requestFullscreen();
  else void document.exitFullscreen();
}
