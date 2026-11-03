import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";
import { openRemoteClientTransport, openRemoteHostingTransport, type RemoteChannelMessage, type RemoteTransportHandle } from "./remote-transport.ts";

export type RemoteConnectionStatus = "idle" | "connecting" | "connected" | "unanswered";
export type RemoteHostingOptions = {
  isHostingAvailable: boolean;
  hostingCode: string;
  currentPosition: PresentationPosition;
  isPaused: boolean;
  runSlideCommand: (slideCommand: SlideCommand) => void;
};
export type RemoteConnection = {
  connectionStatus: RemoteConnectionStatus;
  followedSlideIndex: number | undefined;
  followedStepIndex: number;
  isFollowedPaused: boolean;
  sendRemoteCommand: (slideCommand: SlideCommand) => void;
};

const remoteCodeLength = 6;
const remoteCodeDigits = "0123456789";
// The PeerJS cloud handshake (module load, broker, ICE) can take several seconds; BroadcastChannel answers instantly.
// A code nobody hosts is reported sooner than this by the PeerJS "peer-unavailable" error.
const connectionAnswerTimeoutMs = 8000;
const hostingCodeStorageKey = `slidemachina-remote-code:${location.pathname}`;

// A six-digit code reads well aloud and from a projector screen; only digits, so a phone keyboard is enough.
export function createRemoteCode(): string {
  let remoteCode = "";
  const randomValues = new Uint32Array(remoteCodeLength);
  crypto.getRandomValues(randomValues);
  for (const randomValue of randomValues) remoteCode += remoteCodeDigits[randomValue % remoteCodeDigits.length];
  return remoteCode;
}

// Session storage, not local: every tab hosts its own code, otherwise a phone on the same domain would host the
// presenter's code as well and execute the commands it sends.
export function readStoredHostingCode(): string {
  const storedCode = sessionStorage.getItem(hostingCodeStorageKey);
  return storedCode !== null && new RegExp(`^\\d{${remoteCodeLength}}$`).test(storedCode) ? storedCode : createRemoteCode();
}

export function storeHostingCode(hostingCode: string) {
  sessionStorage.setItem(hostingCodeStorageKey, hostingCode);
}

// Digits only, at most the code length: a partial code simply names an empty channel until it is complete.
export function normalizeTypedCode(typedText: string): string {
  return typedText.replace(/\D/g, "").slice(0, remoteCodeLength);
}

export function isCompleteRemoteCode(remoteCode: string): boolean {
  return remoteCode.length === remoteCodeLength;
}

// Every slides window hosts its own code and obeys remotes that know it; the code is the only key, like a short password.
export function useRemoteHosting({ isHostingAvailable, hostingCode, currentPosition, isPaused, runSlideCommand }: RemoteHostingOptions) {
  const hostingTransportReference = useRef<RemoteTransportHandle | undefined>(undefined);
  const connectedRemotesReference = useRef(0);
  const [connectedRemoteCount, setConnectedRemoteCount] = useState(0);
  const { slideIndex, stepIndex } = currentPosition;

  const receiveHostingMessage = useEffectEvent((channelMessage: RemoteChannelMessage) => {
    if (channelMessage.messageKind === "greeting") {
      connectedRemotesReference.current += 1;
      setConnectedRemoteCount(connectedRemotesReference.current);
      hostingTransportReference.current?.sendRemoteMessage({ messageKind: "welcome", slidePosition: { slideIndex, stepIndex }, isPaused });
    }
    if (channelMessage.messageKind === "farewell") {
      connectedRemotesReference.current = Math.max(0, connectedRemotesReference.current - 1);
      setConnectedRemoteCount(connectedRemotesReference.current);
    }
    if (channelMessage.messageKind === "command") runSlideCommand(channelMessage.slideCommand);
  });
  const postFollowedPosition = useEffectEvent(() => {
    if (connectedRemotesReference.current > 0)
      hostingTransportReference.current?.sendRemoteMessage({ messageKind: "position", slidePosition: { slideIndex, stepIndex }, isPaused });
  });

  useEffect(() => {
    if (!isHostingAvailable || !isCompleteRemoteCode(hostingCode)) return;
    const hostingTransport = openRemoteHostingTransport(hostingCode, receiveHostingMessage);
    hostingTransportReference.current = hostingTransport;
    return () => {
      hostingTransport.closeRemoteTransport();
      hostingTransportReference.current = undefined;
      connectedRemotesReference.current = 0;
      setConnectedRemoteCount(0);
    };
  }, [isHostingAvailable, hostingCode]);

  useEffect(() => {
    if (isHostingAvailable) postFollowedPosition();
  }, [isHostingAvailable, hostingCode, slideIndex, stepIndex, isPaused]);

  return { connectedRemoteCount };
}

