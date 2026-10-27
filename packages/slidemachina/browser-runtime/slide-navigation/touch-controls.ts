import { useEffect, useEffectEvent } from "react";
import { longestTapDistance, longestTapDuration, shortestSwipeDistance } from "../presentation-core/settings.ts";

// A tap on the left third goes back, anywhere else forward, as in a reader app; the right two thirds take the thumb of either hand.
const backwardTapShare = 1 / 3;
// Taps on controls, links, media and the editor keep their own job.
const tapIgnoringSelector = "a, button, input, textarea, select, video, iframe, [contenteditable], [data-toolbar], [data-navigator], [data-pause-screen]";

export function useTouchControls(goForward: () => void, goBackward: () => void, isEnabled: boolean) {
  const moveByTouch = useEffectEvent((movesForward: boolean) => {
    if (movesForward) goForward();
    else goBackward();
  });
  useEffect(() => {
    if (!isEnabled) return;
    let touchStart: Touch | undefined;
    let touchStartTime = 0;
    const rememberTouchStart = (touchEvent: TouchEvent) => {
      touchStart = touchEvent.touches.length === 1 ? touchEvent.changedTouches[0] : undefined;
      touchStartTime = touchEvent.timeStamp;
    };
    const detectGesture = (touchEvent: TouchEvent) => {
      const touchEnd = touchEvent.changedTouches[0];
      if (touchStart === undefined || touchEnd === undefined) return;
      const horizontalDistance = touchEnd.clientX - touchStart.clientX;
      const verticalDistance = touchEnd.clientY - touchStart.clientY;
      touchStart = undefined;
      if (Math.abs(horizontalDistance) > shortestSwipeDistance && Math.abs(horizontalDistance) > Math.abs(verticalDistance)) {
        moveByTouch(horizontalDistance < 0);
        return;
      }
      const isTap = Math.hypot(horizontalDistance, verticalDistance) < longestTapDistance && touchEvent.timeStamp - touchStartTime < longestTapDuration;
      const isIgnoredTarget = touchEvent.target instanceof Element && touchEvent.target.closest(tapIgnoringSelector) !== null;
      if (!isTap || isIgnoredTarget || document.documentElement.hasAttribute("data-source-editor")) return;
      moveByTouch(touchEnd.clientX > window.innerWidth * backwardTapShare);
    };
    window.addEventListener("touchstart", rememberTouchStart, { passive: true });
    window.addEventListener("touchend", detectGesture, { passive: true });
    return () => {
      window.removeEventListener("touchstart", rememberTouchStart);
      window.removeEventListener("touchend", detectGesture);
    };
  }, [isEnabled]);
}
