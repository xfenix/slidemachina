import { useEffect, useEffectEvent } from "react";
import { shortestSwipeDistance } from "../presentation-core/settings.ts";

export function useSwipeControls(goForward: () => void, goBackward: () => void, isEnabled: boolean) {
  const finishSwipe = useEffectEvent((horizontalDistance: number) => {
    if (horizontalDistance < 0) goForward();
    else goBackward();
  });
  useEffect(() => {
    if (!isEnabled) return;
    let touchStart: Touch | undefined;
    const rememberTouchStart = (touchEvent: TouchEvent) => {
      touchStart = touchEvent.changedTouches[0];
    };
    const detectSwipe = (touchEvent: TouchEvent) => {
      const touchEnd = touchEvent.changedTouches[0];
      if (touchStart === undefined || touchEnd === undefined) return;
      const horizontalDistance = touchEnd.clientX - touchStart.clientX;
      const verticalDistance = touchEnd.clientY - touchStart.clientY;
      if (Math.abs(horizontalDistance) > shortestSwipeDistance && Math.abs(horizontalDistance) > Math.abs(verticalDistance)) {
        finishSwipe(horizontalDistance);
      }
    };
    window.addEventListener("touchstart", rememberTouchStart, { passive: true });
    window.addEventListener("touchend", detectSwipe, { passive: true });
    return () => {
      window.removeEventListener("touchstart", rememberTouchStart);
      window.removeEventListener("touchend", detectSwipe);
    };
  }, [isEnabled]);
}
