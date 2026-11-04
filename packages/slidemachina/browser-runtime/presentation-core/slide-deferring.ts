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

// The toolbar, print menu and remote panel are no use on the first frame; they mount right after it, while the rest of the slides still render in the background.
// The development server mounts the interface at once: its editor and meme keys answer from the very first moment, like they always did.
export function useInterfaceAfterFirstFrame(waitsForFirstFrame: boolean): boolean {
  const [rendersInterface, setRendersInterface] = useState(!waitsForFirstFrame);
  useEffect(() => {
    if (!waitsForFirstFrame) return;
    const renderInterface = () => startTransition(() => setRendersInterface(true));
    if (document.visibilityState === "hidden") {
      renderInterface();
      return;
    }
    let afterFrameTimer = 0;
    const firstFrame = requestAnimationFrame(() => {
      afterFrameTimer = window.setTimeout(renderInterface);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      clearTimeout(afterFrameTimer);
    };
  }, [waitsForFirstFrame]);
  return rendersInterface;
}
