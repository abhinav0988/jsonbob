import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

interface ToastState {
  items: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = "info") => {
    const id = `t_${Math.random().toString(36).slice(2, 9)}`;
    set((s) => ({ items: [...s.items.slice(-4), { id, message, tone }] }));
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone: ToastTone = "info") {
  useToastStore.getState().push(message, tone);
}
