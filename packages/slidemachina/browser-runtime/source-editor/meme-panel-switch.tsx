import { lazy, Suspense, useRef, useState, type ComponentType } from "react";
import { pickEditorTexts } from "./editor-texts.ts";
import { usePopoverClosing } from "../presentation-interface/popover-closing.ts";
import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";

type MemePanelProperties = { languageCode: string; closePanel: () => void };

// Folded at build time like the editor: a built presentation carries no meme panel.
const MemePanel = lazy<ComponentType<MemePanelProperties>>(() =>
  import.meta.env.DEV ? import("./meme-panel.tsx") : Promise.resolve({ default: () => null }),
);

// The meme panel opens above its button, as the print menu does; Escape and a press outside close it.
export function MemePanelSwitch({ languageCode }: { languageCode: string }) {
  const editorTexts = pickEditorTexts(languageCode);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const panelAnchorReference = useRef<HTMLDivElement>(null);

  usePopoverClosing(isPanelOpen, panelAnchorReference, () => setPanelOpen(false));

  return (
    <div data-meme-anchor ref={panelAnchorReference}>
      <ToolbarButton label={editorTexts.memeButton} isPressed={isPanelOpen} onPress={() => setPanelOpen((wasPanelOpen) => !wasPanelOpen)}>
        <MemeIcon />
      </ToolbarButton>
      {isPanelOpen && (
        <Suspense fallback={null}>
          <MemePanel languageCode={languageCode} closePanel={() => setPanelOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function MemeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" />
      <path d="M6.9 11.6c.8 1.2 1.85 1.8 3.1 1.8s2.3-.6 3.1-1.8M7.75 7.6v.8M12.25 7.6v.8" />
    </svg>
  );
}
