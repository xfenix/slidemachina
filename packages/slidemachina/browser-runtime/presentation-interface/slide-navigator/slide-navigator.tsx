import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pickInterfaceTexts } from "../interface-texts.ts";
import { useWindowKeydown } from "../../slide-navigation/keyboard-listener.ts";
import type { OutlinedSlide } from "../../presentation-core/slide-outline.tsx";

const navigatorPadding = 64;
const thumbnailGap = 32;
// Six columns on a 16:9 screen: a deck of fifty slides fits in three screens.
const minimumThumbnailWidth = 240;
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
  currentSlideIndex: number;
  canvasWidth: number;
  languageCode: string;
  renderThumbnail: (slideIndex: number) => ReactNode;
  goToSlide: (slideIndex: number) => void;
  closeNavigator: () => void;
};

export function SlideNavigator({
  outlinedSlides,
  currentSlideIndex,
  canvasWidth,
  languageCode,
  renderThumbnail,
  goToSlide,
  closeNavigator,
}: SlideNavigatorProperties) {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(currentSlideIndex);
  const thumbnailElements = useRef<HTMLButtonElement[]>([]);

  useLayoutEffect(() => {
    thumbnailElements.current[selectedSlideIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedSlideIndex]);

  const openSlide = (slideIndex: number) => {
    goToSlide(slideIndex);
    closeNavigator();
  };

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

  const columnCount = Math.max(minimumColumnCount, Math.floor((canvasWidth - 2 * navigatorPadding + thumbnailGap) / (minimumThumbnailWidth + thumbnailGap)));
  const thumbnailWidth = (canvasWidth - 2 * navigatorPadding - (columnCount - 1) * thumbnailGap) / columnCount;
  const navigatorStyle = {
    "--navigator-columns": columnCount,
    "--navigator-gap": `${thumbnailGap}px`,
    "--thumbnail-scale": thumbnailWidth / canvasWidth,
  } as CSSProperties;

  return (
    <div data-navigator role="dialog" aria-label={pickInterfaceTexts(languageCode).navigatorLabel} style={navigatorStyle}>
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
              {slideGroup.slideIndexes.map((slideIndex) => (
                <button
                  key={slideIndex}
                  type="button"
                  data-thumbnail
                  data-selected={slideIndex === selectedSlideIndex || undefined}
                  aria-current={slideIndex === currentSlideIndex || undefined}
                  ref={(thumbnailElement) => {
                    if (thumbnailElement !== null) thumbnailElements.current[slideIndex] = thumbnailElement;
                  }}
                  onClick={() => openSlide(slideIndex)}
                >
                  {renderThumbnail(slideIndex)}
                  <span data-thumbnail-number>{slideIndex + 1}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
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
