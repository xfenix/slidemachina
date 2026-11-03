import { useRef, useState } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { usePopoverClosing } from "../presentation-interface/popover-closing.ts";
import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";
import { normalizeTypedCode, type RemoteConnection } from "./remote-channel.ts";

type RemotePanelProperties = {
  languageCode: string;
  panelCode: string;
  changePanelCode: (panelCode: string) => void;
  isRemoteMode: boolean;
  connectedRemoteCount: number;
  hostingReachability: "registering" | "online" | "offline";
  describeFollowedPosition: (slideIndex: number, stepIndex: number) => { slideText: string; stepText: string | undefined };
  disconnectFromHostingScreen: () => void;
} & RemoteConnection;

// One field is the whole panel: on the presenting screen it shows the code to type on the phone,
// on the phone the same field is typed over with that code and this window becomes the remote.
export function RemoteControlPanel({
  languageCode,
  panelCode,
  changePanelCode,
  isRemoteMode,
  connectedRemoteCount,
  hostingReachability,
  describeFollowedPosition,
  connectionStatus,
  followedSlideIndex,
  followedStepIndex,
  isFollowedPaused,
  disconnectFromHostingScreen,
  sendRemoteCommand,
}: RemotePanelProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const panelAnchorReference = useRef<HTMLDivElement>(null);
  usePopoverClosing(isPanelOpen, panelAnchorReference, () => setPanelOpen(false));
  const isRemoteConnected = connectionStatus === "connected";
  const followedPositionDescription = followedSlideIndex !== undefined ? describeFollowedPosition(followedSlideIndex, followedStepIndex) : undefined;

  return (
    <div data-remote-anchor ref={panelAnchorReference}>
      <ToolbarButton label={interfaceTexts.remoteButton} isPressed={isPanelOpen} onPress={() => setPanelOpen((wasPanelOpen) => !wasPanelOpen)}>
        <RemotePhoneIcon />
      </ToolbarButton>
      {isPanelOpen && (
        <fieldset data-remote-panel data-remote-mode={isRemoteMode ? "remote" : "hosting"} aria-label={interfaceTexts.remoteButton}>
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
          {!isRemoteMode && (
            <>
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
          {isRemoteMode && !isRemoteConnected && (
            <output data-remote-status={connectionStatus}>
              {connectionStatus === "connecting"
                ? interfaceTexts.remoteConnecting
                : connectionStatus === "unanswered"
                  ? interfaceTexts.remoteUnanswered
                  : connectionStatus === "no-broker"
                    ? interfaceTexts.remoteNoBroker
                    : interfaceTexts.remoteClientHint}
            </output>
          )}
          {isRemoteMode && isRemoteConnected && followedPositionDescription !== undefined && (
            <>
              <p data-remote-connection>
                <output data-remote-status="connected">{interfaceTexts.remoteConnectedMark}</output>
                <button type="button" data-remote-disconnect onClick={disconnectFromHostingScreen}>
                  {interfaceTexts.remoteDisconnectButton}
                </button>
              </p>
              <p data-remote-position>{followedPositionDescription.slideText}</p>
              {followedPositionDescription.stepText !== undefined && <p data-remote-step>{followedPositionDescription.stepText}</p>}
              {isFollowedPaused && <output data-remote-status="paused">{interfaceTexts.remotePausedMark}</output>}
              <div data-remote-controls>
                <button type="button" data-remote-move="backward" onClick={() => sendRemoteCommand("backward")}>
                  <ChevronIcon pointsLeft />
                  {interfaceTexts.remoteBackButton}
                </button>
                <button type="button" data-remote-move="forward" onClick={() => sendRemoteCommand("forward")}>
                  {interfaceTexts.remoteForwardButton}
                  <ChevronIcon />
                </button>
              </div>
              <button type="button" data-remote-pause onClick={() => sendRemoteCommand("pause")}>
                {isFollowedPaused ? interfaceTexts.remoteResumeButton : interfaceTexts.remotePauseButton}
              </button>
            </>
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

function ChevronIcon({ pointsLeft = false }: { pointsLeft?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={pointsLeft ? "M11.5 5.5L7 10l4.5 4.5" : "M8.5 5.5L13 10l-4.5 4.5"} />
    </svg>
  );
}
