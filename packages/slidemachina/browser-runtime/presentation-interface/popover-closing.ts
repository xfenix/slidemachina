import { useEffect, type RefObject } from "react";

// Captured before the slide keys: Escape closes the menu instead of opening the navigator. A press outside the anchor closes it too.
export function usePopoverClosing(isPopoverOpen: boolean, anchorReference: RefObject<HTMLElement | null>, closePopover: () => void) {
  useEffect(() => {
    if (!isPopoverOpen) return;
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.code !== "Escape") return;
      keyboardEvent.stopPropagation();
      closePopover();
    };
    const closeOnOutsidePress = (pointerEvent: PointerEvent) => {
      if (!anchorReference.current?.contains(pointerEvent.target as Node)) closePopover();
    };
    window.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("pointerdown", closeOnOutsidePress, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("pointerdown", closeOnOutsidePress, true);
    };
  }, [isPopoverOpen, anchorReference, closePopover]);
}
