import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  notify: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  notify: (t) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  info: (title: string, message?: string) =>
    useToastStore.getState().notify({ kind: 'info', title, message }),
  success: (title: string, message?: string) =>
    useToastStore.getState().notify({ kind: 'success', title, message }),
  warning: (title: string, message?: string) =>
    useToastStore.getState().notify({ kind: 'warning', title, message }),
  error: (title: string, message?: string) =>
    useToastStore.getState().notify({ kind: 'error', title, message }),
};