// A phone or a second laptop joins the link of the target code and drives the window that hosts it.
// The target comes from the panel field: the hook reacts to it, there is no connect button.
export function useRemoteConnection(targetCode: string | undefined): RemoteConnection {
  const clientTransportReference = useRef<RemoteTransportHandle | undefined>(undefined);
  const [connectionReport, setConnectionReport] = useState<
    { targetCode: string; connectionStatus: Exclude<RemoteConnectionStatus, "idle">; followedPosition: { slidePosition: PresentationPosition; isPaused: boolean } | undefined } | undefined
  >(undefined);
  const isReportCurrent = connectionReport !== undefined && connectionReport.targetCode === targetCode;
  const connectionStatus: RemoteConnectionStatus = targetCode === undefined ? "idle" : isReportCurrent ? connectionReport.connectionStatus : "connecting";
  const followedPosition = isReportCurrent ? connectionReport.followedPosition : undefined;

  useEffect(() => {
    if (targetCode === undefined) return;
    let isConnectionLive = true;
    const reportUnanswered = () => {
      if (!isConnectionLive || clientTransportReference.current !== clientTransport) return;
      isConnectionLive = false;
      clearTimeout(answerTimeout);
      clientTransportReference.current = undefined;
      clientTransport.closeRemoteTransport();
      setConnectionReport({ targetCode, connectionStatus: "unanswered", followedPosition: undefined });
    };
    const clientTransport = openRemoteClientTransport(
      targetCode,
      (channelMessage: RemoteChannelMessage) => {
        if (channelMessage.messageKind !== "welcome" && channelMessage.messageKind !== "position") return;
        if (clientTransportReference.current !== clientTransport) return;
        clearTimeout(answerTimeout);
        setConnectionReport({
          targetCode,
          connectionStatus: "connected",
          followedPosition: { slidePosition: channelMessage.slidePosition, isPaused: channelMessage.isPaused },
        });
      },
      reportUnanswered,
    );
    clientTransportReference.current = clientTransport;
    clientTransport.sendRemoteMessage({ messageKind: "greeting" });
    const answerTimeout = setTimeout(reportUnanswered, connectionAnswerTimeoutMs);
    return () => {
      isConnectionLive = false;
      clearTimeout(answerTimeout);
      clientTransport.sendRemoteMessage({ messageKind: "farewell" });
      clientTransport.closeRemoteTransport();
      if (clientTransportReference.current === clientTransport) clientTransportReference.current = undefined;
    };
  }, [targetCode]);

  // A farewell keeps the host counter honest when the remote page closes without disconnecting.
  useEffect(() => {
    const sayFarewellOnLeaving = () => clientTransportReference.current?.sendRemoteMessage({ messageKind: "farewell" });
    window.addEventListener("pagehide", sayFarewellOnLeaving);
    return () => window.removeEventListener("pagehide", sayFarewellOnLeaving);
  }, []);

  const sendRemoteCommand = (slideCommand: SlideCommand) => {
    if (connectionStatus !== "connected") return;
    clientTransportReference.current?.sendRemoteMessage({ messageKind: "command", slideCommand });
  };

  return {
    connectionStatus,
    followedSlideIndex: followedPosition?.slidePosition.slideIndex,
    followedStepIndex: followedPosition?.slidePosition.stepIndex ?? 0,
    isFollowedPaused: followedPosition?.isPaused ?? false,
    sendRemoteCommand,
  };
}
