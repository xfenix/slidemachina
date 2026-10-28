import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import type { OutlinedSlide } from "../presentation-core/slide-outline.tsx";
import { useWindowKeydown } from "../slide-navigation/keyboard-listener.ts";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import { findNeighbourSlide, type SlideNumbering } from "../slide-navigation/slide-numbering.ts";
import type { SlideCommand } from "./presenter-channel.ts";
import { keepFocus, PresenterTimer } from "./presenter-timer.tsx";

type PresenterViewProperties = {
  outlinedSlides: OutlinedSlide[];
  slideNumbering: SlideNumbering;
  currentPosition: PresentationPosition;
  countSteps: (slideIndex: number) => number;
  renderSlide: (slideIndex: number, copiedStep: number) => ReactNode;
  canvasStyle: CSSProperties;
  formatWidth: number;
  languageCode: string;
  pageTitle?: string;
  talkMinutes?: number;
  typedDigits: string;
  isAudienceConnected: boolean;
  isAudiencePaused: boolean;
  steerSlides: (slideCommand: SlideCommand) => void;
};
type SlideFrameProperties = { formatWidth: number; children: ReactNode };

const notesSizeStorageKey = "slidemachina-notes-size";
const defaultNotesSize = 32;
const smallestNotesSize = 16;
const largestNotesSize = 72;
const notesSizeStep = 4;

// The notes size outlives the window: a speaker sets it once for the laptop screen.
function useNotesSize() {
  const [notesSize, setNotesSize] = useState(() => Number(localStorage.getItem(notesSizeStorageKey) ?? defaultNotesSize) || defaultNotesSize);
  useEffect(() => {
    localStorage.setItem(notesSizeStorageKey, String(notesSize));
  }, [notesSize]);
  const resizeNotes = (sizeChange: number) =>
    setNotesSize((previousSize) => Math.min(largestNotesSize, Math.max(smallestNotesSize, previousSize + sizeChange)));
  return { notesSize, enlargeNotes: () => resizeNotes(notesSizeStep), shrinkNotes: () => resizeNotes(-notesSizeStep) };
}

// A slide copy at the size of its frame: the frame measures itself, the copy keeps its canvas pixels and is scaled.
function SlideFrame({ formatWidth, children }: SlideFrameProperties) {
  const frameReference = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frameElement = frameReference.current!;
    const resizeObserver = new ResizeObserver(() => frameElement.style.setProperty("--presenter-slide-scale", String(frameElement.clientWidth / formatWidth)));
    resizeObserver.observe(frameElement);
    return () => resizeObserver.disconnect();
  }, [formatWidth]);
  return (
    <div ref={frameReference} data-presenter-frame>
      {children}
    </div>
  );
}

