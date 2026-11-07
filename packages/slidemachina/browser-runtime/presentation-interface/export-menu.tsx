import { useEffect, useRef, useState, type ReactNode } from "react";
import { presentationExportEndpoint, presentationExportStatusEndpoint } from "../../shared-between-runtimes/engine-constants.ts";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { usePopoverClosing } from "./popover-closing.ts";
import { ToolbarButton } from "./presentation-toolbar.tsx";

type ExportVariant = "html" | "pdf" | "pptx";
type ExportPhase = "building" | "done" | "failed";
type ExportProgress = { variant: ExportVariant; phase: ExportPhase };
type ExportChoice = { variantName: ExportVariant; choiceTitle: string; choiceHint: string; ChoiceIcon: () => ReactNode };

const statusPollingIntervalMilliseconds = 500;
const progressResetDelayMilliseconds = 2500;
const progressGiveUpMilliseconds = 5 * 60 * 1000;
// The browser and the dev server live on one machine; the skew covers a leap between the two clocks.
const clockSkewMilliseconds = 2000;

// The dev-server export of the build command: one click asks the server for the built file, the button shows the build progress.
export function ExportMenu({ languageCode }: { languageCode: string }) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | undefined>(undefined);
  const menuAnchorReference = useRef<HTMLDivElement>(null);

  usePopoverClosing(isMenuOpen, menuAnchorReference, () => setMenuOpen(false));

  useEffect(() => {
    if (exportProgress === undefined || exportProgress.phase !== "building") return;
    const startedAt = Date.now();
    let pollTimer = 0;
    let sawRunningExport = false;
    const stopPolling = (finalPhase: ExportPhase) => {
      window.clearTimeout(pollTimer);
      setExportProgress((currentProgress) => (currentProgress === undefined ? currentProgress : { ...currentProgress, phase: finalPhase }));
      window.setTimeout(() => setExportProgress(undefined), progressResetDelayMilliseconds);
    };
    const pollExportStatus = async () => {
      try {
        const statusResponse = await fetch(presentationExportStatusEndpoint);
        if (statusResponse.ok) {
          const statusAnswer = (await statusResponse.json()) as { runningVariant: ExportVariant | null; finished: { variant: ExportVariant; succeeded: boolean; finishedAt: number } | null };
          if (statusAnswer.runningVariant === exportProgress.variant) sawRunningExport = true;
          const isFreshFinish = statusAnswer.finished !== null && statusAnswer.finished.finishedAt >= startedAt - clockSkewMilliseconds;
          if (statusAnswer.finished?.variant === exportProgress.variant && isFreshFinish && (sawRunningExport || !statusAnswer.runningVariant)) {
            return stopPolling(statusAnswer.finished.succeeded ? "done" : "failed");
          }
        }
      } catch {
        // A restarted server misses the build: keep polling until the give-up timer clears the button.
      }
      pollTimer = window.setTimeout(() => void pollExportStatus(), statusPollingIntervalMilliseconds);
    };
    void pollExportStatus();
    const giveUpTimer = window.setTimeout(() => setExportProgress(undefined), progressGiveUpMilliseconds);
    return () => {
      window.clearTimeout(pollTimer);
      window.clearTimeout(giveUpTimer);
    };
  }, [exportProgress]);

  const exportChoices: ExportChoice[] = [
    { variantName: "html", choiceTitle: interfaceTexts.exportHtmlTitle, choiceHint: interfaceTexts.exportHtmlHint, ChoiceIcon: BrowserFileIcon },
    { variantName: "pdf", choiceTitle: interfaceTexts.exportPdfTitle, choiceHint: interfaceTexts.exportPdfHint, ChoiceIcon: DocumentFileIcon },
    { variantName: "pptx", choiceTitle: interfaceTexts.exportPptxTitle, choiceHint: interfaceTexts.exportPptxHint, ChoiceIcon: SlidesStackIcon },
  ];
  const exportAddressFor = (chosenVariant: ExportVariant) =>
    `${presentationExportEndpoint}?${new URLSearchParams({ presentation: presentationSitePath(), variant: chosenVariant })}`;
  const trackExportProgress = (chosenVariant: ExportVariant) => {
    setMenuOpen(false);
    setExportProgress({ variant: chosenVariant, phase: "building" });
  };
  const exportButtonLabel =
    exportProgress === undefined
      ? interfaceTexts.exportButton
      : exportProgress.phase === "building"
        ? interfaceTexts.exportWorkingTitle
        : exportProgress.phase === "done"
          ? interfaceTexts.exportDoneTitle
          : interfaceTexts.exportFailedTitle;

  return (
    <div data-export-anchor ref={menuAnchorReference}>
      <ToolbarButton label={exportButtonLabel} isPressed={isMenuOpen} onPress={() => setMenuOpen((wasMenuOpen) => !wasMenuOpen)}>
        {exportProgress === undefined ? <DownloadIcon /> : <span data-export-spinner aria-hidden="true" />}
      </ToolbarButton>
      {isMenuOpen && (
        <div data-toolbar-menu role="menu" aria-label={interfaceTexts.exportButton}>
          {exportChoices.map(({ variantName, choiceTitle, choiceHint, ChoiceIcon }) => (
            <a key={variantName} role="menuitem" href={exportAddressFor(variantName)} download onClick={() => trackExportProgress(variantName)}>
              <ChoiceIcon />
              <span data-menu-option-text>
                <span data-menu-option-title>{choiceTitle}</span>
                <span data-menu-option-hint>{choiceHint}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// "talk" of "/talk/", "" at the site root: the server matches the folder of its own repository.
function presentationSitePath(): string {
  const pathSegments = location.pathname.split("/").filter(Boolean);
  return pathSegments[0] !== undefined && pathSegments[0] !== "index.html" ? `/${pathSegments[0]}` : "";
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.5v8M6.5 8l3.5 3.5L13.5 8M4.5 15.5h11" />
    </svg>
  );
}

function BrowserFileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 9.5h17M6.5 7h.01" />
    </svg>
  );
}

function DocumentFileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9.5 12.5h5M9.5 16h5" />
    </svg>
  );
}

function SlidesStackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4.5" width="13" height="9.5" rx="1.5" />
      <path d="M8 8.5h5M8 11h3M7 17.5h12.5A1.5 1.5 0 0 0 21 16V7.5" />
    </svg>
  );
}
