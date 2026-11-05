import type { DataConnection, Peer, PeerJSOption } from "peerjs";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";

export type RemoteSlideCaption = {
  shownSlideNumber: number;
  shownSlideCount: number;
  stepIndex: number;
  stepCount: number;
};
export type RemoteChannelMessage =
  | { messageKind: "position"; slideCaption: RemoteSlideCaption; presentationTitle: string; isPaused: boolean }
  | { messageKind: "command"; slideCommand: SlideCommand }
  | { messageKind: "greeting" }
  | { messageKind: "welcome"; slideCaption: RemoteSlideCaption; presentationTitle: string; isPaused: boolean }
  | { messageKind: "farewell" };
export type RemoteClientFailure = "no-host" | "no-broker" | "host-lost";
export type RemoteTransportHandle = {
  sendRemoteMessage: (channelMessage: RemoteChannelMessage) => void;
  closeRemoteTransport: () => void;
};
export type RemoteHostingEvents = {
  onChannelMessage: (channelMessage: RemoteChannelMessage) => void;
  onHostingOnline: () => void;
  onHostingOffline: () => void;
};

const brokerQueryParameter = "remote-broker";
// A broker either answers in these four seconds or is not reachable: the client moves on to the next one,
// and the panel says the remote needs the internet only after the whole chain has failed.
const brokerRegistrationTimeoutMs = 4000;
const peerLinkIdPrefix = "slidemachina";
const knownMessageKinds = new Set(["position", "command", "greeting", "welcome", "farewell"]);
// Google STUN is the peerjs default; Cloudflare STUN joins it as the backup for networks that block Google.
const publicStunServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

type RemoteBrokerAddress = {
  host: string;
  port: number;
  secure: boolean;
  iceServers: RTCIceServer[];
};

// The chain of signaling brokers, most preferred first. Every link speaks the PeerJS protocol, so a screen and
// a phone meet on the first broker that answers; the public PeerJS cloud stays as the last fallback.
// A Hugging Face Space with the official peerjs server lives in huggingface-space/ as a backup option —
// Docker Spaces there are a paid feature now, so it is not part of the default chain.
const fallbackBrokerChain: RemoteBrokerAddress[] = [
  { host: "slidemachina-broker.xfenix.workers.dev", port: 443, secure: true, iceServers: publicStunServers },
  { host: "0.peerjs.com", port: 443, secure: true, iceServers: publicStunServers },
];

// The presenting screen and the phone share one broker chain; ?remote-broker=host:port,host:port overrides it
// with a comma-separated list, for self-hosted brokers or for the local broker of the tests.
export function readRemoteBrokerChain(): RemoteBrokerAddress[] {
  const brokerOverride = new URLSearchParams(location.search).get(brokerQueryParameter);
  if (brokerOverride === null) return fallbackBrokerChain;
  return brokerOverride.split(",").map(readSingleBrokerOverride);
}

