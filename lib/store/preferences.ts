"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "system" | "dark" | "light";
export type AccentColor = "default" | "sky" | "emerald" | "violet" | "amber";
export type FontSize = "sm" | "md" | "lg";

export type PreferencesState = {
  theme: ThemeMode;
  accent: AccentColor;
  fontSize: FontSize;
  compactMode: boolean;
  sendOnEnter: boolean;
  reduceMotion: boolean;
  /** WhatsApp integration (client-side only; see PreferencesDialog for docs). */
  whatsappNumber: string;
  whatsappWebhookUrl: string;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setFontSize: (fontSize: FontSize) => void;
  setCompactMode: (compact: boolean) => void;
  setSendOnEnter: (send: boolean) => void;
  setReduceMotion: (reduce: boolean) => void;
  setWhatsappNumber: (value: string) => void;
  setWhatsappWebhookUrl: (value: string) => void;
  reset: () => void;
};

const DEFAULTS = {
  theme: "dark" as ThemeMode,
  accent: "default" as AccentColor,
  fontSize: "md" as FontSize,
  compactMode: false,
  sendOnEnter: true,
  reduceMotion: false,
  whatsappNumber: "",
  whatsappWebhookUrl: "",
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setFontSize: (fontSize) => set({ fontSize }),
      setCompactMode: (compactMode) => set({ compactMode }),
      setSendOnEnter: (sendOnEnter) => set({ sendOnEnter }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setWhatsappNumber: (whatsappNumber) => set({ whatsappNumber }),
      setWhatsappWebhookUrl: (whatsappWebhookUrl) =>
        set({ whatsappWebhookUrl }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: "orbit-preferences",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

export const ACCENT_COLORS: Array<{
  value: AccentColor;
  label: string;
  swatch: string;
}> = [
  { value: "default", label: "Default", swatch: "oklch(0.922 0 0)" },
  { value: "sky", label: "Sky", swatch: "oklch(0.685 0.164 237)" },
  { value: "emerald", label: "Emerald", swatch: "oklch(0.724 0.151 162)" },
  { value: "violet", label: "Violet", swatch: "oklch(0.645 0.216 303)" },
  { value: "amber", label: "Amber", swatch: "oklch(0.774 0.150 70)" },
];
