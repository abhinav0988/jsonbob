import { DurableObject } from "cloudflare:workers";

type Peer = { id: string; name: string; joinedAt: number };
type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  path?: string;
  createdAt: number;
};

type ClientMsg =
  | { type: "hello"; id: string; name: string }
  | { type: "content"; text: string; rev: number }
  | { type: "cursor"; path?: string }
  | { type: "comment"; text: string; path?: string }
  | { type: "ping" };

type ServerMsg =
  | { type: "peers"; peers: Peer[] }
  | { type: "content"; text: string; rev: number; from: string }
  | { type: "hello-ack"; rev: number; text: string; comments: Comment[] }
  | { type: "comment"; comment: Comment }
  | { type: "comments"; comments: Comment[] }
  | { type: "pong" }
  | { type: "error"; message: string };

/**
 * Per-document collaboration room: presence + LWW content + durable comments (DO storage).
 */
export class CollabRoom extends DurableObject {
  peers = new Map<WebSocket, Peer>();
  content = "";
  rev = 0;
  comments: Comment[] = [];
  booted = false;

  private async ensureBoot() {
    if (this.booted) return;
    this.booted = true;
    const stored = await this.ctx.storage.get<{
      content?: string;
      rev?: number;
      comments?: Comment[];
    }>("room");
    if (stored) {
      this.content = stored.content ?? "";
      this.rev = stored.rev ?? 0;
      this.comments = stored.comments ?? [];
    }
  }

  private async persist() {
    await this.ctx.storage.put("room", {
      content: this.content,
      rev: this.rev,
      comments: this.comments.slice(-80),
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureBoot();
    const url = new URL(request.url);
    if (url.pathname.endsWith("/state")) {
      return Response.json({
        peers: [...this.peers.values()],
        rev: this.rev,
        contentLength: this.content.length,
        comments: this.comments.slice(-50),
      });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ensureBoot();
    if (typeof message !== "string") return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(message) as ClientMsg;
    } catch {
      this.send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    if (msg.type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }

    if (msg.type === "hello") {
      this.peers.set(ws, { id: msg.id, name: msg.name || "anon", joinedAt: Date.now() });
      this.send(ws, {
        type: "hello-ack",
        rev: this.rev,
        text: this.content,
        comments: this.comments.slice(-50),
      });
      this.broadcastPeers();
      return;
    }

    if (msg.type === "content") {
      if (msg.rev < this.rev) {
        this.send(ws, { type: "content", text: this.content, rev: this.rev, from: "server" });
        return;
      }
      this.content = msg.text;
      this.rev = msg.rev;
      await this.persist();
      const from = this.peers.get(ws)?.id ?? "unknown";
      this.broadcast({ type: "content", text: this.content, rev: this.rev, from }, ws);
      return;
    }

    if (msg.type === "comment") {
      const peer = this.peers.get(ws);
      const text = String(msg.text ?? "").trim().slice(0, 500);
      if (!text || !peer) return;
      const comment: Comment = {
        id: `c_${crypto.randomUUID().slice(0, 8)}`,
        authorId: peer.id,
        authorName: peer.name,
        text,
        path: msg.path,
        createdAt: Date.now(),
      };
      this.comments = [...this.comments, comment].slice(-80);
      await this.persist();
      this.broadcast({ type: "comment", comment });
      return;
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.peers.delete(ws);
    this.broadcastPeers();
  }

  async webSocketError(ws: WebSocket) {
    this.peers.delete(ws);
    this.broadcastPeers();
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* closed */
    }
  }

  private broadcast(msg: ServerMsg, except?: WebSocket) {
    for (const peer of this.peers.keys()) {
      if (peer === except) continue;
      this.send(peer, msg);
    }
  }

  private broadcastPeers() {
    const peers = [...this.peers.values()];
    this.broadcast({ type: "peers", peers });
  }
}
