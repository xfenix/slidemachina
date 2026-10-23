import { useEffect, useEffectEvent } from "react";

// The handler returns true when it used the key; then the browser default is cancelled.
export function useWindowKeydown(handleKeydown: (keyboardEvent: KeyboardEvent) => boolean, isEnabled: boolean) {
  const handleLatestKeydown = useEffectEvent((keyboardEvent: KeyboardEvent) => {
    const usesShortcutModifier = keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey;
    if (usesShortcutModifier || isTypingTarget(keyboardEvent.target)) return;
    if (handleKeydown(keyboardEvent)) keyboardEvent.preventDefault();
  });
  useEffect(() => {
    if (!isEnabled) return;
    const forwardKeydown = (keyboardEvent: KeyboardEvent) => handleLatestKeydown(keyboardEvent);
    window.addEventListener("keydown", forwardKeydown);
    return () => window.removeEventListener("keydown", forwardKeydown);
  }, [isEnabled]);
}

function isTypingTarget(eventTarget: EventTarget | null): boolean {
  return eventTarget instanceof HTMLElement && eventTarget.matches("input, textarea, select, [contenteditable]");
}
