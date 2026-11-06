import { useRef, useState, type ReactNode } from "react";
import { presentationExportEndpoint } from "../../shared-between-runtimes/engine-constants.ts";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { usePopoverClosing } from "./popover-closing.ts";
import { ToolbarButton } from "./presentation-toolbar.tsx";

type ExportVariant = "html" | "pdf" | "pptx";
type ExportChoice = { variantName: ExportVariant; choiceTitle: string; choiceHint: string; ChoiceIcon: () => ReactNode };

// The dev-server export of the build command: one click asks the server for the built file, the browser saves it.
export function ExportMenu({ languageCode }: { languageCode: string }) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuAnchorReference = useRef<HTMLDivElement>(null);

  usePopoverClosing(isMenuOpen, menuAnchorReference, () => setMenuOpen(false));

  const exportChoices: ExportChoice[] = [
    { variantName: "html", choiceTitle: interfaceTexts.exportHtmlTitle, choiceHint: interfaceTexts.exportHtmlHint, ChoiceIcon: BrowserFileIcon },
    { variantName: "pdf", choiceTitle: interfaceTexts.exportPdfTitle, choiceHint: interfaceTexts.exportPdfHint, ChoiceIcon: DocumentFileIcon },
    { variantName: "pptx", choiceTitle: interfaceTexts.exportPptxTitle, choiceHint: interfaceTexts.exportPptxHint, ChoiceIcon: SlidesStackIcon },
  ];
  const exportAddressFor = (chosenVariant: ExportVariant) =>
    `${presentationExportEndpoint}?${new URLSearchParams({ presentation: presentationSitePath(), variant: chosenVariant })}`;

  return (
    <div data-export-anchor ref={menuAnchorReference}>
      <ToolbarButton label={interfaceTexts.exportButton} isPressed={isMenuOpen} onPress={() => setMenuOpen((wasMenuOpen) => !wasMenuOpen)}>
        <DownloadIcon />
      </ToolbarButton>
      {isMenuOpen && (
        <div data-toolbar-menu role="menu" aria-label={interfaceTexts.exportButton}>
          {exportChoices.map(({ variantName, choiceTitle, choiceHint, ChoiceIcon }) => (
            <a key={variantName} role="menuitem" href={exportAddressFor(variantName)} download onClick={() => setMenuOpen(false)}>
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
