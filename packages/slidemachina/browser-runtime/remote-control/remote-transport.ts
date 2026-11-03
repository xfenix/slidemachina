import type { DataConnection, Peer, PeerJSOption } from "peerjs";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";

export type RemoteChannelMessage =
  | { messageKind: "position"; slidePosition: PresentationPosition; isPaused: boolean }
  | { messageKind: "command"; slideCommand: SlideCommand }
  | { messageKind: "greeting" }
  | { messageKind: "welcome"; slidePosition: PresentationPosition; isPaused: boolean }
  | { messageKind: "farewell" };
export type RemoteTransportHandle = {
  sendRemoteMessage: (channelMessage: RemoteChannelMessage) => void;
  closeRemoteTransport: () => void;
};
type RemoteLink = {
  isLinkReady: boolean;
  sendRemoteMessage: (channelMessage: RemoteChannelMessage) => void;
  closeRemoteLink: () => void;
};
type RawMessageHandler = (fromLink: RemoteLink, rawMessage: unknown) => void;
type LinkReadyHandler = (readyLink: RemoteLink) => void;
type LinkFailedHandler = (failedLink: RemoteLink) => void;

const peerBrokerHost = "0.peerjs.com";
const peerBrokerPort = 443;
const peerBrokerPath = "/";
// Both sides give up on the cloud broker after this long and rely on BroadcastChannel alone.
const peerBrokerTimeoutMs = 4000;
const peerLinkIdPrefix = "slidemachina";
const remoteLinkPrefix = "slidemachina-remote";
const knownMessageKinds = new Set(["position", "command", "greeting", "welcome", "farewell"]);

const peerjsBrokerOptions: PeerJSOption = {
  host: peerBrokerHost,
  port: peerBrokerPort,
  path: peerBrokerPath,
  secure: true,
};

// The presenting screen listens on every transport at once: BroadcastChannel for tabs on this machine,
// PeerJS for phones from any network. An answer from either transport reaches the remote logic.
export function openRemoteHostingTransport(remoteCode: string, receiveChannelMessage: (channelMessage: RemoteChannelMessage) => void): RemoteTransportHandle {
  const receiveSafeMessage: RawMessageHandler = (_fromLink, rawMessage) => {
    const channelMessage = parseRemoteMessage(rawMessage);
    if (channelMessage !== undefined) receiveChannelMessage(channelMessage);
  };
  const ignoreLinkReady: LinkReadyHandler = () => undefined;
  const openLinks = [
    openBroadcastLink(nameRemoteLink(remoteCode), receiveSafeMessage, ignoreLinkReady),
    openPeerjsHostingLink(peerLinkIdFor(remoteCode), receiveSafeMessage, ignoreLinkReady),
  ];
  return {
    sendRemoteMessage: (channelMessage) => {
      for (const openLink of openLinks) openLink.sendRemoteMessage(channelMessage);
    },
    closeRemoteTransport: () => {
      for (const openLink of openLinks) openLink.closeRemoteLink();
    },
  };
}

