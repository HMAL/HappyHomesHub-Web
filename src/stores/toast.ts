import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

const DURATIONS: Record<ToastType, number> = {
  error: 7000,
  warning: 7000,
  success: 3000,
  info: 3000,
};

let _counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  show(message, type = 'info') {
    const id = String(++_counter);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, DURATIONS[type]);
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
