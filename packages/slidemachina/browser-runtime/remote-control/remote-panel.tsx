import { useMemo, useRef, useState } from "react";
import { drawQRCode } from "../content-blocks/qr-block/qr-module-shapes.ts";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { usePopoverClosing } from "../presentation-interface/popover-closing.ts";
import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";
import { normalizeTypedCode, type RemoteConnection } from "./remote-channel.ts";
import { RemoteClientView } from "./remote-client-view.tsx";

type RemotePanelProperties = {
  languageCode: string;
  panelCode: string;
  changePanelCode: (panelCode: string) => void;
  isRemoteMode: boolean;
  hostingLink: string;
  connectedRemoteCount: number;
  hostingReachability: "registering" | "online" | "offline";
  disconnectFromHostingScreen: () => void;
} & RemoteConnection;

// One field is the whole panel: on the presenting screen it shows the code and the QR code to join from a phone,
// on the phone the same field is typed over with that code and this window becomes the remote.
export function RemoteControlPanel({
  languageCode,
  panelCode,
  changePanelCode,
  isRemoteMode,
  hostingLink,
  connectedRemoteCount,
  hostingReachability,
  disconnectFromHostingScreen,
  ...remoteConnection
}: RemotePanelProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const panelAnchorReference = useRef<HTMLDivElement>(null);
  usePopoverClosing(isPanelOpen, panelAnchorReference, () => setPanelOpen(false));
  const joinQrDrawing = useMemo(() => drawQRCode(hostingLink, "M", false), [hostingLink]);

  return (
    <div data-remote-anchor ref={panelAnchorReference}>
      <ToolbarButton label={interfaceTexts.remoteButton} isPressed={isPanelOpen} onPress={() => setPanelOpen((wasPanelOpen) => !wasPanelOpen)}>
        <RemotePhoneIcon />
      </ToolbarButton>
      {isPanelOpen && (
        <fieldset data-remote-panel data-remote-mode={isRemoteMode ? "remote" : "hosting"} aria-label={interfaceTexts.remoteButton}>
          {!isRemoteMode && (
            <>
              <input
                data-remote-code
                value={panelCode}
                onChange={(inputEvent) => changePanelCode(normalizeTypedCode(inputEvent.target.value))}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder="000000"
                aria-label={interfaceTexts.remoteCodeLabel}
              />
              <div data-remote-qr>
                <svg viewBox={`0 0 ${joinQrDrawing.moduleCount} ${joinQrDrawing.moduleCount}`}>
                  <title>{hostingLink}</title>
                  <path fill="currentColor" fillRule="evenodd" d={joinQrDrawing.modulesPath} />
                </svg>
              </div>
              <p data-remote-link>{hostingLink}</p>
              <p data-remote-hint>{interfaceTexts.remoteHostingHint}</p>
              <output data-remote-status={hostingReachability}>
                {hostingReachability === "offline"
                  ? interfaceTexts.remoteHostingOffline
                  : connectedRemoteCount === 0
                    ? interfaceTexts.remoteWaitingForRemotes
                    : interfaceTexts.remoteRemotesConnected(connectedRemoteCount)}
              </output>
            </>
          )}
          {isRemoteMode && (
            <RemoteClientView
              languageCode={languageCode}
              panelCode={panelCode}
              changePanelCode={changePanelCode}
              disconnectFromHostingScreen={disconnectFromHostingScreen}
              {...remoteConnection}
            />
          )}
        </fieldset>
      )}
    </div>
  );
}

function RemotePhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="6.5" y="2.5" width="7" height="15" rx="1.5" />
      <path d="M9 4.5h2M9.5 15.5h1" />
    </svg>
  );
}
