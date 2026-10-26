import { useRef, useState } from "react";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { usePopoverClosing } from "./popover-closing.ts";
import { ToolbarButton } from "./presentation-toolbar.tsx";

export const printShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd+P" : "Ctrl+P";

type PrintMenuProperties = {
  languageCode: string;
  printsSteps: boolean;
  choosePrintedSteps: (withSteps: boolean) => void;
  printPresentation: () => void;
  openPrintView: () => void;
};

// The steps switch is remembered: Cmd+P and the print view use it next time too.
export function PrintMenu({ languageCode, printsSteps, choosePrintedSteps, printPresentation, openPrintView }: PrintMenuProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuAnchorReference = useRef<HTMLDivElement>(null);

  usePopoverClosing(isMenuOpen, menuAnchorReference, () => setMenuOpen(false));

  const runAndClose = (menuAction: () => void) => () => {
    setMenuOpen(false);
    menuAction();
  };

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
          <button type="button" role="menuitem" onClick={runAndClose(printPresentation)}>
            <PrinterIcon />
            <span data-print-option-title>{interfaceTexts.printNowTitle}</span>
            <kbd data-print-option-shortcut>{printShortcut}</kbd>
          </button>
          <button type="button" role="menuitem" onClick={runAndClose(openPrintView)}>
            <PageSheetIcon />
            <span data-print-option-text>
              <span data-print-option-title>{interfaceTexts.printViewTitle}</span>
              <span data-print-option-hint>{interfaceTexts.printViewHint}</span>
            </span>
          </button>
          <span data-print-menu-divider />
          <button type="button" role="menuitemcheckbox" aria-checked={printsSteps} onClick={() => choosePrintedSteps(!printsSteps)}>
            <StackedPagesIcon />
            <span data-print-option-text>
              <span data-print-option-title>{interfaceTexts.printStepsTitle}</span>
              <span data-print-option-hint>{interfaceTexts.printStepsHint}</span>
            </span>
            <span data-print-switch />
          </button>
        </div>
      )}
    </div>
  );
}

export function PrinterIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 7.5V3.5h8v4M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-3.5A1.5 1.5 0 0 1 4.5 7.5h11A1.5 1.5 0 0 1 17 9v3.5a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M6 11.5h8v5H6z" />
    </svg>
  );
}

function PageSheetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </svg>
  );
}

function StackedPagesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="9" width="15" height="10" rx="2.5" />
      <path d="M7 5.5h11.5A2.5 2.5 0 0 1 21 8v7" />
    </svg>
  );
}