// The phone greets over every ready transport; the first one to answer wins, the losers get a farewell so the
// host's remote count stays honest. PeerJS failure never blocks the local BroadcastChannel path, it reports
// "unanswered" so the panel does not wait for the full answer timeout on a code nobody hosts.
export function openRemoteClientTransport(
  remoteCode: string,
  receiveChannelMessage: (channelMessage: RemoteChannelMessage) => void,
  reportTransportFailure: () => void,
): RemoteTransportHandle {
  let hasGreetingBeenSent = false;
  let settledLink: RemoteLink | undefined;
  const greetedLinks = new Set<RemoteLink>();
  const openLinks = new Set<RemoteLink>();

  const closeLosingLink = (losingLink: RemoteLink) => {
    if (greetedLinks.has(losingLink)) losingLink.sendRemoteMessage({ messageKind: "farewell" });
    greetedLinks.delete(losingLink);
    openLinks.delete(losingLink);
    losingLink.closeRemoteLink();
  };
  const receiveFromLink: RawMessageHandler = (fromLink, rawMessage) => {
    const channelMessage = parseRemoteMessage(rawMessage);
    if (channelMessage === undefined) return;
    if ((channelMessage.messageKind === "welcome" || channelMessage.messageKind === "position") && settledLink === undefined) {
      settledLink = fromLink;
      for (const openLink of openLinks) if (openLink !== fromLink) closeLosingLink(openLink);
    }
    if (settledLink === undefined || settledLink === fromLink) receiveChannelMessage(channelMessage);
  };
  const greetReadyLink: LinkReadyHandler = (readyLink) => {
    if (!readyLink.isLinkReady || !hasGreetingBeenSent || greetedLinks.has(readyLink)) return;
    readyLink.sendRemoteMessage({ messageKind: "greeting" });
    greetedLinks.add(readyLink);
  };
  const reportLinkFailure = () => {
    if (settledLink !== undefined) return;
    reportTransportFailure();
  };
  const registerLink = (openLink: RemoteLink) => {
    openLinks.add(openLink);
    greetReadyLink(openLink);
  };

  registerLink(openBroadcastLink(nameRemoteLink(remoteCode), receiveFromLink, greetReadyLink));
  registerLink(openPeerjsClientLink(peerLinkIdFor(remoteCode), receiveFromLink, greetReadyLink, () => reportLinkFailure()));

  return {
    sendRemoteMessage: (channelMessage) => {
      if (channelMessage.messageKind === "greeting") {
        hasGreetingBeenSent = true;
        for (const openLink of openLinks) greetReadyLink(openLink);
        return;
      }
      settledLink?.sendRemoteMessage(channelMessage);
    },
    closeRemoteTransport: () => {
      for (const openLink of openLinks) closeLosingLink(openLink);
    },
  };
}

function openBroadcastLink(broadcastName: string, reportRawMessage: RawMessageHandler, reportLinkReady: LinkReadyHandler): RemoteLink {
  if (typeof BroadcastChannel === "undefined") return createInertLink();
  const broadcastChannel = new BroadcastChannel(broadcastName);
  const broadcastLink: RemoteLink = {
    isLinkReady: true,
    sendRemoteMessage: (channelMessage) => broadcastChannel.postMessage(channelMessage),
    closeRemoteLink: () => broadcastChannel.close(),
  };
  broadcastChannel.addEventListener("message", (messageEvent: MessageEvent<unknown>) => reportRawMessage(broadcastLink, messageEvent.data));
  reportLinkReady(broadcastLink);
  return broadcastLink;
}

// A browser without BroadcastChannel (or a page where it is unavailable) still gets the full WebRTC path.
function createInertLink(): RemoteLink {
  return {
    isLinkReady: false,
    sendRemoteMessage: () => undefined,
    closeRemoteLink: () => undefined,
  };
}

function openPeerjsHostingLink(peerLinkId: string, reportRawMessage: RawMessageHandler, reportLinkReady: LinkReadyHandler): RemoteLink {
  let hostingPeer: Peer | undefined;
  const openConnections = new Set<DataConnection>();
  let isLinkReady = false;
  let isLinkClosed = false;
  const hostingLink: RemoteLink = {
    get isLinkReady() {
      return isLinkReady;
    },
    sendRemoteMessage: (channelMessage) => {
      for (const openConnection of openConnections) if (openConnection.open) void openConnection.send(channelMessage);
    },
    closeRemoteLink: () => {
      isLinkClosed = true;
      hostingPeer?.destroy();
    },
  };
  const giveUpOnBroker = () => {
    if (!isLinkReady && !isLinkClosed) {
      isLinkClosed = true;
      hostingPeer?.destroy();
    }
  };
  void loadPeerModule().then(({ default: PeerConstructor }) => {
    if (isLinkClosed) return;
    const createdPeer = new PeerConstructor(peerLinkId, peerjsBrokerOptions);
    hostingPeer = createdPeer;
    setTimeout(giveUpOnBroker, peerBrokerTimeoutMs);
    createdPeer.on("open", () => {
      if (isLinkClosed) return;
      isLinkReady = true;
      reportLinkReady(hostingLink);
    });
    createdPeer.on("connection", (incomingConnection: DataConnection) => {
      incomingConnection.on("data", (rawMessage: unknown) => reportRawMessage(hostingLink, rawMessage));
      incomingConnection.on("open", () => openConnections.add(incomingConnection));
      incomingConnection.on("close", () => openConnections.delete(incomingConnection));
    });
    createdPeer.on("error", () => giveUpOnBroker());
    createdPeer.on("disconnected", () => {
      if (!isLinkClosed) hostingPeer?.reconnect();
    });
  });
  return hostingLink;
}

