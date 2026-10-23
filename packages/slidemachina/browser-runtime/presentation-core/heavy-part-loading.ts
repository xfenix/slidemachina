import { useEffect, useState } from "react";
import { useSlideEnvironment } from "./slide-environment.ts";

// Long enough for the first screen to settle; then Cmd+P still finds every diagram laid out and every scene loaded.
const backgroundLoadingPause = 5000;
let backgroundLoadingRequest: Promise<void> | undefined;

function waitForBackgroundLoading(): Promise<void> {
  backgroundLoadingRequest ??= new Promise((resolveBackgroundLoading) => {
    // Safari has no requestIdleCallback; there the pause alone does.
    const startAfterPause = () =>
      setTimeout(() => {
        if ("requestIdleCallback" in window) requestIdleCallback(() => resolveBackgroundLoading(), { timeout: 2000 });
        else resolveBackgroundLoading();
      }, backgroundLoadingPause);
    if (document.readyState === "complete") startAfterPause();
    else window.addEventListener("load", startAfterPause, { once: true });
  });
  return backgroundLoadingRequest;
}

// ELK and three.js start for a slide two slides away or closer, a thumbnail, a printed page, or once the page is idle after the first screen.
export function useHeavyPartsAllowed(): boolean {
  const { isSlideNearby, isSlideCopy } = useSlideEnvironment();
  const [wasAllowed, setWasAllowed] = useState(false);
  const isAllowedNow = isSlideNearby || isSlideCopy;
  if (isAllowedNow && !wasAllowed) setWasAllowed(true);
  useEffect(() => {
    if (wasAllowed) return;
    let isUnmounted = false;
    void waitForBackgroundLoading().then(() => isUnmounted || setWasAllowed(true));
    return () => {
      isUnmounted = true;
    };
  }, [wasAllowed]);
  return wasAllowed || isAllowedNow;
}