// The second window of the speaker: the slide on screen at its step, what comes next, notes, time and the place in the talk.
export function PresenterView({
  outlinedSlides,
  slideNumbering,
  currentPosition,
  countSteps,
  renderSlide,
  canvasStyle,
  formatWidth,
  languageCode,
  pageTitle,
  talkMinutes,
  typedDigits,
  isAudienceConnected,
  isAudiencePaused,
  steerSlides,
}: PresenterViewProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const { slideIndex, stepIndex } = currentPosition;
  const { slideAddresses, shownNumbers, shownSlideIndexes } = slideNumbering;
  const isHiddenSlide = slideNumbering.hiddenFlags[slideIndex] === true;
  const { sectionTrail, slideNotes } = outlinedSlides[slideIndex]!;
  const { notesSize, enlargeNotes, shrinkNotes } = useNotesSize();
  const notesReference = useRef<HTMLDivElement>(null);
  // The copy of the current slide reports its steps while it mounts, after this view has rendered.
  const [currentStepCount, setCurrentStepCount] = useState(0);
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- step counts arrive in a ref from the mounted copy
    setCurrentStepCount(countSteps(slideIndex));
  }, [countSteps, slideIndex, stepIndex]);

  const hasNextStep = stepIndex < currentStepCount;
  const nextSlideIndex = findNeighbourSlide(slideNumbering, slideIndex, 1);
  const nextLabel = hasNextStep
    ? interfaceTexts.presenterNextStep(stepIndex + 1, currentStepCount)
    : nextSlideIndex === undefined
      ? interfaceTexts.presenterLastSlide
      : interfaceTexts.presenterNextSlide(slideAddresses[nextSlideIndex]!);
  // The latest note whose step is shown leads; notes for later steps wait dimmed.
  const leadingNoteStep = Math.max(0, ...slideNotes.map((slideNote) => slideNote.noteStep).filter((noteStep) => noteStep <= stepIndex));
  const marksLeadingNote = slideNotes.some((slideNote) => slideNote.noteStep > 0);

  useEffect(() => {
    notesReference.current?.scrollTo({ top: 0 });
  }, [slideIndex]);
  useEffect(() => {
    notesReference.current?.querySelector("[data-note-leading]")?.scrollIntoView({ block: "nearest" });
  }, [slideIndex, leadingNoteStep]);

  useWindowKeydown((keyboardEvent) => {
    if (keyboardEvent.code === "Equal" || keyboardEvent.code === "NumpadAdd") enlargeNotes();
    else if (keyboardEvent.code === "Minus" || keyboardEvent.code === "NumpadSubtract") shrinkNotes();
    else return false;
    return true;
  }, true);

  return (
    <div data-presenter-view style={canvasStyle}>
      {pageTitle !== undefined && pageTitle !== "" && <title>{interfaceTexts.presenterTitle(pageTitle)}</title>}
      <header data-presenter-header>
        <p data-presenter-counter>
          <strong>
            {isHiddenSlide
              ? interfaceTexts.presenterHiddenSlide(slideAddresses[slideIndex]!)
              : interfaceTexts.presenterSlideCounter(shownNumbers[slideIndex]!, shownSlideIndexes.length)}
          </strong>
          {currentStepCount > 0 && <span>{interfaceTexts.presenterStepCounter(stepIndex, currentStepCount)}</span>}
          {typedDigits !== "" && <span data-presenter-typed-number>→ {typedDigits}</span>}
        </p>
        <nav data-presenter-trail>
          {sectionTrail.map((sectionTitle, trailPosition) => (
            <span key={trailPosition}>{sectionTitle}</span>
          ))}
        </nav>
      </header>
      <section data-presenter-current aria-label={interfaceTexts.presenterCurrentLabel}>
        <SlideFrame formatWidth={formatWidth}>{renderSlide(slideIndex, stepIndex)}</SlideFrame>
        {isAudiencePaused && <output data-presenter-status="paused">{interfaceTexts.presenterPaused}</output>}
        {!isAudienceConnected && <output data-presenter-status="alone">{interfaceTexts.presenterDisconnected}</output>}
      </section>
      <section data-presenter-next aria-label={nextLabel}>
        <h2>{nextLabel}</h2>
        {nextSlideIndex !== undefined || hasNextStep ? (
          <button type="button" aria-label={nextLabel} onPointerDown={keepFocus} onClick={() => steerSlides("forward")}>
            <SlideFrame formatWidth={formatWidth}>{hasNextStep || nextSlideIndex === undefined ? renderSlide(slideIndex, stepIndex + 1) : renderSlide(nextSlideIndex, 0)}</SlideFrame>
          </button>
        ) : (
          <div data-presenter-frame data-presenter-end />
        )}
      </section>
      <PresenterTimer
        languageCode={languageCode}
        slideAddress={slideAddresses[slideIndex]!}
        stepIndex={stepIndex}
        shownNumber={shownNumbers[slideIndex]!}
        shownCount={shownSlideIndexes.length}
        talkMinutes={talkMinutes}
      />
      <section data-presenter-notes aria-label={interfaceTexts.presenterNotesLabel}>
        <div data-presenter-notes-bar>
          <h2>{interfaceTexts.presenterNotesLabel}</h2>
          <div data-presenter-buttons>
            <button type="button" aria-label={interfaceTexts.presenterSmallerNotes} title={interfaceTexts.presenterSmallerNotes} onPointerDown={keepFocus} onClick={shrinkNotes} disabled={notesSize <= smallestNotesSize}>
              A−
            </button>
            <button type="button" aria-label={interfaceTexts.presenterLargerNotes} title={interfaceTexts.presenterLargerNotes} onPointerDown={keepFocus} onClick={enlargeNotes} disabled={notesSize >= largestNotesSize}>
              A+
            </button>
          </div>
        </div>
        <div ref={notesReference} data-presenter-notes-text style={{ "--notes-size": `${notesSize}px` } as CSSProperties}>
          {slideNotes.length === 0 && <p data-presenter-no-notes>{interfaceTexts.presenterNoNotes}</p>}
          {slideNotes.map((slideNote, notePosition) => (
            <div
              key={notePosition}
              data-presenter-note
              data-note-ahead={slideNote.noteStep > stepIndex || undefined}
              data-note-leading={(marksLeadingNote && slideNote.noteStep === leadingNoteStep) || undefined}
            >
              {slideNote.noteContent}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