function openPeerjsClientLink(hostPeerLinkId: string, reportRawMessage: RawMessageHandler, reportLinkReady: LinkReadyHandler, reportLinkFailed: LinkFailedHandler): RemoteLink {
  let clientPeer: Peer | undefined;
  let clientConnection: DataConnection | undefined;
  let isLinkReady = false;
  let isLinkClosed = false;
  const clientLink: RemoteLink = {
    get isLinkReady() {
      return isLinkReady;
    },
    sendRemoteMessage: (channelMessage) => {
      if (clientConnection?.open) void clientConnection.send(channelMessage);
    },
    closeRemoteLink: () => {
      isLinkClosed = true;
      clientConnection?.close();
      clientPeer?.destroy();
    },
  };
  const giveUpOnBroker = () => {
    if (isLinkReady || isLinkClosed) return;
    isLinkClosed = true;
    clientPeer?.destroy();
  };
  void loadPeerModule().then(({ default: PeerConstructor }) => {
    if (isLinkClosed) return;
    const createdPeer = new PeerConstructor(peerjsBrokerOptions);
    clientPeer = createdPeer;
    setTimeout(() => {
      if (isLinkReady || isLinkClosed) return;
      giveUpOnBroker();
      // Four silent seconds for BroadcastChannel to answer locally; after that the code is truly unanswered.
      reportLinkFailed(clientLink);
    }, peerBrokerTimeoutMs);
    createdPeer.on("open", () => {
      if (isLinkClosed) return;
      clientConnection = createdPeer.connect(hostPeerLinkId, { reliable: true });
      clientConnection.on("data", (rawMessage: unknown) => reportRawMessage(clientLink, rawMessage));
      clientConnection.on("open", () => {
        if (isLinkClosed) return;
        isLinkReady = true;
        reportLinkReady(clientLink);
      });
    });
    // "peer-unavailable" means the broker is reachable but the code is not hosted there: by then BroadcastChannel
    // has long had its chance, so report right away. Other errors are silent: the local link may still answer
    // before the broker timeout reports the failure.
    createdPeer.on("error", (clientError: { type: string }) => {
      if (isLinkReady || isLinkClosed) return;
      if (clientError.type === "peer-unavailable") reportLinkFailed(clientLink);
      giveUpOnBroker();
    });
    createdPeer.on("disconnected", () => {
      if (!isLinkClosed) clientPeer?.reconnect();
    });
  });
  return clientLink;
}

// The channel is named by the page path and the code: remotes from another talk on the same domain do not interfere.
function nameRemoteLink(remoteCode: string): string {
  return `${remoteLinkPrefix}:${location.pathname}:${remoteCode}`;
}

// PeerJS ids live on the public broker, so the id also carries a hash of the origin and path: talks on different
// domains never share a link id, and the six-digit code stays the only part a phone needs to know.
function peerLinkIdFor(remoteCode: string): string {
  return `${peerLinkIdPrefix}-${hashTextToBase36(`${location.origin}${location.pathname}`)}-${remoteCode}`;
}

function hashTextToBase36(textToHash: string): string {
  let hashValue = 0;
  for (let characterIndex = 0; characterIndex < textToHash.length; characterIndex += 1) {
    hashValue = (Math.imul(hashValue, 33) ^ textToHash.charCodeAt(characterIndex)) >>> 0;
  }
  return hashValue.toString(36);
}

// Messages from the network are checked before they reach the slide engine: anything of an unknown kind is dropped.
function parseRemoteMessage(rawMessage: unknown): RemoteChannelMessage | undefined {
  if (typeof rawMessage !== "object" || rawMessage === null) return undefined;
  const { messageKind } = rawMessage as { messageKind?: unknown };
  return typeof messageKind === "string" && knownMessageKinds.has(messageKind) ? (rawMessage as RemoteChannelMessage) : undefined;
}

type PeerModule = typeof import("peerjs");
let cachedPeerModulePromise: Promise<PeerModule> | undefined;
// The module loads on demand: pages that never open the panel do not pay for it, and an offline machine
// still falls back to BroadcastChannel when the panel does open.
function loadPeerModule(): Promise<PeerModule> {
  cachedPeerModulePromise ??= import("peerjs");
  return cachedPeerModulePromise;
}
