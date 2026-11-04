import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";
import { openRemoteClientTransport, openRemoteHostingTransport, type RemoteChannelMessage, type RemoteSlideCaption, type RemoteTransportHandle } from "./remote-transport.ts";

export type RemoteConnectionStatus = "idle" | "connecting" | "connected" | "unanswered" | "no-broker" | "lost";
export type RemoteHostingReachability = "registering" | "online" | "offline";
export type RemoteHostingOptions = {
  isHostingAvailable: boolean;
  hostingCode: string;
  hostingEpoch: number;
  currentPosition: PresentationPosition;
  isPaused: boolean;
  presentationTitle: string | undefined;
  describeSlideCaption: (slideIndex: number, stepIndex: number) => RemoteSlideCaption;
  runSlideCommand: (slideCommand: SlideCommand) => void;
};
export type RemoteConnection = {
  connectionStatus: RemoteConnectionStatus;
  followedCaption: RemoteSlideCaption | undefined;
  followedPresentationTitle: string | undefined;
  isFollowedPaused: boolean;
  sendRemoteCommand: (slideCommand: SlideCommand) => void;
};

const remoteCodeLength = 6;
const remoteCodeDigits = "0123456789";
// The WebRTC handshake through the broker takes a couple of seconds; a code nobody hosts is reported sooner by the broker itself.
const connectionAnswerTimeoutMs = 8000;
// After a kick the broker needs a moment to forget the old peer before the same code registers again.
const hostingReopenDelayMs = 600;
const hostingCodeStorageKey = `slidemachina-remote-code:${location.pathname}`;

// A six-digit code reads well aloud and from a projector screen; only digits, so a phone keyboard is enough.
export function createRemoteCode(): string {
  let remoteCode = "";
  const randomValues = new Uint32Array(remoteCodeLength);
  crypto.getRandomValues(randomValues);
  for (const randomValue of randomValues) remoteCode += remoteCodeDigits[randomValue % remoteCodeDigits.length];
  return remoteCode;
}

// Session storage, not local: every tab hosts its own code, otherwise a second tab on the same domain would host
// the presenter's code as well and execute the commands it sends.
export function readStoredHostingCode(): string {
  const storedCode = sessionStorage.getItem(hostingCodeStorageKey);
  return storedCode !== null && new RegExp(`^\\d{${remoteCodeLength}}$`).test(storedCode) ? storedCode : createRemoteCode();
}

export function storeHostingCode(hostingCode: string) {
  sessionStorage.setItem(hostingCodeStorageKey, hostingCode);
}

// Digits only, at most the code length: a partial code simply names an empty room until it is complete.
export function normalizeTypedCode(typedText: string): string {
  return typedText.replace(/\D/g, "").slice(0, remoteCodeLength);
}

export function isCompleteRemoteCode(remoteCode: string): boolean {
  return remoteCode.length === remoteCodeLength;
}

