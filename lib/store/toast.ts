"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";

export type ToastKind = "info" | "success" | "error";

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  /** ms; 0 means sticky until dismissed. */
  duration?: number;
};

type ToastState = {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
};

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nanoid(8);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience helpers that match a `sonner`-ish API. */
export const toast = {
  info: (title: string, description?: string, duration = 3000) =>
    useToasts.getState().push({ kind: "info", title, description, duration }),
  success: (title: string, description?: string, duration = 3000) =>
    useToasts
      .getState()
      .push({ kind: "success", title, description, duration }),
  error: (title: string, description?: string, duration = 5000) =>
    useToasts.getState().push({ kind: "error", title, description, duration }),
};
