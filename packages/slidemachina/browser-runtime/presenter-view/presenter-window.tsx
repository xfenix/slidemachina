import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";

// "?presenter" opens the same page as the presenter view: one bundle, so it works from a single file on disk too.
const presenterWindowParameter = "presenter";
const presenterWindowWidth = 1280;
const presenterWindowHeight = 800;

export const isPresenterWindow = new URLSearchParams(location.search).has(presenterWindowParameter);

// A popup, not a tab: it is dragged to the laptop screen while the slides stay on the projector. A second press focuses the same window.
export function openPresenterWindow() {
  const presenterAddress = new URL(location.href);
  presenterAddress.search = `?${presenterWindowParameter}`;
  window.open(presenterAddress.href, `slidemachina-presenter:${location.pathname}`, `popup,width=${presenterWindowWidth},height=${presenterWindowHeight}`);
}

export function PresenterWindowSwitch({ languageCode }: { languageCode: string }) {
  return (
    <ToolbarButton label={pickInterfaceTexts(languageCode).presenterButton} onPress={openPresenterWindow}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="3.5" width="15" height="10.5" rx="1.5" />
        <path d="M6 7.25h8M6 10.25h5M10 14v2.5M6.5 16.5h7" />
      </svg>
    </ToolbarButton>
  );
}
