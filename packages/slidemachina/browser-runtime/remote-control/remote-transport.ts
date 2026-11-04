import type { DataConnection, Peer, PeerJSOption } from "peerjs";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";

export type RemoteSlideCaption = {
  shownSlideNumber: number;
  shownSlideCount: number;
  stepIndex: number;
  stepCount: number;
};
export type RemoteChannelMessage =
  | { messageKind: "position"; slideCaption: RemoteSlideCaption; isPaused: boolean }
  | { messageKind: "command"; slideCommand: SlideCommand }
  | { messageKind: "greeting" }
  | { messageKind: "welcome"; slideCaption: RemoteSlideCaption; isPaused: boolean }
  | { messageKind: "farewell" };
export type RemoteClientFailure = "no-host" | "no-broker";
export type RemoteTransportHandle = {
  sendRemoteMessage: (channelMessage: RemoteChannelMessage) => void;
  closeRemoteTransport: () => void;
};
export type RemoteHostingEvents = {
  onChannelMessage: (channelMessage: RemoteChannelMessage) => void;
  onHostingOnline: () => void;
  onHostingOffline: () => void;
};

const defaultBrokerHost = "0.peerjs.com";
const defaultBrokerPort = 443;
const brokerQueryParameter = "remote-broker";
// A broker either answers in these four seconds or is not reachable: the panel says the remote needs the internet.
const brokerRegistrationTimeoutMs = 4000;
const peerLinkIdPrefix = "slidemachina";
const knownMessageKinds = new Set(["position", "command", "greeting", "welcome", "farewell"]);

// The presenting screen hosts its code on the public PeerJS broker by default; ?remote-broker=host:port points
// both sides at another broker, for a self-hosted one or for the local broker of the tests.
export function readRemoteBrokerOptions(): PeerJSOption {
  const brokerOverride = new URLSearchParams(location.search).get(brokerQueryParameter);
  if (brokerOverride === null) return { host: defaultBrokerHost, port: defaultBrokerPort, path: "/", secure: true };
  const [overrideHost = defaultBrokerHost, overridePort = "80"] = brokerOverride.split(":");
  const isLocalBroker = overrideHost === "localhost" || overrideHost === "127.0.0.1";
  // A local broker means a local test: host candidates alone connect two same-machine tabs instantly,
  // and no public STUN server is polled.
  return { host: overrideHost, port: Number(overridePort), path: "/", secure: !isLocalBroker, config: { iceServers: [] } };
}

// Every slides window hosts its own code on the broker and obeys remotes that know it; the code is the only key,
// like a short password. One transport for all remotes: messages fan out to every open connection.
export function openRemoteHostingTransport(hostingCode: string, hostingEvents: RemoteHostingEvents): RemoteTransportHandle {
  const brokerOptions = readRemoteBrokerOptions();
  let hostingPeer: Peer | undefined;
  const openConnections = new Set<DataConnection>();
  let isHostingClosed = false;
  void loadPeerModule().then(({ default: PeerConstructor }) => {
    if (isHostingClosed) return;
    const createdPeer = new PeerConstructor(peerLinkIdFor(hostingCode), brokerOptions);
    hostingPeer = createdPeer;
    setTimeout(() => {
      if (createdPeer.open || isHostingClosed) return;
      isHostingClosed = true;
      createdPeer.destroy();
      hostingEvents.onHostingOffline();
    }, brokerRegistrationTimeoutMs);
    createdPeer.on("open", () => {
      if (isHostingClosed) return;
      hostingEvents.onHostingOnline();
    });
    createdPeer.on("connection", (incomingConnection: DataConnection) => {
      incomingConnection.on("data", (rawMessage: unknown) => {
        const channelMessage = parseRemoteMessage(rawMessage);
        if (channelMessage !== undefined) hostingEvents.onChannelMessage(channelMessage);
      });
      incomingConnection.on("open", () => openConnections.add(incomingConnection));
      incomingConnection.on("close", () => openConnections.delete(incomingConnection));
    });
    createdPeer.on("disconnected", () => {
      if (!isHostingClosed) hostingPeer?.reconnect();
    });
  });
  return {
    sendRemoteMessage: (channelMessage) => {
      for (const openConnection of openConnections) if (openConnection.open) void openConnection.send(channelMessage);
    },
    closeRemoteTransport: () => {
      isHostingClosed = true;
      hostingPeer?.destroy();
    },
  };
}

