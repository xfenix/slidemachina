import { useRef, useState } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { usePopoverClosing } from "../presentation-interface/popover-closing.ts";
import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";
import { isCompleteRemoteCode, normalizeTypedCode, type RemoteConnection } from "./remote-channel.ts";

type RemotePanelProperties = {
  languageCode: string;
  hostingCode: string;
  changeHostingCode: (hostingCode: string) => void;
  connectedRemoteCount: number;
  describeFollowedPosition: (slideIndex: number, stepIndex: number) => { slideText: string; stepText: string | undefined };
} & RemoteConnection;

// The same panel on both sides: the presenting screen shows its code, a phone on the same domain enters it and gets a remote.
export function RemoteControlPanel({
  languageCode,
  hostingCode,
  changeHostingCode,
  connectedRemoteCount,
  describeFollowedPosition,
  connectionStatus,
  followedSlideIndex,
  followedStepIndex,
  isFollowedPaused,
  connectToHostingScreen,
  disconnectFromHostingScreen,
  sendRemoteCommand,
}: RemotePanelProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [typedRemoteCode, setTypedRemoteCode] = useState("");
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
        <fieldset data-remote-panel aria-label={interfaceTexts.remoteButton}>
          <section data-remote-section="hosting">
            <h2 data-remote-heading>{interfaceTexts.remoteHostingTitle}</h2>
            <p data-remote-hint>{interfaceTexts.remoteHostingHint}</p>
            <input
              data-remote-code
              value={hostingCode}
              onChange={(inputEvent) => changeHostingCode(normalizeTypedCode(inputEvent.target.value))}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-label={interfaceTexts.remoteCodeLabel}
            />
            <output data-remote-status>
              {connectedRemoteCount === 0 ? interfaceTexts.remoteWaitingForRemotes : interfaceTexts.remoteRemotesConnected(connectedRemoteCount)}
            </output>
          </section>
          <span data-remote-divider />
          {isRemoteConnected && followedPositionDescription !== undefined ? (
            <section data-remote-section="client">
              <h2 data-remote-heading>
                {interfaceTexts.remoteConnectedMark}
                <button type="button" data-remote-disconnect onClick={disconnectFromHostingScreen}>
                  {interfaceTexts.remoteDisconnectButton}
                </button>
              </h2>
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
            </section>
          ) : (
            <section data-remote-section="client">
              <h2 data-remote-heading>{interfaceTexts.remoteClientTitle}</h2>
              <p data-remote-hint>{interfaceTexts.remoteClientHint}</p>
              <input
                data-remote-code
                value={typedRemoteCode}
                onChange={(inputEvent) => setTypedRemoteCode(normalizeTypedCode(inputEvent.target.value))}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "Enter" && isCompleteRemoteCode(typedRemoteCode)) connectToHostingScreen(typedRemoteCode);
                }}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder="000000"
                aria-label={interfaceTexts.remoteCodeLabel}
              />
              {connectionStatus === "unanswered" && <output data-remote-status="unanswered">{interfaceTexts.remoteUnanswered}</output>}
              <button
                type="button"
                data-remote-connect
                disabled={!isCompleteRemoteCode(typedRemoteCode) || connectionStatus === "connecting"}
                onClick={() => connectToHostingScreen(typedRemoteCode)}
              >
                {connectionStatus === "connecting" ? interfaceTexts.remoteConnecting : interfaceTexts.remoteConnectButton}
              </button>
            </section>
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
