import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkspaceTab = {
  id: string;
  title: string;
  href: string;
  pinned?: boolean;
};

export type JsonTemplate = {
  id: string;
  name: string;
  description: string;
  content: string;
};

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeId: string | null;
  tags: Record<string, string[]>;
  favorites: string[];
  folders: Record<string, string>; // docId -> folder name
  folderList: string[];
  /** one-time burn tokens: token -> docId */
  oneTimeLinks: Record<string, { docId: string; createdAt: number }>;
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  togglePin: (id: string) => void;
  setTags: (id: string, tags: string[]) => void;
  toggleFavorite: (id: string) => void;
  setFavorite: (id: string, on: boolean) => void;
  hydrateLibrary: (input: {
    folders: Record<string, string>;
    folderList: string[];
    tags: Record<string, string[]>;
    favorites: string[];
  }) => void;
  setFolder: (docId: string, folder: string | null) => void;
  addFolder: (name: string) => void;
  createOneTimeToken: (docId: string) => string;
  consumeOneTimeToken: (token: string) => string | null;
}

export const BUILTIN_TEMPLATES: JsonTemplate[] = [
  {
    id: "empty",
    name: "Empty object",
    description: "Blank {}",
    content: "{\n  \n}",
  },
  {
    id: "user",
    name: "User profile",
    description: "Common user shape",
    content: JSON.stringify(
      { id: "usr_1", name: "", email: "", roles: ["member"], active: true },
      null,
      2,
    ),
  },
  {
    id: "api-error",
    name: "API error",
    description: "Standard error envelope",
    content: JSON.stringify(
      { error: { code: "VALIDATION_ERROR", message: "", details: [] } },
      null,
      2,
    ),
  },
  {
    id: "list",
    name: "Paginated list",
    description: "items + page meta",
    content: JSON.stringify({ items: [], page: 1, limit: 20, total: 0 }, null, 2),
  },
];

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeId: null,
      tags: {},
      favorites: [],
      folders: {},
      folderList: ["Inbox", "Archive"],
      oneTimeLinks: {},
      openTab: (tab) => {
        const existing = get().tabs.find((t) => t.id === tab.id);
        if (existing) {
          set({ activeId: tab.id });
          return;
        }
        set({ tabs: [...get().tabs, tab].slice(-12), activeId: tab.id });
      },
      closeTab: (id) => {
        const tabs = get().tabs.filter((t) => t.id !== id);
        const activeId =
          get().activeId === id ? (tabs[tabs.length - 1]?.id ?? null) : get().activeId;
        set({ tabs, activeId });
      },
      setActive: (id) => set({ activeId: id }),
      togglePin: (id) =>
        set({
          tabs: get().tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
        }),
      setTags: (id, tags) => set({ tags: { ...get().tags, [id]: tags } }),
      toggleFavorite: (id) => {
        const fav = get().favorites;
        set({
          favorites: fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id].slice(-100),
        });
      },
      setFavorite: (id, on) => {
        const fav = get().favorites.filter((x) => x !== id);
        set({ favorites: on ? [...fav, id].slice(-100) : fav });
      },
      hydrateLibrary: (input) => {
        set({
          folders: { ...get().folders, ...input.folders },
          folderList: [...new Set([...get().folderList, ...input.folderList])],
          tags: { ...get().tags, ...input.tags },
          favorites: input.favorites,
        });
      },
      setFolder: (docId, folder) => {
        const folders = { ...get().folders };
        if (!folder) delete folders[docId];
        else folders[docId] = folder;
        set({ folders });
      },
      addFolder: (name) => {
        const n = name.trim();
        if (!n) return;
        if (get().folderList.includes(n)) return;
        set({ folderList: [...get().folderList, n] });
      },
      createOneTimeToken: (docId) => {
        const token = `ot_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        set({
          oneTimeLinks: {
            ...get().oneTimeLinks,
            [token]: { docId, createdAt: Date.now() },
          },
        });
        return token;
      },
      consumeOneTimeToken: (token) => {
        const entry = get().oneTimeLinks[token];
        if (!entry) return null;
        const next = { ...get().oneTimeLinks };
        delete next[token];
        set({ oneTimeLinks: next });
        return entry.docId;
      },
    }),
    { name: "jsonbob-workspace" },
  ),
);
