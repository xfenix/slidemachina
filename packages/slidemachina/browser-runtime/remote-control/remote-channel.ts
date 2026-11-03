import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";

type RemoteChannelMessage =
  | { messageKind: "position"; slidePosition: PresentationPosition; isPaused: boolean }
  | { messageKind: "command"; slideCommand: SlideCommand }
  | { messageKind: "greeting" }
  | { messageKind: "welcome"; slidePosition: PresentationPosition; isPaused: boolean }
  | { messageKind: "farewell" };
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
  connectToHostingScreen: (remoteCode: string) => void;
  disconnectFromHostingScreen: () => void;
  sendRemoteCommand: (slideCommand: SlideCommand) => void;
};

const remoteCodeLength = 6;
const remoteCodeDigits = "0123456789";
const connectionAnswerTimeoutMs = 2000;
const hostingCodeStorageKey = `slidemachina-remote-code:${location.pathname}`;

// The channel is named by the page path and the code: remotes from another talk on the same domain do not interfere.
function nameRemoteChannel(remoteCode: string): string {
  return `slidemachina-remote:${location.pathname}:${remoteCode}`;
}

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
  const hostingChannelReference = useRef<BroadcastChannel | undefined>(undefined);
  const connectedRemotesReference = useRef(0);
  const [connectedRemoteCount, setConnectedRemoteCount] = useState(0);
  const { slideIndex, stepIndex } = currentPosition;

  const receiveHostingMessage = useEffectEvent((channelMessage: RemoteChannelMessage) => {
    if (channelMessage.messageKind === "greeting") {
      connectedRemotesReference.current += 1;
      setConnectedRemoteCount(connectedRemotesReference.current);
      hostingChannelReference.current?.postMessage({ messageKind: "welcome", slidePosition: { slideIndex, stepIndex }, isPaused } satisfies RemoteChannelMessage);
    }
    if (channelMessage.messageKind === "farewell") {
      connectedRemotesReference.current = Math.max(0, connectedRemotesReference.current - 1);
      setConnectedRemoteCount(connectedRemotesReference.current);
    }
    if (channelMessage.messageKind === "command") runSlideCommand(channelMessage.slideCommand);
  });
  const postFollowedPosition = useEffectEvent(() => {
    if (connectedRemotesReference.current > 0)
      hostingChannelReference.current?.postMessage({ messageKind: "position", slidePosition: { slideIndex, stepIndex }, isPaused } satisfies RemoteChannelMessage);
  });

  useEffect(() => {
    if (!isHostingAvailable || !isCompleteRemoteCode(hostingCode)) return;
    const hostingChannel = new BroadcastChannel(nameRemoteChannel(hostingCode));
    hostingChannelReference.current = hostingChannel;
    hostingChannel.addEventListener("message", (messageEvent: MessageEvent<RemoteChannelMessage>) => receiveHostingMessage(messageEvent.data));
    return () => {
      hostingChannel.close();
      hostingChannelReference.current = undefined;
      connectedRemotesReference.current = 0;
      setConnectedRemoteCount(0);
    };
  }, [isHostingAvailable, hostingCode]);

  useEffect(() => {
    if (isHostingAvailable) postFollowedPosition();
  }, [isHostingAvailable, hostingCode, slideIndex, stepIndex, isPaused]);

  return { connectedRemoteCount };
}

// A phone or a second laptop joins the channel of a code and drives the window that hosts it.
export function useRemoteConnection(): RemoteConnection {
  const clientChannelReference = useRef<BroadcastChannel | undefined>(undefined);
  const [requestedCode, setRequestedCode] = useState<string | undefined>(undefined);
  const [connectionStatus, setConnectionStatus] = useState<RemoteConnectionStatus>("idle");
  const [followedPosition, setFollowedPosition] = useState<{ slidePosition: PresentationPosition; isPaused: boolean } | undefined>(undefined);

  useEffect(() => {
    if (requestedCode === undefined) return;
    const clientChannel = new BroadcastChannel(nameRemoteChannel(requestedCode));
    clientChannelReference.current = clientChannel;
    const receiveClientMessage = (channelMessage: RemoteChannelMessage) => {
      if (channelMessage.messageKind !== "welcome" && channelMessage.messageKind !== "position") return;
      clearTimeout(answerTimeout);
      setConnectionStatus("connected");
      setFollowedPosition({ slidePosition: channelMessage.slidePosition, isPaused: channelMessage.isPaused });
    };
    clientChannel.addEventListener("message", (messageEvent: MessageEvent<RemoteChannelMessage>) => receiveClientMessage(messageEvent.data));
    clientChannel.postMessage({ messageKind: "greeting" } satisfies RemoteChannelMessage);
    const answerTimeout = setTimeout(() => {
      if (clientChannelReference.current === clientChannel) {
        clientChannelReference.current = undefined;
        setConnectionStatus("unanswered");
        setRequestedCode(undefined);
      }
    }, connectionAnswerTimeoutMs);
    return () => {
      clearTimeout(answerTimeout);
      clientChannel.close();
      if (clientChannelReference.current === clientChannel) clientChannelReference.current = undefined;
    };
  }, [requestedCode]);

  // A farewell keeps the host counter honest when the remote page closes without disconnecting.
  useEffect(() => {
    const sayFarewellOnLeaving = () => clientChannelReference.current?.postMessage({ messageKind: "farewell" } satisfies RemoteChannelMessage);
    window.addEventListener("pagehide", sayFarewellOnLeaving);
    return () => window.removeEventListener("pagehide", sayFarewellOnLeaving);
  }, []);

  const connectToHostingScreen = (remoteCode: string) => {
    setConnectionStatus("connecting");
    setFollowedPosition(undefined);
    setRequestedCode(remoteCode);
  };
  const disconnectFromHostingScreen = () => {
    clientChannelReference.current?.postMessage({ messageKind: "farewell" } satisfies RemoteChannelMessage);
    setConnectionStatus("idle");
    setFollowedPosition(undefined);
    setRequestedCode(undefined);
  };
  const sendRemoteCommand = (slideCommand: SlideCommand) => {
    if (connectionStatus !== "connected") return;
    clientChannelReference.current?.postMessage({ messageKind: "command", slideCommand } satisfies RemoteChannelMessage);
  };

  return {
    connectionStatus,
    followedSlideIndex: followedPosition?.slidePosition.slideIndex,
    followedStepIndex: followedPosition?.slidePosition.stepIndex ?? 0,
    isFollowedPaused: followedPosition?.isPaused ?? false,
    connectToHostingScreen,
    disconnectFromHostingScreen,
    sendRemoteCommand,
  };
}
