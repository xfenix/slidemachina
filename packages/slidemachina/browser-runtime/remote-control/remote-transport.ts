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
// A broker either answers in these four seconds or counts as dead: the hosting screen reports offline only
// when no link of the chain answered, a joining phone walks the links until the first live one.
const brokerRegistrationTimeoutMs = 4000;
const peerLinkIdPrefix = "slidemachina";
const knownMessageKinds = new Set(["position", "command", "greeting", "welcome", "farewell"]);
// Google STUN is the peerjs default; Cloudflare STUN joins it as the backup for networks that block Google.
// The TURN relay on the author's own server carries the sessions where the NATs refuse a direct path —
// a VPN phone against a plain laptop is the usual one; STUN alone leaves that to luck.
const publicIceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: ["turn:xfenix.ru:3478?transport=udp", "turn:xfenix.ru:3478?transport=tcp"],
    username: "slidemachina",
    credential: "dee4fe97100e415c78942bd6",
  },
];

type RemoteBrokerAddress = {
  host: string;
  port: number;
  secure: boolean;
  iceServers: RTCIceServer[];
};

// The chain of signaling brokers, most preferred first. Every link speaks the PeerJS protocol, and the
// presenting screen registers on EVERY link at once — a phone walks the chain and meets its host on the
// first link that answers for both of them. The free public cloud goes first, the own server second,
// the Cloudflare Worker stays as the backup.
const fallbackBrokerChain: RemoteBrokerAddress[] = [
  { host: "0.peerjs.com", port: 443, secure: true, iceServers: publicIceServers },
  { host: "xfenix.ru", port: 443, secure: true, iceServers: publicIceServers },
  { host: "slidemachina-broker.xfenix.workers.dev", port: 443, secure: true, iceServers: publicIceServers },
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
  const hostingPeers: Peer[] = [];
  const openConnections = new Set<DataConnection>();
  let isHostingClosed = false;
  let hasOpenedBrokerPeer = false;
  void loadPeerModule().then(({ default: PeerConstructor }) => {
    // The screen registers on the primary links of the chain at once: different networks reach different
    // links — a phone under a VPN may only see the public cloud while a Russian laptop only sees the own
    // server — so whichever link a phone can walk to, its host is already there. The LAST link is a backup:
    // it opens only when no primary answered, so a finite-quota broker (the Cloudflare Worker) never sees
    // traffic while the own and the public servers are alive.
    const registerOnBroker = (brokerAddress: RemoteBrokerAddress) => {
      const createdPeer = new PeerConstructor(peerLinkIdFor(hostingCode), toPeerJsOptions(brokerAddress));
      hostingPeers.push(createdPeer);
      // A silent broker never gets an online report from its peer; its timeout just cleans the dead socket up.
      const registrationTimeout = setTimeout(() => createdPeer.destroy(), brokerRegistrationTimeoutMs);
      createdPeer.on("open", () => {
        clearTimeout(registrationTimeout);
        if (isHostingClosed) return;
        hasOpenedBrokerPeer = true;
        hostingEvents.onHostingOnline();
      });
      createdPeer.on("error", () => {
        if (createdPeer.open || isHostingClosed) return;
        clearTimeout(registrationTimeout);
        createdPeer.destroy();
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
        if (!isHostingClosed) createdPeer.reconnect();
      });
    };
    const backupBrokerAddress = brokerChain.length > 1 ? brokerChain[brokerChain.length - 1] : undefined;
    for (const brokerAddress of brokerChain.slice(0, backupBrokerAddress === undefined ? undefined : -1)) {
      if (isHostingClosed) break;
      registerOnBroker(brokerAddress);
    }
    if (backupBrokerAddress !== undefined) {
      setTimeout(() => {
        if (hasOpenedBrokerPeer || isHostingClosed) return;
        registerOnBroker(backupBrokerAddress);
      }, brokerRegistrationTimeoutMs);
    }
    // Only a chain where no link answered at all is an offline report; with a pending backup the window doubles.
    setTimeout(
      () => {
        if (hasOpenedBrokerPeer || isHostingClosed) return;
        isHostingClosed = true;
        for (const hostingPeer of hostingPeers) hostingPeer.destroy();
        hostingEvents.onHostingOffline();
      },
      backupBrokerAddress === undefined ? brokerRegistrationTimeoutMs : brokerRegistrationTimeoutMs * 2,
    );
  });
  return {
    sendRemoteMessage: (channelMessage) => {
      for (const openConnection of openConnections) if (openConnection.open) void openConnection.send(channelMessage);
    },
    closeRemoteTransport: () => {
      isHostingClosed = true;
      for (const hostingPeer of hostingPeers) hostingPeer.destroy();
    },
  };
}

// A phone or a second laptop joins the link of the target code and drives the window that hosts it. Outgoing
// messages wait in a queue until the channel opens, so the greeting can be sent right away. The client walks
// the chain past dead links and past live links without the host; a wrong code or an offline screen surfaces
// through the answer timeout of the channel above.
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
    // Registration walks the broker chain link by link. A pre-open failure means a dead link; a
    // "peer-unavailable" after registration means the broker is alive but the host sits on another link —
    // both walk on. Only the failure of the last link reports anything: no broker at all, or no host anywhere.
    const registerClientPeer = (brokerIndex: number, hasMissedHost = false) => {
      if (isClientClosed) return;
      const brokerAddress = brokerChain[brokerIndex];
      if (brokerAddress === undefined) {
        reportClientFailure(hasMissedHost ? "no-host" : "no-broker");
        return;
      }
      const createdPeer = new PeerConstructor(toPeerJsOptions(brokerAddress));
      clientPeer = createdPeer;
      const walkToNextBroker = (isMissingHost: boolean) => {
        if (isClientClosed) return;
        clearTimeout(registrationTimeout);
        createdPeer.destroy();
        registerClientPeer(brokerIndex + 1, hasMissedHost || isMissingHost);
      };
      const registrationTimeout = setTimeout(() => walkToNextBroker(false), brokerRegistrationTimeoutMs);
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
      createdPeer.on("error", (clientError: { type: string }) => {
        if (isClientClosed) return;
        if (!createdPeer.open) {
          walkToNextBroker(false);
          return;
        }
        // The host is missing on this live broker: walk on. But not from the last link — the host may be
        // registering there right now, it opens the backup link only after its primaries stayed silent,
        // so the answer timeout of the channel gets the final word there.
        if (clientError.type === "peer-unavailable" && brokerIndex < brokerChain.length - 1) walkToNextBroker(true);
      });
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
  return { host: overrideHost, port: Number(overridePort), secure: !isLocalBroker, iceServers: isLocalBroker ? [] : publicIceServers };
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
