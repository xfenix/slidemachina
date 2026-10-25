import { createContext, use, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { pickInterfaceTexts } from "./interface-texts.ts";
import { useToolbarIdle } from "./toolbar-idle.ts";

const hiddenToolbarStorageKey = "slidemachina-toolbar-hidden";

// The address of the list page, when the presentation belongs to a repository; mountPresentation sets it.
export const PresentationListAddressContext = createContext<string | undefined>(undefined);

type PresentationToolbarProperties = {
  languageCode: string;
  isHidden: boolean;
  toggleHidden: () => void;
  isNavigatorOpen: boolean;
  toggleNavigator: () => void;
  toggleFullscreen: () => void;
  children?: ReactNode;
};
type ToolbarButtonProperties = {
  label: string;
  isPressed?: boolean;
  onPress: () => void;
  children: ReactNode;
};

export function useToolbarHiding() {
  const [isToolbarHidden, setToolbarHidden] = useState(() => localStorage.getItem(hiddenToolbarStorageKey) === "true");
  useEffect(() => {
    localStorage.setItem(hiddenToolbarStorageKey, String(isToolbarHidden));
  }, [isToolbarHidden]);
  return {
    isToolbarHidden,
    toggleToolbar: () => setToolbarHidden((wasToolbarHidden) => !wasToolbarHidden),
  };
}

// A hidden toolbar leaves an arrow in its place; the children (Agentation) unmount with it.
export function PresentationToolbar({
  languageCode,
  isHidden,
  toggleHidden,
  isNavigatorOpen,
  toggleNavigator,
  toggleFullscreen,
  children,
}: PresentationToolbarProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const toolbarReference = useRef<HTMLDivElement>(null);
  const isToolbarIdle = useToolbarIdle(toolbarReference);
  const presentationListAddress = use(PresentationListAddressContext);
  if (isHidden) {
    return (
      <div ref={toolbarReference} data-toolbar data-collapsed data-idle={isToolbarIdle || undefined} role="toolbar" aria-label={interfaceTexts.toolbarLabel}>
        <ToolbarButton label={interfaceTexts.showToolbarButton} onPress={toggleHidden}>
          <ChevronIcon pointsUp />
        </ToolbarButton>
      </div>
    );
  }
  return (
    <div ref={toolbarReference} data-toolbar data-idle={isToolbarIdle || undefined} role="toolbar" aria-label={interfaceTexts.toolbarLabel}>
      {presentationListAddress !== undefined && (
        <>
          <a data-list-return href={presentationListAddress} aria-label={interfaceTexts.backToListButton} title={interfaceTexts.backToListButton}>
            <ListReturnIcon />
          </a>
          <span data-toolbar-divider />
        </>
      )}
      <ToolbarButton label={interfaceTexts.navigatorButton} isPressed={isNavigatorOpen} onPress={toggleNavigator}>
        <NavigatorIcon />
      </ToolbarButton>
      <ToolbarButton label={interfaceTexts.fullscreenButton} onPress={toggleFullscreen}>
        <FullscreenIcon />
      </ToolbarButton>
      {children}
      <ToolbarButton label={interfaceTexts.hideToolbarButton} onPress={toggleHidden}>
        <ChevronIcon pointsUp={false} />
      </ToolbarButton>
    </div>
  );
}

// Mouse clicks do not focus the button, otherwise the next Space would press it again instead of moving forward.
export function ToolbarButton({ label, isPressed, onPress, children }: ToolbarButtonProperties) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isPressed}
      onPointerDown={(pointerEvent: PointerEvent) => pointerEvent.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function NavigatorIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="5.5" height="5.5" rx="1.5" />
      <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.5" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.5" />
    </svg>
  );
}

function ListReturnIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 4.5L3.5 9 8 13.5M3.5 9h8a5 5 0 0 1 0 10h-2" />
    </svg>
  );
}

function ChevronIcon({ pointsUp }: { pointsUp: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={pointsUp ? "M5.5 12l4.5-4.5 4.5 4.5" : "M5.5 8l4.5 4.5 4.5-4.5"} />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4" />
    </svg>
  );
}
