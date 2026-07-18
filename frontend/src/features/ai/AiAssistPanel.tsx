import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { aiAssist, type AiAssistSource } from "../../api/platform";
import { BottomSheet } from "../../components/mobile/BottomSheet";

type Msg = { role: "user" | "assistant"; text: string; source?: AiAssistSource | "offline" };

function localAssist(prompt: string, jsonText: string): string {
  const p = prompt.toLowerCase();
  try {
    const data = JSON.parse(jsonText);
    if (p.includes("schema")) {
      return `Suggested shape:\n${JSON.stringify(
        {
          type: Array.isArray(data) ? "array" : typeof data === "object" ? "object" : typeof data,
          hint: "Attach a JSON Schema in Problems for live validation.",
        },
        null,
        2,
      )}`;
    }
    if (p.includes("explain") || p.includes("summar")) {
      const keys =
        data && typeof data === "object" && !Array.isArray(data)
          ? Object.keys(data as object).slice(0, 12)
          : [];
      return `This document is a ${Array.isArray(data) ? `array (${data.length})` : typeof data}.${
        keys.length ? ` Top keys: ${keys.join(", ")}.` : ""
      } Size ~${new TextEncoder().encode(jsonText).length} bytes.`;
    }
    if (p.includes("typescript") || p.includes("type")) {
      return `type Root = ${inferTs(data, 0)};`;
    }
    if (p.includes("fix")) {
      try {
        return JSON.stringify(JSON.parse(jsonText), null, 2);
      } catch {
        return "JSON is invalid — fix parse errors first.";
      }
    }
  } catch {
    return "JSON is invalid — fix parse errors in Problems first, then ask again.";
  }
  return "I can explain, suggest a schema, or draft TypeScript types. Try: “explain”, “schema”, or “typescript”.";
}

function inferTs(v: unknown, depth: number): string {
  if (depth > 4) return "unknown";
  if (v === null) return "null";
  if (Array.isArray(v)) return v.length ? `${inferTs(v[0], depth + 1)}[]` : "unknown[]";
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .slice(0, 20)
      .map(([k, child]) => `  ${/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k)}: ${inferTs(child, depth + 1)};`);
    return `{\n${entries.join("\n")}\n}`;
  }
  return typeof v;
}

function looksLikeJsonBlock(text: string) {
  const t = text.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]")) || t.includes("```");
}

function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fence?.[1] ?? text).trim();
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return null;
  }
}

function sourceLabel(source?: Msg["source"]) {
  if (!source) return null;
  if (source === "workers-ai") return "Workers AI";
  if (source === "local") return "local";
  if (source === "local-fallback") return "local · fallback";
  return "offline";
}

export function AiAssistPanel({
  open,
  onClose,
  jsonText,
  onApply,
  mobile = false,
}: {
  open: boolean;
  onClose: () => void;
  jsonText: string;
  onApply?: (nextJson: string) => void;
  mobile?: boolean;
}) {
  const [input, setInput] = useState("Explain this JSON");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Ask to explain, schema, typescript, or fix tips. Uses the API when available.",
    },
  ]);
  const [sending, setSending] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);
  const quickPrompts = ["Explain this JSON", "Fix JSON", "Generate Schema", "Summarize", "TypeScript types"];

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    setSending(true);
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    try {
      const res = await aiAssist(q, jsonText);
      setMsgs((m) => [...m, { role: "assistant", text: res.reply, source: res.source }]);
    } catch {
      const reply = localAssist(q, jsonText);
      setMsgs((m) => [...m, { role: "assistant", text: reply, source: "offline" }]);
    } finally {
      setSending(false);
    }
  }

  const messageList = (
    <div className="jb-scroll min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
      {msgs.map((m, i) => (
        <div
          key={i}
          className={
            m.role === "user"
              ? mobile
                ? "ml-6 rounded-2xl bg-[var(--jb-accent)]/15 px-4 py-3 text-[var(--jb-text)]"
                : "ml-8 rounded-lg bg-[var(--jb-accent)]/15 px-3 py-2 text-[var(--jb-text)]"
              : mobile
                ? "mr-2 whitespace-pre-wrap rounded-2xl bg-[var(--jb-elevated)] px-4 py-3 font-mono text-xs text-[var(--jb-muted)]"
                : "mr-4 whitespace-pre-wrap rounded-lg bg-[var(--jb-elevated)] px-3 py-2 font-mono text-xs text-[var(--jb-muted)]"
          }
        >
          {m.text}
          {m.role === "assistant" && m.source && (
            <div className="mt-1.5 text-[10px] uppercase tracking-wide text-[var(--jb-muted)]/70">
              {sourceLabel(m.source)}
            </div>
          )}
          {m.role === "assistant" && onApply && looksLikeJsonBlock(m.text) && (
            <button
              type="button"
              className={mobile ? "jb-touch-chip-primary mt-3 text-[11px]" : "jb-action jb-action-primary mt-2 text-[11px]"}
              onClick={() => {
                const next = extractJson(m.text);
                if (next) onApply(next);
              }}
            >
              Apply to editor
            </button>
          )}
        </div>
      ))}
    </div>
  );

  const composer = (
    <div className={mobile ? "mt-4 flex gap-2 border-t border-[var(--jb-border)] pt-3" : "border-t border-[var(--jb-border)] p-3"}>
      <div className="flex w-full gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          className={mobile ? "jb-mobile-input min-w-0 flex-1" : "toolbar-input min-w-0 flex-1"}
          placeholder="Ask about this JSON…"
          disabled={sending}
        />
        <button
          type="button"
          className={mobile ? "jb-touch-chip-primary shrink-0" : "jb-action jb-action-primary"}
          disabled={!canSend}
          onClick={() => void send()}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );

  if (!open) return null;

  if (mobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title="AI Assistant" tall className="!max-h-[88dvh]">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickPrompts.map((q) => (
            <button key={q} type="button" className="jb-touch-chip shrink-0" onClick={() => setInput(q)}>
              {q}
            </button>
          ))}
        </div>
        {messageList}
        {composer}
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-[86] flex justify-end bg-black/40 backdrop-blur-[2px]">
      <button type="button" className="h-full flex-1" aria-label="Close AI" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[var(--jb-border)] bg-[var(--jb-panel)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--jb-border)] px-4 py-3">
          <Sparkles className="h-4 w-4 text-[var(--jb-accent)]" />
          <h2 className="text-sm font-semibold">AI Assist</h2>
          <button type="button" className="jb-action ml-auto" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {messageList}
        </div>
        {composer}
      </aside>
    </div>
  );
}