// A phone or a second laptop joins the link of the target code and drives the window that hosts it. Outgoing
// messages wait in a queue until the channel opens, so the greeting can be sent right away. A missing host on the
// broker is reported at once; a silent broker is reported by the registration timeout or the answer timeout above.
export function openRemoteClientTransport(
  targetCode: string,
  receiveChannelMessage: (channelMessage: RemoteChannelMessage) => void,
  reportClientFailure: (clientFailure: RemoteClientFailure) => void,
): RemoteTransportHandle {
  const brokerOptions = readRemoteBrokerOptions();
  let clientPeer: Peer | undefined;
  let clientConnection: DataConnection | undefined;
  const pendingMessages: RemoteChannelMessage[] = [];
  let isClientClosed = false;
  void loadPeerModule().then(({ default: PeerConstructor }) => {
    if (isClientClosed) return;
    const createdPeer = new PeerConstructor(brokerOptions);
    clientPeer = createdPeer;
    setTimeout(() => {
      if (createdPeer.open || isClientClosed) return;
      isClientClosed = true;
      createdPeer.destroy();
      reportClientFailure("no-broker");
    }, brokerRegistrationTimeoutMs);
    createdPeer.on("open", () => {
      if (isClientClosed) return;
      clientConnection = createdPeer.connect(peerLinkIdFor(targetCode), { reliable: true });
      clientConnection.on("data", (rawMessage: unknown) => {
        const channelMessage = parseRemoteMessage(rawMessage);
        if (channelMessage !== undefined) receiveChannelMessage(channelMessage);
      });
      clientConnection.on("open", () => {
        for (const pendingMessage of pendingMessages.splice(0)) void clientConnection?.send(pendingMessage);
      });
    });
    createdPeer.on("error", (clientError: { type: string }) => {
      if (createdPeer.open || isClientClosed) return;
      isClientClosed = true;
      createdPeer.destroy();
      reportClientFailure(clientError.type === "peer-unavailable" ? "no-host" : "no-broker");
    });
    createdPeer.on("disconnected", () => {
      if (!isClientClosed) clientPeer?.reconnect();
    });
  });
  return {
    sendRemoteMessage: (channelMessage) => {
      if (clientConnection?.open) void clientConnection.send(channelMessage);
      else pendingMessages.push(channelMessage);
    },
    closeRemoteTransport: () => {
      isClientClosed = true;
      clientConnection?.close();
      clientPeer?.destroy();
    },
  };
}

// The link id is the code alone: a phone page on any domain, including a published remote.html or a deck opened
// from disk, connects to the same room by the same code.
function peerLinkIdFor(remoteCode: string): string {
  return `${peerLinkIdPrefix}-${remoteCode}`;
}

// Messages from the network are checked before they reach the slide engine: anything of an unknown kind is dropped.
function parseRemoteMessage(rawMessage: unknown): RemoteChannelMessage | undefined {
  if (typeof rawMessage !== "object" || rawMessage === null) return undefined;
  const { messageKind } = rawMessage as { messageKind?: unknown };
  return typeof messageKind === "string" && knownMessageKinds.has(messageKind) ? (rawMessage as RemoteChannelMessage) : undefined;
}

type PeerModule = typeof import("peerjs");
let cachedPeerModulePromise: Promise<PeerModule> | undefined;
// The module loads on demand: pages that never open the panel do not pay for it.
function loadPeerModule(): Promise<PeerModule> {
  cachedPeerModulePromise ??= import("peerjs");
  return cachedPeerModulePromise;
}
