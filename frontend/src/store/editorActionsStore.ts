import { create } from "zustand";
import type { PaletteAction } from "../features/command-palette/CommandPalette";

/** Editor pages register ephemeral Save/Format/etc. actions for ⌘K. */
interface EditorActionsState {
  actions: PaletteAction[];
  pathIndex: string[];
  focusPath: ((path: string) => void) | null;
  setActions: (actions: PaletteAction[]) => void;
  setPathSearch: (paths: string[], focus: (path: string) => void) => void;
  clear: () => void;
}

export const useEditorActionsStore = create<EditorActionsState>((set) => ({
  actions: [],
  pathIndex: [],
  focusPath: null,
  setActions: (actions) => set({ actions }),
  setPathSearch: (pathIndex, focusPath) => set({ pathIndex, focusPath }),
  clear: () => set({ actions: [], pathIndex: [], focusPath: null }),
}));
