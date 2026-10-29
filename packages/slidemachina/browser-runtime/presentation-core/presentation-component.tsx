import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { defaultAspectRatio, measureCanvasSize, type AspectRatio } from "../../shared-between-runtimes/canvas-size.js";
import { useCanvasLayout, useCanvasResizing } from "./canvas-scaling.ts";
import { DevelopmentFeedback } from "../presentation-interface/development-feedback.tsx";
import { EditorSwitch } from "../source-editor/editor-switch.tsx";
import { MemePanelSwitch } from "../source-editor/meme-panel-switch.tsx";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { PresentationToolbar, useToolbarHiding } from "../presentation-interface/presentation-toolbar.tsx";
import { PrintMenu } from "../presentation-interface/print-menu.tsx";
import { PrintViewBar } from "../presentation-interface/print-view-bar.tsx";
import { PrintPages } from "../slide-printing/print-pages.tsx";
import { usePrintPreparation } from "../slide-printing/print-preparation.ts";
import { useKeyboardControls } from "../slide-navigation/keyboard-controls.ts";
import {
  SlideEnvironmentContext,
  useSlideEnvironments,
  type PresentationLogo,
  type PresentationSettings,
  type SlideAlign,
} from "./slide-environment.ts";
import { useSlideNavigation } from "../slide-navigation/slide-navigation.ts";
import { findShownSlide, numberSlides } from "../slide-navigation/slide-numbering.ts";
import type { SlideTransition } from "../slide-transitions/slide-transition.ts";
import type { TransitionSpeed } from "../slide-transitions/transition-speed.ts";
import type { StepEffect } from "../slide-steps/step-attributes.ts";
import { SlideNavigator } from "../presentation-interface/slide-navigator.tsx";
import { MinimapSwitch, SlideMinimap, useMinimapShowing } from "../presentation-interface/slide-minimap.tsx";
import { useOverviewAddress } from "../presentation-interface/overview-address.ts";
import { buildSlideOutline, readPresentationTitle } from "./slide-outline.tsx";
import { runNavigatorTransition } from "../slide-transitions/navigator-transition.ts";
import { useTouchControls } from "../slide-navigation/touch-controls.ts";
import { useTypedSlideNumber } from "../slide-navigation/typed-slide-number.ts";
import { usePresenterSync, type SlideCommand } from "../presenter-view/presenter-channel.ts";
import { PresenterView } from "../presenter-view/presenter-view.tsx";
import { useCustomFavicon } from "./custom-favicon.ts";
import { isPresenterWindow, openPresenterWindow, PresenterWindowSwitch } from "../presenter-view/presenter-window.tsx";

// The list of a repository shows /talk/?cover in a frame, and the build photographs it: the first slide alone, every step shown.
const isCoverPreview = new URLSearchParams(location.search).has("cover");
// A slide two slides away or closer starts its heavy parts.
const nearbySlideDistance = 2;

export type PresentationProperties = {
  children?: ReactNode;
  // Only when the tab should read differently: by default the title is the h1 of the opening <Slide cover>.
  title?: string;
  lang?: string;
  align?: SlideAlign;
  logo?: PresentationLogo;
  // The tab icon, an imported picture: import favicon from "./favicon.svg". By default the slidemachina mark.
  favicon?: string;
  transition?: SlideTransition;
  // "fast", "normal", "slow" or how many times faster than normal; a slide can set its own.
  speed?: TransitionSpeed;
  // The effect of every step that names none of its own, "rise" by default; a slide can set its own.
  stepEffect?: StepEffect;
  // Stands between a section and its subsection in the breadcrumbs and the navigator: "/", "·", "→".
  breadcrumbsSeparator?: string;
  // Read by the build, which typographs the slide text; false keeps the text exactly as written.
  typography?: boolean;
  // "2026-07-31": read by the list of a presentation repository, which puts the newest first.
  date?: string;
  // "16:9", "4:3", "9:16": the format of every slide, thumbnail, cover and printed page.
  aspectRatio?: AspectRatio;
  // The line on the bottom edge that shows how far the talk has gone; false hides it.
  progress?: boolean;
  // Called after every move: slide number from 1, step from 0. Also on load, with the position from the address.
  onChange?: (position: PresentationPosition) => void;
  // Minutes for the talk: the presenter view shows the time left and whether the talk runs ahead or behind.
  duration?: number;
};
export type PresentationPosition = { slide: number; step: number };

