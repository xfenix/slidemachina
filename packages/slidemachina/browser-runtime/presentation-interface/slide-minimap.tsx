import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { ToolbarButton } from "./presentation-toolbar.tsx";

const minimapWidth = 168;
const minimapPadding = 12;
const shownMinimapStorageKey = "slidemachina-minimap-shown";
// Thumbnails this far outside the strip are drawn ahead, so scrolling does not show empty frames.
const thumbnailPreloadMargin = "600px 0px";

type SlideMinimapProperties = {
  slideCount: number;
  currentSlideIndex: number;
  formatWidth: number;
  languageCode: string;
  renderThumbnail: (slideIndex: number) => ReactNode;
  goToSlide: (slideIndex: number) => void;
};
type MinimapThumbnailProperties = {
  slideIndex: number;
  isCurrent: boolean;
  renderThumbnail: (slideIndex: number) => ReactNode;
  goToSlide: (slideIndex: number) => void;
};

// The minimap of slidemachina dev: a strip of every slide over the right edge, like the minimap of a code editor.
// Off by default, it covers part of the slide; the toolbar button or M turns it on, full screen hides it.
export function useMinimapShowing(isAvailable: boolean) {
  const [isMinimapWanted, setMinimapWanted] = useState(() => localStorage.getItem(shownMinimapStorageKey) === "true");
  const [isFullscreen, setFullscreen] = useState(() => document.fullscreenElement !== null);
  useEffect(() => {
    localStorage.setItem(shownMinimapStorageKey, String(isMinimapWanted));
  }, [isMinimapWanted]);
  useEffect(() => {
    const followFullscreen = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", followFullscreen);
    return () => document.removeEventListener("fullscreenchange", followFullscreen);
  }, []);
  return {
    isMinimapShown: isAvailable && isMinimapWanted && !isFullscreen,
    toggleMinimap: () => setMinimapWanted((wasMinimapWanted) => !wasMinimapWanted),
  };
}

export function MinimapSwitch({ languageCode, isMinimapShown, toggleMinimap }: { languageCode: string; isMinimapShown: boolean; toggleMinimap: () => void }) {
  return (
    <ToolbarButton label={pickInterfaceTexts(languageCode).minimapButton} isPressed={isMinimapShown} onPress={toggleMinimap}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3.5" width="14" height="13" rx="2" />
        <path d="M12.5 3.5v13M14.5 6.5v1.5M14.5 10v1.5" />
      </svg>
    </ToolbarButton>
  );
}

export function SlideMinimap({ slideCount, currentSlideIndex, formatWidth, languageCode, renderThumbnail, goToSlide }: SlideMinimapProperties) {
  const minimapStyle = {
    "--minimap-thumbnail-scale": (minimapWidth - 2 * minimapPadding) / formatWidth,
    width: minimapWidth,
    padding: minimapPadding,
  } as CSSProperties;
  return (
    <nav data-minimap aria-label={pickInterfaceTexts(languageCode).minimapLabel} style={minimapStyle}>
      {Array.from({ length: slideCount }, (_, slideIndex) => (
        <MinimapThumbnail
          key={slideIndex}
          slideIndex={slideIndex}
          isCurrent={slideIndex === currentSlideIndex}
          renderThumbnail={renderThumbnail}
          goToSlide={goToSlide}
        />
      ))}
    </nav>
  );
}

// A thumbnail draws its slide copy only near the visible part of the strip: a deck of a hundred slides stays light.
function MinimapThumbnail({ slideIndex, isCurrent, renderThumbnail, goToSlide }: MinimapThumbnailProperties) {
  const thumbnailReference = useRef<HTMLButtonElement>(null);
  const [isNearView, setNearView] = useState(false);
  useEffect(() => {
    const thumbnailElement = thumbnailReference.current;
    if (thumbnailElement === null) return;
    const visibilityObserver = new IntersectionObserver(
      ([observedEntry]) => {
        if (observedEntry?.isIntersecting === true) setNearView(true);
      },
      { root: thumbnailElement.parentElement, rootMargin: thumbnailPreloadMargin },
    );
    visibilityObserver.observe(thumbnailElement);
    return () => visibilityObserver.disconnect();
  }, []);
  useLayoutEffect(() => {
    const thumbnailElement = thumbnailReference.current;
    const minimapElement = thumbnailElement?.parentElement;
    if (!isCurrent || thumbnailElement == null || minimapElement == null) return;
    // The strip scrolls itself: scrollIntoView would also shift the fixed page around it.
    minimapElement.scrollTo({ top: thumbnailElement.offsetTop - (minimapElement.clientHeight - thumbnailElement.offsetHeight) / 2, behavior: "smooth" });
  }, [isCurrent]);
  return (
    <button
      ref={thumbnailReference}
      type="button"
      data-minimap-thumbnail
      aria-current={isCurrent || undefined}
      onPointerDown={(pointerEvent) => pointerEvent.preventDefault()}
      onClick={() => goToSlide(slideIndex)}
    >
      {isNearView && renderThumbnail(slideIndex)}
      <span data-thumbnail-number>{slideIndex + 1}</span>
    </button>
  );
}
