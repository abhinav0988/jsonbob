import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentEntry {
  id: string;
  title: string;
  href: string;
  visibility?: string;
  source: "document" | "public" | "editor" | "compare";
  preview?: string;
  openedAt: number;
}

interface RecentState {
  items: RecentEntry[];
  push: (entry: Omit<RecentEntry, "openedAt">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const MAX = 20;

export const useRecentStore = create<RecentState>()(
  persist(
    (set, get) => ({
      items: [],
      push: (entry) => {
        const next: RecentEntry = { ...entry, openedAt: Date.now() };
        const filtered = get().items.filter((i) => i.id !== entry.id && i.href !== entry.href);
        set({ items: [next, ...filtered].slice(0, MAX) });
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      clear: () => set({ items: [] }),
    }),
    { name: "jsonbob-recent" },
  ),
);
