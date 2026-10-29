import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { useWindowKeydown } from "../slide-navigation/keyboard-listener.ts";
import type { OutlinedSlide } from "../presentation-core/slide-outline.tsx";
import type { SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";
import { HiddenSlideIcon } from "./hidden-slide-icon.tsx";

const navigatorPadding = 64;
const thumbnailGap = 32;
// Six columns on a 16:9 screen: a deck of fifty slides fits in three screens.
const minimumThumbnailWidth = 240;
// On a phone the canvas is small: a thumbnail stays at least this wide on screen, so fewer columns fit.
const minimumScreenThumbnailWidth = 140;
const minimumColumnCount = 2;
// Rows matter more than columns when the next row is found among groups of different length.
const rowDistanceWeight = 100_000;

type SlideGroup = {
  trailKey: string;
  sectionTrail: string[];
  slideIndexes: number[];
};
type SlideNavigatorProperties = {
  outlinedSlides: OutlinedSlide[];
  slideNumbering: SlideNumbering;
  currentSlideIndex: number;
  formatWidth: number;
  canvasScale: number;
  languageCode: string;
  renderThumbnail: (slideIndex: number) => ReactNode;
  // Without a slide the navigator closes on the slide it was opened from.
  closeNavigator: (chosenSlideIndex?: number) => void;
};

export function SlideNavigator({
  outlinedSlides,
  slideNumbering,
  currentSlideIndex,
  formatWidth,
  canvasScale,
  languageCode,
  renderThumbnail,
  closeNavigator,
}: SlideNavigatorProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(currentSlideIndex);
  const thumbnailElements = useRef<HTMLButtonElement[]>([]);

  useLayoutEffect(() => {
    thumbnailElements.current[selectedSlideIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedSlideIndex]);

  const openSlide = (slideIndex: number) => closeNavigator(slideIndex);

  useWindowKeydown((keyboardEvent) => {
    const lastSlideIndex = outlinedSlides.length - 1;
    if (keyboardEvent.code === "Escape" || keyboardEvent.code === "KeyO") closeNavigator();
    else if (keyboardEvent.key === "Enter") openSlide(selectedSlideIndex);
    else if (keyboardEvent.key === "ArrowRight") setSelectedSlideIndex(Math.min(selectedSlideIndex + 1, lastSlideIndex));
    else if (keyboardEvent.key === "ArrowLeft") setSelectedSlideIndex(Math.max(selectedSlideIndex - 1, 0));
    else if (keyboardEvent.key === "ArrowDown") setSelectedSlideIndex(findVerticalNeighbour(thumbnailElements.current, selectedSlideIndex, 1));
    else if (keyboardEvent.key === "ArrowUp") setSelectedSlideIndex(findVerticalNeighbour(thumbnailElements.current, selectedSlideIndex, -1));
    else if (keyboardEvent.key === "Home") setSelectedSlideIndex(0);
    else if (keyboardEvent.key === "End") setSelectedSlideIndex(lastSlideIndex);
    else return false;
    return true;
  }, true);

  const leastThumbnailWidth = Math.max(minimumThumbnailWidth, minimumScreenThumbnailWidth / canvasScale);
  // The navigator covers the whole window, letterbox margins too: on a phone held upright it is the full screen, not a strip.
  const navigatorWidth = Math.max(formatWidth, window.innerWidth / canvasScale);
  const columnCount = Math.max(minimumColumnCount, Math.floor((navigatorWidth - 2 * navigatorPadding + thumbnailGap) / (leastThumbnailWidth + thumbnailGap)));
  const thumbnailWidth = (navigatorWidth - 2 * navigatorPadding - (columnCount - 1) * thumbnailGap) / columnCount;
  const navigatorStyle = {
    "--navigator-columns": columnCount,
    "--navigator-gap": `${thumbnailGap}px`,
    "--thumbnail-scale": thumbnailWidth / formatWidth,
  } as CSSProperties;

  return (
    <dialog open data-navigator aria-label={interfaceTexts.navigatorLabel} style={navigatorStyle}>
      <div data-navigator-scroller style={{ padding: navigatorPadding }}>
        {groupSlidesBySection(outlinedSlides).map((slideGroup) => (
          <section data-navigator-group key={slideGroup.slideIndexes[0]}>
            {slideGroup.sectionTrail.length > 0 && (
              <h2 data-navigator-heading>
                {slideGroup.sectionTrail.map((sectionTitle, trailPosition) => (
                  <span key={trailPosition}>{sectionTitle}</span>
                ))}
              </h2>
            )}
            <div data-navigator-grid>
              {slideGroup.slideIndexes.map((slideIndex) => {
                const isHidden = slideNumbering.hiddenFlags[slideIndex] === true;
                return (
                  <button
                    key={slideIndex}
                    type="button"
                    data-thumbnail
                    data-thumbnail-index={slideIndex}
                    data-selected={slideIndex === selectedSlideIndex || undefined}
                    data-hidden={isHidden || undefined}
                    title={isHidden ? interfaceTexts.hiddenSlideLabel : undefined}
                    aria-current={slideIndex === currentSlideIndex || undefined}
                    ref={(thumbnailElement) => {
                      if (thumbnailElement !== null) thumbnailElements.current[slideIndex] = thumbnailElement;
                    }}
                    onClick={() => openSlide(slideIndex)}
                  >
                    {renderThumbnail(slideIndex)}
                    <span data-thumbnail-number>
                      {isHidden && <HiddenSlideIcon />}
                      {slideNumbering.slideAddresses[slideIndex]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </dialog>
  );
}

function groupSlidesBySection(outlinedSlides: OutlinedSlide[]): SlideGroup[] {
  const slideGroups: SlideGroup[] = [];
  outlinedSlides.forEach((outlinedSlide, slideIndex) => {
    const trailKey = outlinedSlide.sectionTrail.join("\n");
    const lastGroup = slideGroups.at(-1);
    if (lastGroup?.trailKey === trailKey) lastGroup.slideIndexes.push(slideIndex);
    else slideGroups.push({ trailKey, sectionTrail: outlinedSlide.sectionTrail, slideIndexes: [slideIndex] });
  });
  return slideGroups;
}

// Groups make rows of different length, so the next row is found on screen, not by arithmetic.
function findVerticalNeighbour(thumbnailElements: HTMLButtonElement[], selectedSlideIndex: number, rowDirection: 1 | -1) {
  const selectedThumbnail = thumbnailElements[selectedSlideIndex];
  if (selectedThumbnail === undefined) return selectedSlideIndex;
  const selectedBox = selectedThumbnail.getBoundingClientRect();
  let nearestSlideIndex = selectedSlideIndex;
  let nearestDistance = Infinity;
  thumbnailElements.forEach((thumbnailElement, slideIndex) => {
    const candidateBox = thumbnailElement.getBoundingClientRect();
    const verticalDistance = (candidateBox.top - selectedBox.top) * rowDirection;
    if (verticalDistance < 1) return;
    const combinedDistance = verticalDistance * rowDistanceWeight + Math.abs(candidateBox.left - selectedBox.left);
    if (combinedDistance < nearestDistance) {
      nearestDistance = combinedDistance;
      nearestSlideIndex = slideIndex;
    }
  });
  return nearestSlideIndex;
}
