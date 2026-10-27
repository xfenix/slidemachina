import { flushSync } from "react-dom";

const navigatorLayerName = "navigator-slide";
const liveSlideSelector = "[data-canvas] > [data-slide][data-current]";

// Opening, the shown slide shrinks into its thumbnail while the grid fades in; closing, the chosen thumbnail grows into the slide.
// Two snapshots and one moving layer: the browser animates them on the compositor, the slides themselves are not re-laid out.
export function runNavigatorTransition(updateNavigator: () => void, shownSlideIndex: number) {
  const thumbnailSelector = `[data-thumbnail-index="${shownSlideIndex}"]`;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("startViewTransition" in document) || prefersReducedMotion) {
    updateNavigator();
    return;
  }
  const isOpening = document.querySelector("[data-navigator]") === null;
  const outgoingFrame = document.querySelector<HTMLElement>(isOpening ? liveSlideSelector : thumbnailSelector);
  const documentElement = document.documentElement;
  documentElement.dataset.slideTransition = "navigator";
  documentElement.dataset.slideDirection = isOpening ? "forward" : "backward";
  documentElement.style.setProperty("--transition-speed", "1");
  outgoingFrame?.style.setProperty("view-transition-name", navigatorLayerName);
  let incomingFrame: HTMLElement | null = null;
  const viewTransition = document.startViewTransition(() => {
    flushSync(updateNavigator);
    outgoingFrame?.style.removeProperty("view-transition-name");
    incomingFrame = document.querySelector<HTMLElement>(isOpening ? thumbnailSelector : liveSlideSelector);
    if (outgoingFrame !== null) incomingFrame?.style.setProperty("view-transition-name", navigatorLayerName);
  });
  void viewTransition.finished.finally(() => {
    outgoingFrame?.style.removeProperty("view-transition-name");
    incomingFrame?.style.removeProperty("view-transition-name");
  });
}