// Every slides window hosts its own code and obeys remotes that know it; the code is the only key, like a short password.
// The epoch restart drops every connected remote: the broker forgets the peer and opens it anew under the same code.
export function useRemoteHosting({ isHostingAvailable, hostingCode, hostingEpoch, currentPosition, isPaused, presentationTitle, describeSlideCaption, runSlideCommand }: RemoteHostingOptions) {
  const hostingTransportReference = useRef<RemoteTransportHandle | undefined>(undefined);
  const connectedRemotesReference = useRef(0);
  const [connectedRemoteCount, setConnectedRemoteCount] = useState(0);
  const [hostingReachabilityReport, setHostingReachabilityReport] = useState<{ hostingCode: string; reachability: RemoteHostingReachability } | undefined>(undefined);
  const hostingReachability: RemoteHostingReachability =
    hostingReachabilityReport !== undefined && hostingReachabilityReport.hostingCode === hostingCode ? hostingReachabilityReport.reachability : "registering";
  const { slideIndex, stepIndex } = currentPosition;

  const receiveHostingMessage = useEffectEvent((channelMessage: RemoteChannelMessage) => {
    if (channelMessage.messageKind === "greeting") {
      connectedRemotesReference.current += 1;
      setConnectedRemoteCount(connectedRemotesReference.current);
      hostingTransportReference.current?.sendRemoteMessage({
        messageKind: "welcome",
        slideCaption: describeSlideCaption(slideIndex, stepIndex),
        presentationTitle: presentationTitle ?? "",
        isPaused,
      });
    }
    if (channelMessage.messageKind === "farewell") {
      connectedRemotesReference.current = Math.max(0, connectedRemotesReference.current - 1);
      setConnectedRemoteCount(connectedRemotesReference.current);
    }
    if (channelMessage.messageKind === "command") runSlideCommand(channelMessage.slideCommand);
  });
  const postFollowedPosition = useEffectEvent(() => {
    if (connectedRemotesReference.current > 0)
      hostingTransportReference.current?.sendRemoteMessage({
        messageKind: "position",
        slideCaption: describeSlideCaption(slideIndex, stepIndex),
        presentationTitle: presentationTitle ?? "",
        isPaused,
      });
  });

  useEffect(() => {
    if (!isHostingAvailable || !isCompleteRemoteCode(hostingCode)) return;
    const reopenTimer = setTimeout(() => {
      const hostingTransport = openRemoteHostingTransport(hostingCode, {
        onChannelMessage: receiveHostingMessage,
        onHostingOnline: () => setHostingReachabilityReport({ hostingCode, reachability: "online" }),
        onHostingOffline: () => setHostingReachabilityReport({ hostingCode, reachability: "offline" }),
      });
      hostingTransportReference.current = hostingTransport;
    }, hostingEpoch === 0 ? 0 : hostingReopenDelayMs);
    return () => {
      clearTimeout(reopenTimer);
      hostingTransportReference.current?.closeRemoteTransport();
      hostingTransportReference.current = undefined;
      connectedRemotesReference.current = 0;
      setConnectedRemoteCount(0);
    };
  }, [isHostingAvailable, hostingCode, hostingEpoch]);

  useEffect(() => {
    if (isHostingAvailable) postFollowedPosition();
  }, [isHostingAvailable, hostingCode, slideIndex, stepIndex, isPaused]);

  return { connectedRemoteCount, hostingReachability };
}

// A phone or a second laptop joins the link of the target code and drives the window that hosts it.
// The target comes from the panel field or the address after #: the hook reacts to it, there is no connect button.
export function useRemoteConnection(targetCode: string | undefined): RemoteConnection {
  const clientTransportReference = useRef<RemoteTransportHandle | undefined>(undefined);
  const [connectionReport, setConnectionReport] = useState<
    {
      targetCode: string;
      connectionStatus: Exclude<RemoteConnectionStatus, "idle">;
      followedPosition: { slideCaption: RemoteSlideCaption; presentationTitle: string | undefined; isPaused: boolean } | undefined;
    } | undefined
  >(undefined);
  const isReportCurrent = connectionReport !== undefined && connectionReport.targetCode === targetCode;
  const connectionStatus: RemoteConnectionStatus = targetCode === undefined ? "idle" : isReportCurrent ? connectionReport.connectionStatus : "connecting";
  const followedPosition = isReportCurrent ? connectionReport.followedPosition : undefined;

  useEffect(() => {
    if (targetCode === undefined) return;
    let isConnectionLive = true;
    const reportFailed = (failureStatus: Exclude<RemoteConnectionStatus, "idle" | "connected">) => {
      if (!isConnectionLive || clientTransportReference.current === undefined) return;
      isConnectionLive = false;
      clearTimeout(answerTimeout);
      const failedTransport = clientTransportReference.current;
      clientTransportReference.current = undefined;
      failedTransport.closeRemoteTransport();
      setConnectionReport({ targetCode, connectionStatus: failureStatus, followedPosition: undefined });
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
          followedPosition: {
            slideCaption: channelMessage.slideCaption,
            presentationTitle: channelMessage.presentationTitle === "" ? undefined : channelMessage.presentationTitle,
            isPaused: channelMessage.isPaused,
          },
        });
      },
      (clientFailure) =>
        reportFailed(clientFailure === "no-host" ? "unanswered" : clientFailure === "host-lost" ? "lost" : "no-broker"),
    );
    clientTransportReference.current = clientTransport;
    clientTransport.sendRemoteMessage({ messageKind: "greeting" });
    // The broker is reachable at this point: no answer means the code is wrong or the presenting screen is offline.
    const answerTimeout = setTimeout(() => reportFailed("unanswered"), connectionAnswerTimeoutMs);
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
    followedCaption: followedPosition?.slideCaption,
    followedPresentationTitle: followedPosition?.presentationTitle,
    isFollowedPaused: followedPosition?.isPaused ?? false,
    sendRemoteCommand,
  };
}
