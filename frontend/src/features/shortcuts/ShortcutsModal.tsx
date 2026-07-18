import { useEffect } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: "⌘K / Ctrl+K", action: "Command palette" },
  { keys: "⌘/ / Ctrl+/", action: "Keyboard shortcut map" },
  { keys: "⌘⇧F / Ctrl+⇧F", action: "Format JSON" },
  { keys: "⌘S / Ctrl+S", action: "Save document" },
  { keys: "Esc", action: "Close overlays" },
  { keys: "↑ ↓ ↵", action: "Navigate palette / run" },
  { keys: "Tree search", action: "Filter nodes in Tree view" },
  { keys: "⌘K → doc name", action: "Jump to library documents" },
  { keys: "⌘K → $.path", action: "Jump to JSON path in editor" },
];

export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--jb-border)] bg-[var(--jb-panel)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-base font-semibold text-[var(--jb-text)]">
            Keyboard shortcuts
          </h2>
          <button type="button" className="jb-action" onClick={onClose}>
            Close
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((row) => (
            <li
              key={row.keys}
              className="flex items-center justify-between gap-3 border-b border-[var(--jb-border)]/60 py-2 text-sm last:border-0"
            >
              <span className="text-[var(--jb-muted)]">{row.action}</span>
              <kbd className="shrink-0 rounded border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-2 py-0.5 font-mono text-[11px] text-[var(--jb-text)]">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
