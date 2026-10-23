import { useEffect, useRef, useState } from "react";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { ToolbarButton } from "./presentation-toolbar.tsx";

type PrintMenuProperties = {
  languageCode: string;
  printsSteps: boolean;
  printPresentation: (withSteps: boolean) => void;
};

const printShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd+P" : "Ctrl+P";

// The chosen option is remembered: Cmd+P prints the same way next time.
export function PrintMenu({ languageCode, printsSteps, printPresentation }: PrintMenuProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuAnchorReference = useRef<HTMLDivElement>(null);

  // Captured before the slide keys: Escape closes the menu instead of opening the navigator.
  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.code !== "Escape") return;
      keyboardEvent.stopPropagation();
      setMenuOpen(false);
    };
    const closeOnOutsidePress = (pointerEvent: PointerEvent) => {
      if (!menuAnchorReference.current?.contains(pointerEvent.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("pointerdown", closeOnOutsidePress, true);
    return () => {
      window.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("pointerdown", closeOnOutsidePress, true);
    };
  }, [isMenuOpen]);

  const choosePrint = (withSteps: boolean) => {
    setMenuOpen(false);
    printPresentation(withSteps);
  };

  const printOptions = [
    { withSteps: false, title: interfaceTexts.printSlidesTitle, hint: interfaceTexts.printSlidesHint, icon: <SinglePageIcon /> },
    { withSteps: true, title: interfaceTexts.printStepsTitle, hint: interfaceTexts.printStepsHint, icon: <StackedPagesIcon /> },
  ];

  return (
    <div data-print-anchor ref={menuAnchorReference}>
      <ToolbarButton
        label={`${interfaceTexts.printButton} · ${printShortcut}`}
        isPressed={isMenuOpen}
        onPress={() => setMenuOpen((wasMenuOpen) => !wasMenuOpen)}
      >
        <PrinterIcon />
      </ToolbarButton>
      {isMenuOpen && (
        <div data-print-menu role="menu" aria-label={interfaceTexts.printButton}>
          {printOptions.map((printOption) => (
            <button
              key={String(printOption.withSteps)}
              type="button"
              role="menuitemradio"
              aria-checked={printOption.withSteps === printsSteps}
              onClick={() => choosePrint(printOption.withSteps)}
            >
              {printOption.icon}
              <span data-print-option-text>
                <span data-print-option-title>{printOption.title}</span>
                <span data-print-option-hint>{printOption.hint}</span>
              </span>
              <CheckIcon />
            </button>
          ))}
          <p data-print-menu-footnote>{interfaceTexts.printShortcutHint(printShortcut, printsSteps)}</p>
        </div>
      )}
    </div>
  );
}

function PrinterIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 7.5V3.5h8v4M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-3.5A1.5 1.5 0 0 1 4.5 7.5h11A1.5 1.5 0 0 1 17 9v3.5a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M6 11.5h8v5H6z" />
    </svg>
  );
}

function SinglePageIcon() {
  return (
    <svg data-print-option-icon viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
    </svg>
  );
}

function StackedPagesIcon() {
  return (
    <svg data-print-option-icon viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="9" width="15" height="10" rx="2.5" />
      <path d="M7 5.5h11.5A2.5 2.5 0 0 1 21 8v7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg data-print-option-check viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 10.5l3.2 3L15 6.5" />
    </svg>
  );
}
