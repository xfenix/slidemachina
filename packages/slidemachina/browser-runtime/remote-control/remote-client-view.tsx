import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { normalizeTypedCode, type RemoteConnection } from "./remote-channel.ts";

export type RemoteClientViewProperties = {
  languageCode: string;
  panelCode: string;
  changePanelCode: (panelCode: string) => void;
  disconnectFromHostingScreen: () => void;
} & RemoteConnection;

// The phone side of the remote control: one field for the code, the state under it, the driving buttons once
// connected. The panel of the presenting screen renders this in place; the standalone remote page renders it whole.
export function RemoteClientView({
  languageCode,
  panelCode,
  changePanelCode,
  connectionStatus,
  followedCaption,
  isFollowedPaused,
  disconnectFromHostingScreen,
  sendRemoteCommand,
}: RemoteClientViewProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const isRemoteConnected = connectionStatus === "connected";

  return (
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
      {!isRemoteConnected && (
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
      {isRemoteConnected && followedCaption !== undefined && (
        <>
          <p data-remote-connection>
            <output data-remote-status="connected">{interfaceTexts.remoteConnectedMark}</output>
            <button type="button" data-remote-disconnect onClick={disconnectFromHostingScreen}>
              {interfaceTexts.remoteDisconnectButton}
            </button>
          </p>
          <p data-remote-position>{interfaceTexts.presenterSlideCounter(followedCaption.shownSlideNumber, followedCaption.shownSlideCount)}</p>
          {followedCaption.stepCount > 0 && (
            <p data-remote-step>{interfaceTexts.presenterStepCounter(followedCaption.stepIndex, followedCaption.stepCount)}</p>
          )}
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
    </>
  );
}

function ChevronIcon({ pointsLeft = false }: { pointsLeft?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={pointsLeft ? "M11.5 5.5L7 10l4.5 4.5" : "M8.5 5.5L13 10l-4.5 4.5"} />
    </svg>
  );
}
