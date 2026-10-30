import { startTransition, useEffect, useState } from "react";

// The first frame draws the shown slide and its neighbours; the other slides follow right after it, long before anyone can jump.
// A hidden tab paints nothing, so there they come at once.
export function useEverySlideAfterFirstFrame(): boolean {
  const [rendersEverySlide, setRendersEverySlide] = useState(false);
  useEffect(() => {
    const renderEverySlide = () => startTransition(() => setRendersEverySlide(true));
    if (document.visibilityState === "hidden") {
      renderEverySlide();
      return;
    }
    let afterFrameTimer = 0;
    const firstFrame = requestAnimationFrame(() => {
      afterFrameTimer = window.setTimeout(renderEverySlide);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      clearTimeout(afterFrameTimer);
    };
  }, []);
  return rendersEverySlide;
}