// Every slides window hosts its own code on the broker and obeys remotes that know it; the code is the only key,
// like a short password. One transport for all remotes: messages fan out to every open connection.
export function openRemoteHostingTransport(hostingCode: string, hostingEvents: RemoteHostingEvents): RemoteTransportHandle {
  const brokerChain = readRemoteBrokerChain();
  let hostingPeer: Peer | undefined;
  const openConnections = new Set<DataConnection>();
  let isHostingClosed = false;
  void loadPeerModule().then(({ default: PeerConstructor }) => {
    // The code registers on the first broker that answers; a dead or blocked broker costs the registration
    // timeout and moves the registration to the next link of the chain.
    const registerHostingPeer = (brokerIndex: number) => {
      if (isHostingClosed) return;
      const brokerAddress = brokerChain[brokerIndex];
      if (brokerAddress === undefined) {
        isHostingClosed = true;
        hostingEvents.onHostingOffline();
        return;
      }
      const createdPeer = new PeerConstructor(peerLinkIdFor(hostingCode), toPeerJsOptions(brokerAddress));
      hostingPeer = createdPeer;
      const failOverToNextBroker = () => {
        if (createdPeer.open || isHostingClosed) return;
        clearTimeout(registrationTimeout);
        createdPeer.destroy();
        registerHostingPeer(brokerIndex + 1);
      };
      const registrationTimeout = setTimeout(failOverToNextBroker, brokerRegistrationTimeoutMs);
      createdPeer.on("open", () => {
        clearTimeout(registrationTimeout);
        if (isHostingClosed) return;
        hostingEvents.onHostingOnline();
      });
      createdPeer.on("error", failOverToNextBroker);
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
    };
    registerHostingPeer(0);
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
// messages wait in a queue until the channel opens, so the greeting can be sent right away. A silent broker is
// passed over for the next chain link; a reachable broker without an answer means a wrong code or an offline
// screen and is reported by the answer timeout below.
export function openRemoteClientTransport(
  targetCode: string,
  receiveChannelMessage: (channelMessage: RemoteChannelMessage) => void,
  reportClientFailure: (clientFailure: RemoteClientFailure) => void,
): RemoteTransportHandle {
  const brokerChain = readRemoteBrokerChain();
  let clientPeer: Peer | undefined;
  let clientConnection: DataConnection | undefined;
  const pendingMessages: RemoteChannelMessage[] = [];
  let isClientClosed = false;
  void loadPeerModule().then(({ default: PeerConstructor }) => {
    // Registration walks the broker chain link by link; only a failure of the last link means no broker at all.
    const registerClientPeer = (brokerIndex: number) => {
      if (isClientClosed) return;
      const brokerAddress = brokerChain[brokerIndex];
      if (brokerAddress === undefined) {
        reportClientFailure("no-broker");
        return;
      }
      const createdPeer = new PeerConstructor(toPeerJsOptions(brokerAddress));
      clientPeer = createdPeer;
      const failOverToNextBroker = () => {
        if (createdPeer.open || isClientClosed) return;
        clearTimeout(registrationTimeout);
        createdPeer.destroy();
        registerClientPeer(brokerIndex + 1);
      };
      const registrationTimeout = setTimeout(failOverToNextBroker, brokerRegistrationTimeoutMs);
      createdPeer.on("open", () => {
        clearTimeout(registrationTimeout);
        if (isClientClosed) return;
        clientConnection = createdPeer.connect(peerLinkIdFor(targetCode), { reliable: true });
        clientConnection.on("data", (rawMessage: unknown) => {
          const channelMessage = parseRemoteMessage(rawMessage);
          if (channelMessage !== undefined) receiveChannelMessage(channelMessage);
        });
        clientConnection.on("open", () => {
          for (const pendingMessage of pendingMessages.splice(0)) void clientConnection?.send(pendingMessage);
        });
        // The presenting screen goes away or drops every remote: the channel closes and the phone says so.
        clientConnection.on("close", () => {
          if (isClientClosed) return;
          isClientClosed = true;
          createdPeer.destroy();
          reportClientFailure("host-lost");
        });
      });
      createdPeer.on("error", failOverToNextBroker);
      createdPeer.on("disconnected", () => {
        if (!isClientClosed) clientPeer?.reconnect();
      });
    };
    registerClientPeer(0);
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

function readSingleBrokerOverride(overrideEntry: string): RemoteBrokerAddress {
  const [overrideHost = "0.peerjs.com", overridePort = "80"] = overrideEntry.split(":");
  const isLocalBroker = overrideHost === "localhost" || overrideHost === "127.0.0.1";
  // A local broker means a local test: host candidates alone connect two same-machine tabs instantly,
  // and no public STUN server is polled.
  return { host: overrideHost, port: Number(overridePort), secure: !isLocalBroker, iceServers: isLocalBroker ? [] : publicStunServers };
}

function toPeerJsOptions(brokerAddress: RemoteBrokerAddress): PeerJSOption {
  return {
    host: brokerAddress.host,
    port: brokerAddress.port,
    path: "/",
    secure: brokerAddress.secure,
    config: { iceServers: brokerAddress.iceServers },
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
