import { useToastStore } from "./toastStore";
import { cn } from "../../lib/cn";

export function ToastViewport() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-lg backdrop-blur",
            t.tone === "error" &&
              "border-red-500/40 bg-red-950/90 text-red-100",
            t.tone === "success" &&
              "border-emerald-500/40 bg-emerald-950/90 text-emerald-100",
            t.tone === "info" &&
              "border-[var(--jb-border)] bg-[var(--jb-elevated)]/95 text-[var(--jb-text)]",
          )}
          role="status"
        >
          <span>{t.message}</span>
          <button
            type="button"
            className="shrink-0 text-xs opacity-60 hover:opacity-100"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
