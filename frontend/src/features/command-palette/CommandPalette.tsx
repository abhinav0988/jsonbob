import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "../../store/themeStore";
import { cn } from "../../lib/cn";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { BottomSheet } from "../../components/mobile/BottomSheet";

export type PaletteAction = {
  id: string;
  label: string;
  group?: string;
  shortcut?: string;
  keywords?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  mobile = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
  mobile?: boolean;
}) {
  const [query, setQuery] = useState("");
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteAction[]>();
    for (const a of actions) {
      const g = a.group ?? "General";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    return map;
  }, [actions]);

  const list = (
    <Command label="Command palette" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder={mobile ? "Search documents, commands, paths…" : "Search commands, documents, or JSON paths…"}
        className={cn(
          "w-full border-b border-[var(--jb-border)] bg-transparent text-[var(--jb-text)] outline-none placeholder:text-[var(--jb-muted)]",
          mobile ? "h-14 px-4 text-base" : "h-12 px-4 text-sm",
        )}
      />
      <Command.List className={cn("jb-scroll min-h-0 flex-1 overflow-y-auto p-2", mobile ? "max-h-[50dvh]" : "max-h-80")}>
        <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--jb-muted)]">No results</Command.Empty>
        {[...grouped.entries()].map(([group, items]) => (
          <Command.Group
            key={group}
            heading={group}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--jb-muted)]"
          >
            {items.map((a) => (
              <Command.Item
                key={a.id}
                value={`${a.label} ${a.keywords ?? ""} ${a.group ?? ""}`}
                onSelect={() => {
                  onOpenChange(false);
                  a.run();
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-xl text-[var(--jb-text)]",
                  mobile ? "min-h-12 px-4 py-3 text-base" : "rounded-md px-3 py-2 text-sm",
                  "data-[selected=true]:bg-[var(--jb-accent)]/15 data-[selected=true]:text-[var(--jb-accent-soft)]",
                )}
              >
                <span className="truncate">{a.label}</span>
                {a.shortcut && (
                  <kbd className="shrink-0 font-mono text-[10px] text-[var(--jb-muted)]">{a.shortcut}</kbd>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  );

  if (!open) return null;

  if (mobile) {
    return (
      <BottomSheet open={open} onClose={() => onOpenChange(false)} title="Search" tall className="!max-h-[88dvh]">
        <div ref={trapRef} className="-mx-4 flex min-h-[50dvh] flex-col">
          {list}
        </div>
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
      />
      <div ref={trapRef} className="relative z-10 w-full max-w-xl">
        <div className="overflow-hidden rounded-xl border border-[var(--jb-border)] bg-[var(--jb-panel)] shadow-2xl">
          {list}
          <div className="flex items-center justify-between border-t border-[var(--jb-border)] px-3 py-2 text-[10px] text-[var(--jb-muted)]">
            <span>↑↓ navigate · ↵ run · esc close</span>
            <span>⌘K · ⌘/</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useGlobalPaletteActions(extra: PaletteAction[] = []): PaletteAction[] {
  const navigate = useNavigate();
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);

  return useMemo(
    () => [
      {
        id: "nav-editor",
        label: "Open Editor",
        group: "Navigate",
        shortcut: "G E",
        run: () => navigate("/documents/new"),
      },
      {
        id: "nav-compare",
        label: "Open Compare",
        group: "Navigate",
        run: () => navigate("/compare"),
      },
      {
        id: "nav-dashboard",
        label: "Open Library / Dashboard",
        group: "Navigate",
        run: () => navigate("/dashboard"),
      },
      {
        id: "nav-settings",
        label: "Account settings",
        group: "Navigate",
        run: () => navigate("/settings"),
      },
      {
        id: "theme-dark",
        label: "Theme: Dark",
        group: "Appearance",
        run: () => setMode("dark"),
      },
      {
        id: "theme-light",
        label: "Theme: Light",
        group: "Appearance",
        run: () => setMode("light"),
      },
      {
        id: "theme-system",
        label: "Theme: Browser default",
        group: "Appearance",
        run: () => setMode("system"),
      },
      {
        id: "accent-orange",
        label: "Accent: Orange",
        group: "Appearance",
        run: () => setAccent("orange"),
      },
      {
        id: "accent-green",
        label: "Accent: Green",
        group: "Appearance",
        run: () => setAccent("green"),
      },
      {
        id: "accent-blue",
        label: "Accent: Blue",
        group: "Appearance",
        run: () => setAccent("blue"),
      },
      {
        id: "accent-red",
        label: "Accent: Red",
        group: "Appearance",
        run: () => setAccent("red"),
      },
      ...extra,
    ],
    [extra, navigate, setAccent, setMode],
  );
}
