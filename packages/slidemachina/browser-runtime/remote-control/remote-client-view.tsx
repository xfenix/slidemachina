import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";
import { normalizeTypedCode, type RemoteConnection } from "./remote-channel.ts";
import { RemoteSlideJump } from "./remote-slide-jump.tsx";

export type RemoteClientViewProperties = {
  languageCode: string;
  panelCode: string;
  changePanelCode: (panelCode: string) => void;
  disconnectFromHostingScreen: () => void;
  // A tap on a driving button: a vibration on the phone, nothing on the desktop panel.
  givePressFeedback?: () => void;
} & RemoteConnection;

// The phone side of the remote control: one field for the code, the state under it, the driving buttons once
// connected. The panel of the presenting screen renders this in place; the standalone remote page renders it whole.
// The step line and the paused mark keep their places in every state: nothing jumps between slides.
export function RemoteClientView({
  languageCode,
  panelCode,
  changePanelCode,
  connectionStatus,
  followedCaption,
  isFollowedPaused,
  disconnectFromHostingScreen,
  givePressFeedback,
  sendRemoteCommand,
}: RemoteClientViewProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const isRemoteConnected = connectionStatus === "connected";
  const pressAndSend = (slideCommand: SlideCommand) => {
    givePressFeedback?.();
    sendRemoteCommand(slideCommand);
  };

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
                : connectionStatus === "lost"
                  ? interfaceTexts.remoteLostConnection
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
          {/* The black screen switch and the slide number share one row: the switch stays small, away from the
              thumb row, and the number is typed over to jump to any slide. */}
          <div data-remote-pause-row>
            <button type="button" data-remote-pause onClick={() => pressAndSend("pause")}>
              <ScreenOffIcon />
              {isFollowedPaused ? interfaceTexts.remoteBackToSlideButton : interfaceTexts.remoteBlackScreenButton}
            </button>
            <RemoteSlideJump
              languageCode={languageCode}
              shownSlideNumber={followedCaption.shownSlideNumber}
              shownSlideCount={followedCaption.shownSlideCount}
              jumpToSlide={(shownSlideNumber) => pressAndSend(shownSlideNumber)}
            />
          </div>
          <p data-remote-step>
            {followedCaption.stepCount > 0 ? interfaceTexts.presenterStepCounter(followedCaption.stepIndex, followedCaption.stepCount) : " "}
          </p>
          <output data-remote-status="paused" data-remote-paused-hidden={!isFollowedPaused || undefined}>
            {interfaceTexts.remotePausedMark}
          </output>
          <div data-remote-controls>
            <button type="button" data-remote-move="backward" onClick={() => pressAndSend("backward")}>
              <ChevronIcon pointsLeft />
              {interfaceTexts.remoteBackButton}
            </button>
            <button type="button" data-remote-move="forward" onClick={() => pressAndSend("forward")}>
              {interfaceTexts.remoteForwardButton}
              <ChevronIcon />
            </button>
          </div>
        </>
      )}
    </>
  );
}

function ScreenOffIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="9.5" rx="1.5" />
      <path d="M6 7.5l8 5M8.5 14h3" />
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