export function Presentation({
  children,
  title,
  lang = "en",
  align = "left",
  logo,
  favicon,
  transition = "auto",
  speed = "normal",
  stepEffect,
  breadcrumbsSeparator,
  aspectRatio = defaultAspectRatio,
  progress = true,
  onChange,
  duration,
}: PresentationProperties) {
  const outlinedSlides = useMemo(() => buildSlideOutline(children), [children]);
  const pageTitle = useMemo(() => title ?? readPresentationTitle(children), [title, children]);
  useCustomFavicon(favicon);
  const slideNumbering = useMemo(() => numberSlides(outlinedSlides.map((outlinedSlide) => outlinedSlide.isHidden)), [outlinedSlides]);
  const { shownNumbers, shownSlideIndexes } = slideNumbering;
  const hasHiddenSlides = shownSlideIndexes.length < outlinedSlides.length;
  const stepCountsReference = useRef<number[]>([]);
  const slideNavigation = useSlideNavigation(slideNumbering, stepCountsReference);
  const { currentPosition } = slideNavigation;
  const formatSize = useMemo(() => {
    const measuredFormatSize = measureCanvasSize(aspectRatio);
    if (measuredFormatSize === undefined) throw new Error(pickInterfaceTexts(lang).wrongAspectRatio(aspectRatio));
    return measuredFormatSize;
  }, [aspectRatio, lang]);
  const { canvasWidth: formatWidth, canvasHeight: formatHeight } = formatSize;
  const [isNavigatorOpen, setNavigatorOpen] = useOverviewAddress();
  const printPreparation = usePrintPreparation();
  const { isPrintView, printsSteps, printsHidden } = printPreparation;
  const printedSlideIndexes = useMemo(
    () => (printsHidden ? [...outlinedSlides.keys()] : shownSlideIndexes),
    [printsHidden, outlinedSlides, shownSlideIndexes],
  );
  const { isMinimapShown, toggleMinimap } = useMinimapShowing(import.meta.env.DEV && !isPrintView && !isCoverPreview);
  const { canvasScale, canvasWidth, canvasHeight, hasRoomUnderCanvas } = useCanvasLayout(formatSize);
  const isCanvasResizing = useCanvasResizing({ canvasWidth, canvasHeight });
  const [isPaused, setPaused] = useState(false);
  const { isToolbarHidden, toggleToolbar } = useToolbarHiding();
  const switchNavigator = (opensNavigator: boolean, chosenSlideIndex?: number) =>
    runNavigatorTransition(() => {
      if (chosenSlideIndex !== undefined) slideNavigation.jumpToSlide(chosenSlideIndex);
      setNavigatorOpen(opensNavigator);
    }, chosenSlideIndex ?? currentPosition.slideIndex);
  const presentationSettings: PresentationSettings = useMemo(
    () => ({ align, logo, lang, transition, speed, stepEffect }),
    [align, logo, lang, transition, speed, stepEffect],
  );
  const sectionTrails = useMemo(() => outlinedSlides.map((outlinedSlide) => outlinedSlide.sectionTrail), [outlinedSlides]);
  const describeSlideEnvironment = useSlideEnvironments(slideNumbering, sectionTrails, presentationSettings, stepCountsReference);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const reportPosition = useEffectEvent((slideIndex: number, stepIndex: number) => onChange?.({ slide: shownNumbers[slideIndex] ?? slideIndex + 1, step: stepIndex }));
  useEffect(() => {
    if (!isCoverPreview && !isPresenterWindow) reportPosition(currentPosition.slideIndex, currentPosition.stepIndex);
  }, [currentPosition.slideIndex, currentPosition.stepIndex]);

  // In a pause any slide key only brings the slide back: the audience never sees it change behind the black screen.
  const unlessPaused = <ActionArguments extends unknown[]>(slideAction: (...actionArguments: ActionArguments) => void) =>
    isPaused ? () => setPaused(false) : slideAction;
  const runSlideCommand = (slideCommand: SlideCommand) => {
    if (slideCommand === "pause") setPaused((wasPaused) => !wasPaused);
    else if (slideCommand === "forward") unlessPaused(slideNavigation.goForward)();
    else if (slideCommand === "backward") unlessPaused(slideNavigation.goBackward)();
    else unlessPaused(slideNavigation.goToSlide)(slideCommand);
  };
  const { isAudienceConnected, steerSlides } = usePresenterSync({
    windowRole: isPresenterWindow ? "presenter" : isPrintView || isCoverPreview ? "alone" : "audience",
    currentPosition,
    isPaused,
    runSlideCommand,
    followAudience: (slidePosition, isAudiencePaused) => {
      slideNavigation.showPosition(slidePosition);
      setPaused(isAudiencePaused);
    },
  });
  const typedSlideNumber = useTypedSlideNumber((slideNumber) => steerSlides(findShownSlide(slideNumbering, slideNumber)));
  useKeyboardControls(
    {
      goForward: () => steerSlides("forward"),
      goBackward: () => steerSlides("backward"),
      goToFirstSlide: () => steerSlides(findShownSlide(slideNumbering, 1)),
      goToLastSlide: () => steerSlides(findShownSlide(slideNumbering, shownSlideIndexes.length)),
      // The presenter window has no navigator, toolbar or minimap; the slides window decides what a key does in a pause.
      openNavigator: isPresenterWindow ? () => undefined : unlessPaused(() => switchNavigator(true)),
      togglePause: () => steerSlides("pause"),
      toggleFullscreen,
      toggleToolbar: isPresenterWindow ? () => undefined : toggleToolbar,
      toggleMinimap: import.meta.env.DEV && !isPresenterWindow ? toggleMinimap : undefined,
      openPresenterWindow: isPresenterWindow ? undefined : openPresenterWindow,
      typeDigit: isPresenterWindow ? typedSlideNumber.appendDigit : unlessPaused(typedSlideNumber.appendDigit),
      confirmTypedNumber: typedSlideNumber.digits === "" ? undefined : typedSlideNumber.confirmNumber,
    },
    !isNavigatorOpen && !isPrintView,
  );
  useTouchControls(() => steerSlides("forward"), () => steerSlides("backward"), !isNavigatorOpen && !isPrintView);

  // A copy is a thumbnail or a printed page: it is never current and shows the step it is given.
  const renderSlide = (slideIndex: number, copiedStep?: number) => {
    const outlinedSlide = outlinedSlides[slideIndex]!;
    const isSlideCopy = copiedStep !== undefined;
    const isCurrentSlide = !isSlideCopy && slideIndex === currentPosition.slideIndex;
    const slidesAhead = slideIndex - currentPosition.slideIndex;
    const liveStep = slidesAhead < 0 ? Infinity : slidesAhead === 0 ? currentPosition.stepIndex : 0;
    const isSlideNearby = !isSlideCopy && Math.abs(slidesAhead) <= nearbySlideDistance;
    const slideEnvironment = describeSlideEnvironment({ slideIndex, isCurrentSlide, isSlideNearby, isSlideCopy, revealedStep: copiedStep ?? liveStep });
    return (
      <SlideEnvironmentContext key={outlinedSlide.slideKey} value={slideEnvironment}>
        {outlinedSlide.slideElement}
      </SlideEnvironmentContext>
    );
  };

  const canvasStyle = {
    "--format-width": formatWidth,
    "--format-height": formatHeight,
    "--canvas-width": canvasWidth,
    "--canvas-height": canvasHeight,
    "--canvas-scale": canvasScale,
    ...(breadcrumbsSeparator === undefined ? {} : { "--breadcrumbs-separator": JSON.stringify(breadcrumbsSeparator) }),
  } as CSSProperties;

  if (isPresenterWindow) {
    return (
      <PresenterView
        outlinedSlides={outlinedSlides}
        slideNumbering={slideNumbering}
        currentPosition={currentPosition}
        countSteps={(slideIndex) => stepCountsReference.current[slideIndex] ?? 0}
        renderSlide={renderSlide}
        canvasStyle={canvasStyle}
        formatWidth={formatWidth}
        languageCode={lang}
        pageTitle={pageTitle}
        talkMinutes={duration}
        typedDigits={typedSlideNumber.digits}
        isAudienceConnected={isAudienceConnected}
        isAudiencePaused={isAudienceConnected && isPaused}
        steerSlides={steerSlides}
      />
    );
  }

  if (isCoverPreview) {
    return (
      <div data-presentation data-cover-preview style={canvasStyle}>
        <div data-canvas>{outlinedSlides.length > 0 && renderSlide(0, Infinity)}</div>
      </div>
    );
  }

  return (
    <div data-presentation data-print-view={isPrintView || undefined} data-toolbar-under-canvas={hasRoomUnderCanvas || undefined} style={canvasStyle}>
      {pageTitle !== undefined && pageTitle !== "" && <title>{pageTitle}</title>}
      <style>{`@page { size: ${formatWidth}px ${formatHeight}px; }`}</style>
      <div data-canvas data-resizing={isCanvasResizing || undefined}>
        {[...outlinedSlides.keys()].map((slideIndex) => renderSlide(slideIndex))}
        {progress && shownSlideIndexes.length > 1 && (
          <div
            data-progress
            aria-hidden="true"
            style={{ "--progress-share": Math.max(0, (shownNumbers[currentPosition.slideIndex] ?? 1) - 1) / (shownSlideIndexes.length - 1) } as CSSProperties}
          />
        )}
        {isNavigatorOpen && (
          <SlideNavigator
            outlinedSlides={outlinedSlides}
            slideNumbering={slideNumbering}
            currentSlideIndex={currentPosition.slideIndex}
            formatWidth={formatWidth}
            canvasScale={canvasScale}
            languageCode={lang}
            renderThumbnail={(slideIndex) => renderSlide(slideIndex, Infinity)}
            closeNavigator={(chosenSlideIndex) => switchNavigator(false, chosenSlideIndex)}
          />
        )}
        {typedSlideNumber.digits !== "" && (
          <div data-typed-slide-number aria-live="polite" aria-label={pickInterfaceTexts(lang).jumpPrompt}>
            {typedSlideNumber.digits}
          </div>
        )}
      </div>
      {isMinimapShown && !isNavigatorOpen && (
        <SlideMinimap
          slideNumbering={slideNumbering}
          currentSlideIndex={currentPosition.slideIndex}
          formatWidth={formatWidth}
          languageCode={lang}
          renderThumbnail={(slideIndex) => renderSlide(slideIndex, Infinity)}
          goToSlide={slideNavigation.goToSlide}
        />
      )}
      <PresentationToolbar
        languageCode={lang}
        isHidden={isToolbarHidden}
        toggleHidden={toggleToolbar}
        isNavigatorOpen={isNavigatorOpen}
        toggleNavigator={() => switchNavigator(!isNavigatorOpen)}
        toggleFullscreen={toggleFullscreen}
      >
        <PresenterWindowSwitch languageCode={lang} />
        <PrintMenu
          languageCode={lang}
          printsSteps={printsSteps}
          choosePrintedSteps={printPreparation.choosePrintedSteps}
          printsHidden={hasHiddenSlides ? printsHidden : undefined}
          chooseHiddenSlides={printPreparation.chooseHiddenSlides}
          printPresentation={printPreparation.printPresentation}
          openPrintView={printPreparation.openPrintView}
        />
        {import.meta.env.DEV && (
          <>
            <span data-toolbar-divider />
            <MinimapSwitch languageCode={lang} isMinimapShown={isMinimapShown} toggleMinimap={toggleMinimap} />
            <EditorSwitch languageCode={lang} />
            <MemePanelSwitch languageCode={lang} />
            {import.meta.env.SLIDEMACHINA_AGENTATION !== "off" && <DevelopmentFeedback />}
          </>
        )}
      </PresentationToolbar>
      {printPreparation.isPrintPrepared && (
        <PrintPages
          printedSlideIndexes={printedSlideIndexes}
          formatWidth={formatWidth}
          printsSteps={printsSteps}
          isPrintView={isPrintView}
          countSteps={(slideIndex) => stepCountsReference.current[slideIndex] ?? 0}
          renderPrintedSlide={renderSlide}
          renderPrintViewBar={(pageCount) => (
            <PrintViewBar
              languageCode={lang}
              pageCount={pageCount}
              printsSteps={printsSteps}
              choosePrintedSteps={printPreparation.choosePrintedSteps}
              printsHidden={hasHiddenSlides ? printsHidden : undefined}
              chooseHiddenSlides={printPreparation.chooseHiddenSlides}
              printPresentation={printPreparation.printPresentation}
              closePrintView={printPreparation.closePrintView}
            />
          )}
        />
      )}
      {isPaused && (
        <button type="button" data-pause-screen onClick={() => setPaused(false)}>
          <span data-pause-return>{pickInterfaceTexts(lang).pauseReturnButton}</span>
        </button>
      )}
    </div>
  );
}

function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement === null) void document.documentElement.requestFullscreen();
  else void document.exitFullscreen();
}
