import { useEffect, useState } from "react";
import { backgroundLoadingPause, idleCallbackTimeout } from "./settings.ts";
import { useSlideEnvironment } from "./slide-environment.ts";

let backgroundLoadingRequest: Promise<void> | undefined;
let lastBackgroundTurn: Promise<void> | undefined;

// Safari has no requestIdleCallback; there the next task does.
function waitForIdleMoment(): Promise<void> {
  return new Promise((resolveIdleMoment) => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => resolveIdleMoment(), { timeout: idleCallbackTimeout });
    else setTimeout(resolveIdleMoment);
  });
}

function waitForBackgroundLoading(): Promise<void> {
  backgroundLoadingRequest ??= new Promise<void>((resolvePause) => {
    const startPause = () => setTimeout(resolvePause, backgroundLoadingPause);
    if (document.readyState === "complete") startPause();
    else window.addEventListener("load", startPause, { once: true });
  });
  return backgroundLoadingRequest;
}

// Heavy parts start one per idle moment, not all in one task: a key pressed meanwhile waits for one part, not for the whole talk.
function waitForBackgroundTurn(): Promise<void> {
  lastBackgroundTurn = (lastBackgroundTurn ?? waitForBackgroundLoading()).then(waitForIdleMoment);
  return lastBackgroundTurn;
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
    void waitForBackgroundTurn().then(() => isUnmounted || setWasAllowed(true));
    return () => {
      isUnmounted = true;
    };
  }, [wasAllowed]);
  return wasAllowed || isAllowedNow;
}
