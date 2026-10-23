import { useWindowKeydown } from "./keyboard-listener.ts";

type KeyboardActions = {
  goForward: () => void;
  goBackward: () => void;
  goToFirstSlide: () => void;
  goToLastSlide: () => void;
  openNavigator: () => void;
  toggleBlackout: () => void;
  toggleFullscreen: () => void;
  toggleToolbar: () => void;
  typeDigit: (typedDigit: string) => void;
  // Missing while no digits are typed: Enter then keeps its own job, such as opening a focused link.
  confirmTypedNumber?: () => void;
};

export function useKeyboardControls(keyboardActions: KeyboardActions, isEnabled: boolean) {
  useWindowKeydown((keyboardEvent) => {
    const keyboardAction = pickKeyboardAction(keyboardEvent, keyboardActions);
    keyboardAction?.();
    return keyboardAction !== undefined;
  }, isEnabled);
}

// Letters are matched by physical key, so B, O, F and H work in any keyboard layout.
function pickKeyboardAction(keyboardEvent: KeyboardEvent, keyboardActions: KeyboardActions) {
  if (/^[0-9]$/.test(keyboardEvent.key)) return () => keyboardActions.typeDigit(keyboardEvent.key);
  switch (keyboardEvent.code) {
    case "KeyB":
    case "Period":
      return keyboardActions.toggleBlackout;
    case "KeyO":
    case "Escape":
      return keyboardActions.openNavigator;
    case "KeyF":
      return keyboardActions.toggleFullscreen;
    case "KeyH":
      return keyboardActions.toggleToolbar;
  }
  switch (keyboardEvent.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
      return keyboardActions.goForward;
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return keyboardActions.goBackward;
    case " ":
      return keyboardEvent.shiftKey ? keyboardActions.goBackward : keyboardActions.goForward;
    case "Home":
      return keyboardActions.goToFirstSlide;
    case "End":
      return keyboardActions.goToLastSlide;
    case "Enter":
      return keyboardActions.confirmTypedNumber;
  }
  return undefined;
}
