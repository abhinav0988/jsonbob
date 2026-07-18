import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";
export type AccentColor = "orange" | "green" | "blue" | "red";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  /** Resolved dark (after system preference). Kept for consumers. */
  dark: boolean;
  minimap: boolean;
  formatOnPaste: boolean;
  layoutPreset: "focus" | "split" | "review" | "table";
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setMinimap: (on: boolean) => void;
  setFormatOnPaste: (on: boolean) => void;
  setLayoutPreset: (preset: ThemeState["layoutPreset"]) => void;
  toggle: () => void;
  setDark: (dark: boolean) => void;
  apply: () => void;
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "light") return false;
  if (mode === "dark") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDom(mode: ThemeMode, accent: AccentColor) {
  const dark = resolveDark(mode);
  document.body.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.accent = accent;
  return dark;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",
      accent: "orange",
      dark: true,
      minimap: false,
      formatOnPaste: true,
      layoutPreset: "split",
      setMode: (mode) => {
        const dark = applyDom(mode, get().accent);
        set({ mode, dark });
      },
      setAccent: (accent) => {
        applyDom(get().mode, accent);
        set({ accent });
      },
      setMinimap: (minimap) => set({ minimap }),
      setFormatOnPaste: (formatOnPaste) => set({ formatOnPaste }),
      setLayoutPreset: (layoutPreset) => set({ layoutPreset }),
      toggle: () => {
        const nextMode: ThemeMode = get().dark ? "light" : "dark";
        const dark = applyDom(nextMode, get().accent);
        set({ mode: nextMode, dark });
      },
      setDark: (dark) => {
        const mode: ThemeMode = dark ? "dark" : "light";
        applyDom(mode, get().accent);
        set({ mode, dark });
      },
      apply: () => {
        const { mode, accent } = get();
        const dark = applyDom(mode, accent);
        set({ dark });
      },
    }),
    {
      name: "jsonbob-theme",
      partialize: (s) => ({
        mode: s.mode,
        accent: s.accent,
        dark: s.dark,
        minimap: s.minimap,
        formatOnPaste: s.formatOnPaste,
        layoutPreset: s.layoutPreset,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ThemeState>;
        const mode: ThemeMode =
          p.mode ?? (typeof p.dark === "boolean" ? (p.dark ? "dark" : "light") : current.mode);
        const accent = p.accent ?? current.accent;
        return {
          ...current,
          ...p,
          mode,
          accent,
          dark: typeof window !== "undefined" ? resolveDark(mode) : mode !== "light",
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.apply();
      },
    },
  ),
);

export const ACCENT_OPTIONS: Array<{ id: AccentColor; label: string; swatch: string }> = [
  { id: "orange", label: "Orange (default)", swatch: "#f97316" },
  { id: "green", label: "Green", swatch: "#22c55e" },
  { id: "blue", label: "Blue", swatch: "#3b82f6" },
  { id: "red", label: "Red", swatch: "#ef4444" },
];
