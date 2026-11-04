// A PeerJS-protocol signaling broker for the slidemachina phone remote. It matches peers by id and relays their
// WebRTC handshake messages; after the handshake slides flow directly between the screens, never through here.
// The protocol mirrors the official peerjs-server so any PeerJS client connects unchanged.
// WebSocket Hibernation keeps always-connected phones free on the Workers plan: an idle socket costs no compute.

const peerBrokerPath = "/peerjs";
const clientStorageKeyPrefix = "remote-broker-client:";
const openMessageType = "OPEN";
const errorMessageType = "ERROR";
const idTakenMessageType = "ID-TAKEN";
const expireMessageType = "EXPIRE";
const heartbeatMessageType = "HEARTBEAT";
const expectedBrokerKey = "peerjs";
const invalidKeyErrorText = "Invalid key provided";
const invalidParametersErrorText = "No id, token, or key supplied to websocket server";
const idTakenErrorText = "ID is taken";
const roomName = "slidemachina-remote-broker";
const brokerInfoBody = JSON.stringify({
  name: "slidemachina remote broker",
  description: "PeerJS-compatible signaling broker for the slidemachina phone remote.",
  website: "https://github.com/xfenix/slidemachina",
});

type RegisteredClient = {
  token: string;
  connectionSerial: string;
};

export class RemoteBrokerRoom {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _environment: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === `${peerBrokerPath}/id`) return allocateClientIdResponse();
    if (requestUrl.pathname !== peerBrokerPath) return brokerInfoResponse(404);
    if (request.headers.get("Upgrade") !== "websocket") return brokerInfoResponse(200);
    return this.acceptClientSocket(requestUrl.searchParams);
  }

  // A socket tag pair [clientId, connectionSerial] is the only link between an event and its owner after
  // hibernation: instance memory is dropped, tags and storage survive.
  async webSocketMessage(clientSocket: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    if (typeof rawMessage !== "string") return;
    const [senderId] = this.state.getTags(clientSocket);
    let relayMessage: { type?: unknown; dst?: unknown; payload?: unknown };
    try {
      relayMessage = JSON.parse(rawMessage);
    } catch {
      return;
    }
    if (relayMessage.type === heartbeatMessageType) return;
    if (typeof relayMessage.type !== "string" || typeof relayMessage.dst !== "string") return;
    const forwardedMessage = JSON.stringify({ type: relayMessage.type, src: senderId, dst: relayMessage.dst, payload: relayMessage.payload });
    const recipientSocket = this.findClientSocket(relayMessage.dst);
    if (recipientSocket) {
      this.sendSafely(recipientSocket, forwardedMessage);
      return;
    }
    // Nobody hosts the target id: the sender learns it at once and reports an unanswered code to the user.
    this.sendSafely(clientSocket, JSON.stringify({ type: expireMessageType, src: relayMessage.dst, dst: senderId }));
  }

  async webSocketClose(closedSocket: WebSocket): Promise<void> {
    const [clientId, connectionSerial] = this.state.getTags(closedSocket);
    const registeredClient = await this.state.storage.get<RegisteredClient>(`${clientStorageKeyPrefix}${clientId}`);
    // A replaced socket of the same id must not evict the fresh registration: only the current serial cleans up.
    if (registeredClient !== undefined && registeredClient.connectionSerial === connectionSerial)
      await this.state.storage.delete(`${clientStorageKeyPrefix}${clientId}`);
  }

  async webSocketError(_brokenSocket: WebSocket): Promise<void> {
    // The close event that follows does the cleanup; there is nothing to answer to.
  }

  private async acceptClientSocket(searchParams: URLSearchParams): Promise<Response> {
    const clientId = searchParams.get("id");
    const clientToken = searchParams.get("token");
    const brokerKey = searchParams.get("key");
    if (clientId === null || clientToken === null || brokerKey === null)
      return this.rejectSocket(invalidParametersErrorText);
    if (brokerKey !== expectedBrokerKey) return this.rejectSocket(invalidKeyErrorText);
    const storageKey = `${clientStorageKeyPrefix}${clientId}`;
    const registeredClient = await this.state.storage.get<RegisteredClient>(storageKey);
    if (registeredClient !== undefined && registeredClient.token !== clientToken)
      return this.rejectSocket(idTakenErrorText, idTakenMessageType);
    const connectionSerial = crypto.randomUUID();
    const socketPair = new WebSocketPair();
    const clientSideSocket = socketPair[0];
    const serverSideSocket = socketPair[1];
    this.state.acceptWebSocket(serverSideSocket, [clientId, connectionSerial]);
    await this.state.storage.put<RegisteredClient>(storageKey, { token: clientToken, connectionSerial });
    serverSideSocket.send(JSON.stringify({ type: openMessageType }));
    return new Response(null, { status: 101, webSocket: clientSideSocket });
  }

  private rejectSocket(errorText: string, messageType: string = errorMessageType): Response {
    const socketPair = new WebSocketPair();
    const serverSideSocket = socketPair[1];
    this.state.acceptWebSocket(serverSideSocket, ["rejected", crypto.randomUUID()]);
    serverSideSocket.send(JSON.stringify({ type: messageType, payload: { msg: errorText } }));
    serverSideSocket.close();
    return new Response(null, { status: 101, webSocket: socketPair[0] });
  }

  private findClientSocket(clientId: string): WebSocket | undefined {
    for (const liveSocket of this.state.getWebSockets()) {
      const [socketClientId] = this.state.getTags(liveSocket);
      if (socketClientId === clientId) return liveSocket;
    }
    return undefined;
  }

  private sendSafely(targetSocket: WebSocket, messageText: string) {
    try {
      targetSocket.send(messageText);
    } catch {
      targetSocket.close();
    }
  }
}

export default {
  fetch(request: Request, environment: { REMOTE_BROKER: DurableObjectNamespace }): Promise<Response> {
    const brokerRoom = environment.REMOTE_BROKER.get(environment.REMOTE_BROKER.idFromName(roomName));
    return brokerRoom.fetch(request);
  },
};

function allocateClientIdResponse(): Response {
  return new Response(crypto.randomUUID(), {
    headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" },
  });
}

function brokerInfoResponse(statusCode: number): Response {
  return new Response(brokerInfoBody, {
    status: statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
