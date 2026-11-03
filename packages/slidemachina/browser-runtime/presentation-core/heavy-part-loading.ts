import { useEffect, useState } from "react";
import { useSlideEnvironment } from "./slide-environment.ts";
import { waitForBackgroundTurn } from "./idle-background-turns.ts";

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
