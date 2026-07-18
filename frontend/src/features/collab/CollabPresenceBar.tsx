import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "../../lib/apiBase";
import { useAuthStore } from "../../store/authStore";

type Peer = { id: string; name: string; joinedAt?: number };
type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  path?: string;
  createdAt: number;
};

type ServerMsg =
  | { type: "peers"; peers: Peer[] }
  | { type: "content"; text: string; rev: number; from: string }
  | { type: "hello-ack"; rev: number; text: string; comments?: Comment[] }
  | { type: "comment"; comment: Comment }
  | { type: "comments"; comments: Comment[] }
  | { type: "pong" }
  | { type: "error"; message: string };

function apiBaseToWs(base: string) {
  const raw = (base || window.location.origin).replace(/\/$/, "");
  if (raw.startsWith("https://")) return `wss://${raw.slice("https://".length)}`;
  if (raw.startsWith("http://")) return `ws://${raw.slice("http://".length)}`;
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  return `ws://${raw}`;
}

function peerSelfId() {
  const key = "jsonbob-presence-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `u_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

/**
 * Collaborative presence + LWW content sync + ephemeral room comments.
 * Prefers Durable Object WebSocket; falls back to BroadcastChannel for same-origin tabs.
 */
export function CollabPresenceBar({
  roomId,
  content,
  onRemoteContent,
  enabled = true,
}: {
  roomId: string;
  content?: string;
  onRemoteContent?: (text: string) => void;
  enabled?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [mode, setMode] = useState<"ws" | "local" | "off">("off");
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [showComments, setShowComments] = useState(false);

  const revRef = useRef(0);
  const selfId = useRef(peerSelfId()).current;
  const wsRef = useRef<WebSocket | null>(null);
  const chRef = useRef<BroadcastChannel | null>(null);
  const applyingRemote = useRef(false);
  const lastSent = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const onRemoteRef = useRef(onRemoteContent);
  onRemoteRef.current = onRemoteContent;

  const applyRemote = useCallback((text: string) => {
    applyingRemote.current = true;
    lastSent.current = text;
    onRemoteRef.current?.(text);
    queueMicrotask(() => {
      applyingRemote.current = false;
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPeers([]);
      setComments([]);
      setMode("off");
      wsRef.current?.close();
      wsRef.current = null;
      chRef.current?.close();
      chRef.current = null;
      return;
    }

    const username = user?.name || user?.email || "anon";
    let disposed = false;
    let usedFallback = false;
    let pingInterval: number | null = null;
    let sweepInterval: number | null = null;

    function startBroadcastFallback() {
      if (usedFallback || disposed) return;
      usedFallback = true;
      setMode("local");
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;

      const ch = new BroadcastChannel(`jsonbob-presence-${roomId}`);
      chRef.current = ch;
      const known = new Map<string, { name: string; at: number }>();
      known.set(selfId, { name: username, at: Date.now() });

      function refresh() {
        const now = Date.now();
        for (const [id, info] of [...known.entries()]) {
          if (now - info.at > 8000) known.delete(id);
        }
        known.set(selfId, { name: username, at: now });
        setPeers(
          [...known.entries()].map(([id, info]) => ({ id, name: info.name, joinedAt: info.at })),
        );
      }

      ch.onmessage = (ev) => {
        const msg = ev.data as {
          type: string;
          id?: string;
          name?: string;
          at?: number;
          text?: string;
          rev?: number;
          comment?: Comment;
        };
        if (msg?.type === "ping" && msg.id) {
          known.set(msg.id, { name: msg.name || msg.id, at: msg.at || Date.now() });
          refresh();
        }
        if (
          msg?.type === "content" &&
          msg.id &&
          msg.id !== selfId &&
          typeof msg.text === "string"
        ) {
          if ((msg.rev ?? 0) >= revRef.current) {
            revRef.current = msg.rev ?? revRef.current;
            applyRemote(msg.text);
          }
        }
        if (msg?.type === "comment" && msg.comment) {
          setComments((prev) => [...prev, msg.comment!].slice(-50));
        }
      };

      const broadcast = () =>
        ch.postMessage({ type: "ping", id: selfId, name: username, at: Date.now() });
      broadcast();
      refresh();
      pingInterval = window.setInterval(broadcast, 2500);
      sweepInterval = window.setInterval(refresh, 2000);
    }

    const base = getApiBaseUrl();
    const wsUrl = `${apiBaseToWs(base)}/collab/${encodeURIComponent(roomId)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      startBroadcastFallback();
      return () => {
        disposed = true;
      };
    }
    wsRef.current = ws;

    const failTimer = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) startBroadcastFallback();
    }, 4000);

    ws.onopen = () => {
      if (disposed) return;
      window.clearTimeout(failTimer);
      setMode("ws");
      ws.send(JSON.stringify({ type: "hello", id: selfId, name: username }));
    };

    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.type === "peers") {
        setPeers(msg.peers);
        return;
      }
      if (msg.type === "hello-ack") {
        revRef.current = msg.rev;
        if (msg.text) applyRemote(msg.text);
        if (msg.comments) setComments(msg.comments);
        return;
      }
      if (msg.type === "content") {
        if (msg.from === selfId) return;
        revRef.current = Math.max(revRef.current, msg.rev);
        applyRemote(msg.text);
      }
      if (msg.type === "comment") {
        setComments((prev) => [...prev, msg.comment].slice(-50));
      }
      if (msg.type === "comments") {
        setComments(msg.comments);
      }
    };

    ws.onerror = () => {
      if (!disposed) startBroadcastFallback();
    };
    ws.onclose = () => {
      if (!disposed && !usedFallback) startBroadcastFallback();
    };

    return () => {
      disposed = true;
      window.clearTimeout(failTimer);
      if (pingInterval != null) window.clearInterval(pingInterval);
      if (sweepInterval != null) window.clearInterval(sweepInterval);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
      chRef.current?.close();
      chRef.current = null;
    };
  }, [applyRemote, enabled, roomId, selfId, user?.email, user?.name]);

  useEffect(() => {
    if (!enabled || content == null || applyingRemote.current) return;
    if (lastSent.current === content) return;

    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (applyingRemote.current) return;
      if (lastSent.current === content) return;
      revRef.current += 1;
      const rev = revRef.current;
      lastSent.current = content;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "content", text: content, rev }));
        return;
      }
      chRef.current?.postMessage({ type: "content", id: selfId, text: content, rev });
    }, 350);

    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [content, enabled, selfId]);

  function sendComment() {
    const text = draft.trim();
    if (!text) return;
    const username = user?.name || user?.email || "anon";
    const comment: Comment = {
      id: `c_local_${Date.now()}`,
      authorId: selfId,
      authorName: username,
      text,
      createdAt: Date.now(),
    };
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "comment", text }));
    } else {
      chRef.current?.postMessage({ type: "comment", comment });
      setComments((prev) => [...prev, comment].slice(-50));
    }
    setDraft("");
  }

  if (!enabled) return null;

  const label =
    mode === "ws" ? "live" : mode === "local" ? "presence (local)" : "connecting…";
  const count = Math.max(peers.length, 1);

  return (
    <div className="relative flex items-center gap-2 text-[11px] text-[var(--jb-muted)]">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${
          mode === "ws"
            ? "bg-emerald-400"
            : mode === "local"
              ? "bg-amber-400"
              : "bg-[var(--jb-border)]"
        }`}
      />
      <span>
        {count} peer{count === 1 ? "" : "s"} · {label}
        {peers.length > 0 && (
          <span className="ml-1 opacity-70">
            ({peers
              .map((p) => p.name || p.id)
              .slice(0, 4)
              .join(", ")}
            {peers.length > 4 ? "…" : ""})
          </span>
        )}
      </span>
      <button
        type="button"
        className="rounded border border-[var(--jb-border)] px-1.5 py-0.5 hover:text-[var(--jb-text)]"
        onClick={() => setShowComments((v) => !v)}
      >
        Comments{comments.length ? ` (${comments.length})` : ""}
      </button>
      {showComments && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-lg border border-[var(--jb-border)] bg-[var(--jb-panel)] p-2 shadow-xl">
          <ul className="jb-scroll mb-2 max-h-40 space-y-1.5 overflow-y-auto">
            {comments.length === 0 && (
              <li className="px-1 py-2 text-[var(--jb-muted)]">No comments yet</li>
            )}
            {comments.map((c) => (
              <li key={c.id} className="rounded bg-[var(--jb-canvas)] px-2 py-1.5">
                <div className="flex justify-between gap-2 text-[10px] text-[var(--jb-muted)]">
                  <span>{c.authorName}</span>
                  <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-[11px] text-[var(--jb-text)]">{c.text}</p>
              </li>
            ))}
          </ul>
          <div className="flex gap-1">
            <input
              className="min-w-0 flex-1 rounded border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-2 py-1 text-[11px] text-[var(--jb-text)]"
              placeholder="Leave a comment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendComment();
                }
              }}
            />
            <button type="button" className="jb-action jb-action-primary !px-2 !py-1 text-[11px]" onClick={sendComment}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
